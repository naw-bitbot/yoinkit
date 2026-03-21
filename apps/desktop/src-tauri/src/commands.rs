use crate::db::{Database, Preset};
use crate::download_manager::DownloadManager;
use crate::image_scraper;
use crate::settings::{self, AppSettings};
use crate::wget::WgetFlags;
use crate::ytdlp;
use std::sync::Arc;
use tauri::State;
use uuid::Uuid;

#[derive(Clone)]
pub struct AppState {
    pub db: Arc<Database>,
    pub download_manager: Arc<DownloadManager>,
    pub auth_token: String,
}

#[tauri::command]
pub async fn start_download(
    state: State<'_, AppState>,
    url: String,
    flags: Option<WgetFlags>,
    save_path: Option<String>,
) -> Result<String, String> {
    state.download_manager
        .start_download(url, flags.unwrap_or_default(), save_path)
        .await
}

#[tauri::command]
pub async fn pause_download(state: State<'_, AppState>, id: String) -> Result<(), String> {
    state.download_manager.pause_download(&id).await
}

#[tauri::command]
pub async fn resume_download(state: State<'_, AppState>, id: String) -> Result<(), String> {
    state.download_manager.resume_download(&id).await
}

#[tauri::command]
pub async fn cancel_download(state: State<'_, AppState>, id: String) -> Result<(), String> {
    state.download_manager.cancel_download(&id).await
}

#[tauri::command]
pub fn get_download(state: State<'_, AppState>, id: String) -> Result<Option<crate::db::Download>, String> {
    state.download_manager.get_download(&id)
}

#[tauri::command]
pub fn list_downloads(state: State<'_, AppState>) -> Result<Vec<crate::db::Download>, String> {
    state.download_manager.list_downloads()
}

#[tauri::command]
pub fn delete_download(state: State<'_, AppState>, id: String) -> Result<(), String> {
    state.download_manager.delete_download(&id)
}

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> Result<AppSettings, String> {
    settings::get_settings(&state.db)
}

#[tauri::command]
pub fn update_settings(state: State<'_, AppState>, new_settings: AppSettings) -> Result<(), String> {
    settings::update_settings(&state.db, &new_settings)
}

// Presets
#[tauri::command]
pub fn save_preset(state: State<'_, AppState>, name: String, flags_json: String) -> Result<String, String> {
    let preset = Preset {
        id: Uuid::new_v4().to_string(),
        name,
        flags_json,
        created_at: chrono::Utc::now().to_rfc3339(),
    };
    state.db.insert_preset(&preset).map_err(|e| format!("DB error: {}", e))?;
    Ok(preset.id)
}

#[tauri::command]
pub fn list_presets(state: State<'_, AppState>) -> Result<Vec<Preset>, String> {
    state.db.list_presets().map_err(|e| format!("DB error: {}", e))
}

#[tauri::command]
pub fn delete_preset(state: State<'_, AppState>, id: String) -> Result<(), String> {
    state.db.delete_preset(&id).map_err(|e| format!("DB error: {}", e))
}

#[tauri::command]
pub fn get_auth_token(state: State<'_, AppState>) -> String {
    state.auth_token.clone()
}

// Video/Audio commands
#[tauri::command]
pub async fn get_video_info(url: String) -> Result<ytdlp::VideoInfo, String> {
    ytdlp::get_video_info(&url).await
}

