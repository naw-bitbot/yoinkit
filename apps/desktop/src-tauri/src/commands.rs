use crate::clipper;
use crate::db::{Clip, Database, Preset};
use crate::download_manager::DownloadManager;
use crate::image_scraper;
use crate::markdown::{self, MarkdownOptions};
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
    write_subs: Option<bool>,
    sub_lang: Option<String>,
    sub_format: Option<String>,
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
        match ytdlp::spawn_video_download_with_subs(
            &url,
            format.as_deref(),
            quality.as_deref(),
            audio_only,
            write_subs.unwrap_or(false),
            sub_lang.as_deref(),
            sub_format.as_deref(),
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
    write_subs: Option<bool>,
    sub_lang: Option<String>,
    sub_format: Option<String>,
) -> Result<String, String> {
    start_video_download(state, url, format, quality, true, save_path, write_subs, sub_lang, sub_format).await
}

#[tauri::command]
pub async fn download_subtitles(
    state: State<'_, AppState>,
    url: String,
    sub_lang: Option<String>,
    sub_format: Option<String>,
    auto_subs: Option<bool>,
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
        flags: "subtitles".to_string(),
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
        match ytdlp::download_subtitles(
            &url,
            sub_lang.as_deref(),
            sub_format.as_deref(),
            auto_subs.unwrap_or(true),
            &expanded,
        ).await {
            Ok(_) => {
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

// Clipper commands

fn build_clip_from_html(html: &str, url: &str) -> Result<Clip, String> {
    let content = clipper::extract_readable(html, url)?;
    let options = MarkdownOptions {
        include_frontmatter: true,
        include_images: true,
        image_download_path: None,
    };
    let md_output = markdown::html_to_markdown(&content, url, &options);
    let markdown_text = format!("{}{}", md_output.frontmatter, md_output.body);
    let now = chrono::Utc::now().to_rfc3339();
    let clip = Clip {
        id: Uuid::new_v4().to_string(),
        url: url.to_string(),
        title: Some(content.title),
        markdown: Some(markdown_text),
        html: Some(html.to_string()),
        summary: content.description,
        tags: "[]".to_string(),
        source_type: "clip".to_string(),
        vault_path: None,
        created_at: now,
        updated_at: None,
    };
    Ok(clip)
}

#[tauri::command]
pub async fn clip_url(url: String, state: State<'_, AppState>) -> Result<Clip, String> {
    let raw_html = clipper::fetch_page(&url).await?;
    let clip = build_clip_from_html(&raw_html, &url)?;
    state.db.insert_clip(&clip).map_err(|e| format!("DB error: {}", e))?;
    Ok(clip)
}

#[tauri::command]
pub async fn clip_html(html: String, url: String, state: State<'_, AppState>) -> Result<Clip, String> {
    let clip = build_clip_from_html(&html, &url)?;
    state.db.insert_clip(&clip).map_err(|e| format!("DB error: {}", e))?;
    Ok(clip)
}

#[tauri::command]
pub fn list_clips(state: State<'_, AppState>) -> Result<Vec<Clip>, String> {
    state.db.list_clips().map_err(|e| format!("DB error: {}", e))
}

#[tauri::command]
pub fn get_clip(id: String, state: State<'_, AppState>) -> Result<Option<Clip>, String> {
    state.db.get_clip(&id).map_err(|e| format!("DB error: {}", e))
}

#[tauri::command]
pub fn delete_clip(id: String, state: State<'_, AppState>) -> Result<(), String> {
    state.db.delete_clip(&id).map_err(|e| format!("DB error: {}", e))
}

#[tauri::command]
pub fn update_clip_tags(id: String, tags: Vec<String>, state: State<'_, AppState>) -> Result<(), String> {
    let mut clip = state.db.get_clip(&id)
        .map_err(|e| format!("DB error: {}", e))?
        .ok_or_else(|| format!("Clip not found: {}", id))?;
    let tags_json = serde_json::to_string(&tags).map_err(|e| format!("Serialization error: {}", e))?;
    clip.tags = tags_json;
    clip.updated_at = Some(chrono::Utc::now().to_rfc3339());
    state.db.update_clip(&clip).map_err(|e| format!("DB error: {}", e))
}

#[tauri::command]
pub async fn archive_url(url: String, state: State<'_, AppState>) -> Result<Clip, String> {
    // 1. Get save dir from settings
    let save_dir = state.db.get_setting("default_save_path")
        .ok().flatten()
        .unwrap_or_else(|| "~/Downloads/Yoinkit".to_string());
    let archive_dir = format!("{}/Archives", save_dir);

    // 2. Archive the page
    let archive_path = crate::archiver::archive_page(&url, &archive_dir).await?;

    // 3. Also extract readable content for the clip metadata
    let raw_html = crate::clipper::fetch_page(&url).await
        .unwrap_or_default();
    let title = if !raw_html.is_empty() {
        crate::clipper::extract_readable(&raw_html, &url)
            .map(|c| c.title)
            .unwrap_or_else(|_| url.clone())
    } else {
        url.clone()
    };

    // 4. Save as clip with source_type = "archive"
    let clip = Clip {
        id: Uuid::new_v4().to_string(),
        url: url.clone(),
        title: Some(title),
        markdown: None,
        html: Some(format!("file://{}", archive_path)),
        summary: None,
        tags: "[]".to_string(),
        source_type: "archive".to_string(),
        vault_path: Some(archive_path),
        created_at: chrono::Utc::now().to_rfc3339(),
        updated_at: None,
    };

    state.db.insert_clip(&clip).map_err(|e| format!("DB error: {}", e))?;
    Ok(clip)
}

#[tauri::command]
pub async fn check_link_status(url: String) -> Result<crate::archiver::LinkStatus, String> {
    crate::archiver::check_link(&url).await
}

#[tauri::command]
pub async fn check_all_archived_links(state: State<'_, AppState>) -> Result<Vec<crate::archiver::LinkStatus>, String> {
    let clips = state.db.list_clips().map_err(|e| format!("DB error: {}", e))?;
    Ok(crate::archiver::check_all_links(&clips).await)
}

#[tauri::command]
pub async fn export_clip_to_vault(
    id: String,
    vault_path: String,
    attachments_folder: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let mut clip = state.db.get_clip(&id)
        .map_err(|e| format!("DB error: {}", e))?
        .ok_or_else(|| format!("Clip not found: {}", id))?;

    let vault_expanded = shellexpand::tilde(&vault_path).to_string();
    let attachments_path = format!("{}/{}", vault_expanded, attachments_folder);
    std::fs::create_dir_all(&vault_expanded).map_err(|e| format!("Failed to create vault dir: {}", e))?;
    std::fs::create_dir_all(&attachments_path).map_err(|e| format!("Failed to create attachments dir: {}", e))?;

    let title = clip.title.clone().unwrap_or_else(|| "untitled".to_string());
    let sanitized_title: String = title
        .chars()
        .map(|c| if c.is_alphanumeric() || c == ' ' || c == '-' || c == '_' { c } else { '_' })
        .collect::<String>()
        .trim()
        .to_string();
    let sanitized_title = if sanitized_title.is_empty() { "untitled".to_string() } else { sanitized_title };

    let file_name = format!("{}.md", sanitized_title);
    let file_path = format!("{}/{}", vault_expanded, file_name);

    let markdown_content = clip.markdown.clone().unwrap_or_default();
    std::fs::write(&file_path, &markdown_content)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    clip.vault_path = Some(file_path.clone());
    clip.updated_at = Some(chrono::Utc::now().to_rfc3339());
    state.db.update_clip(&clip).map_err(|e| format!("DB error: {}", e))?;

    Ok(file_path)
}