#[tauri::command]
pub async fn start_video_download(
    state: State<'_, AppState>,
    url: String,
    format: Option<String>,
    quality: Option<String>,
    audio_only: bool,
    save_path: Option<String>,
) -> Result<String, String> {
    let save_dir = save_path.unwrap_or_else(|| {
        state.db.get_setting("default_save_path")
            .ok()
            .flatten()
            .unwrap_or_else(|| "~/Downloads/Yoinkit".to_string())
    });
    let expanded = shellexpand::tilde(&save_dir).to_string();
    std::fs::create_dir_all(&expanded).map_err(|e| format!("Failed to create dir: {}", e))?;

    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    let download = crate::db::Download {
        id: id.clone(),
        url: url.clone(),
        status: "downloading".to_string(),
        progress: 0.0,
        save_path: expanded.clone(),
        flags: if audio_only { "audio_only".to_string() } else { "video".to_string() },
        file_size: None,
        speed: None,
        eta: None,
        error: None,
        created_at: now,
        completed_at: None,
    };

    state.db.insert_download(&download).map_err(|e| format!("DB error: {}", e))?;

    let db = state.db.clone();
    let dl_id = id.clone();

    tokio::spawn(async move {
        match ytdlp::spawn_video_download(
            &url,
            format.as_deref(),
            quality.as_deref(),
            audio_only,
            &expanded,
        ).await {
            Ok((mut child, mut progress_rx)) => {
                while let Some(progress) = progress_rx.recv().await {
                    if let Ok(Some(mut dl)) = db.get_download(&dl_id) {
                        dl.progress = progress.percentage;
                        dl.speed = progress.speed;
                        dl.eta = progress.eta;
                        let _ = db.update_download(&dl);
                    }
                }
                // Check exit
                match child.wait().await {
                    Ok(exit) if exit.success() => {
                        if let Ok(Some(mut dl)) = db.get_download(&dl_id) {
                            dl.status = "completed".to_string();
                            dl.progress = 100.0;
                            dl.completed_at = Some(chrono::Utc::now().to_rfc3339());
                            let _ = db.update_download(&dl);
                        }
                    }
                    Ok(exit) => {
                        if let Ok(Some(mut dl)) = db.get_download(&dl_id) {
                            dl.status = "failed".to_string();
                            dl.error = Some(format!("yt-dlp exited with code: {}", exit));
                            let _ = db.update_download(&dl);
                        }
                    }
                    Err(e) => {
                        if let Ok(Some(mut dl)) = db.get_download(&dl_id) {
                            dl.status = "failed".to_string();
                            dl.error = Some(format!("Process error: {}", e));
                            let _ = db.update_download(&dl);
                        }
                    }
                }
            }
            Err(e) => {
                if let Ok(Some(mut dl)) = db.get_download(&dl_id) {
                    dl.status = "failed".to_string();
                    dl.error = Some(e);
                    let _ = db.update_download(&dl);
                }
            }
        }
    });

    Ok(id)
}

#[tauri::command]
pub async fn start_audio_download(
    state: State<'_, AppState>,
    url: String,
    format: Option<String>,
    quality: Option<String>,
    save_path: Option<String>,
) -> Result<String, String> {
    start_video_download(state, url, format, quality, true, save_path).await
}

// Image scraping commands
#[tauri::command]
pub async fn scrape_images(url: String) -> Result<Vec<image_scraper::ScrapedImage>, String> {
    image_scraper::scrape_images(&url).await
}

#[tauri::command]
pub async fn download_images(
    state: State<'_, AppState>,
    image_urls: Vec<String>,
    save_path: Option<String>,
) -> Result<String, String> {
    let save_dir = save_path.unwrap_or_else(|| {
        state.db.get_setting("default_save_path")
            .ok()
            .flatten()
            .map(|p| format!("{}/Images", p))
            .unwrap_or_else(|| "~/Downloads/Yoinkit/Images".to_string())
    });

    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let count = image_urls.len();

    let download = crate::db::Download {
        id: id.clone(),
        url: format!("{} images", count),
        status: "downloading".to_string(),
        progress: 0.0,
        save_path: shellexpand::tilde(&save_dir).to_string(),
        flags: "images".to_string(),
        file_size: None,
        speed: None,
        eta: None,
        error: None,
        created_at: now,
        completed_at: None,
    };

    state.db.insert_download(&download).map_err(|e| format!("DB error: {}", e))?;

    let db = state.db.clone();
    let dl_id = id.clone();

    tokio::spawn(async move {
        match image_scraper::download_images(image_urls, &save_dir).await {
            Ok(()) => {
                if let Ok(Some(mut dl)) = db.get_download(&dl_id) {
                    dl.status = "completed".to_string();
                    dl.progress = 100.0;
                    dl.completed_at = Some(chrono::Utc::now().to_rfc3339());
                    let _ = db.update_download(&dl);
                }
            }
            Err(e) => {
                if let Ok(Some(mut dl)) = db.get_download(&dl_id) {
                    dl.status = "failed".to_string();
                    dl.error = Some(e);
                    let _ = db.update_download(&dl);
                }
            }
        }
    });

    Ok(id)
}
