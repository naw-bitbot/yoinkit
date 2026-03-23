use crate::ai;
use crate::ai::AiProvider;
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

#[derive(serde::Serialize)]
pub struct DuplicateInfo {
    pub id: String,
    pub content_type: String,
    pub title: String,
    pub created_at: String,
}

#[derive(Clone)]
pub struct AppState {
    pub db: Arc<Database>,
    pub download_manager: Arc<DownloadManager>,
    pub auth_token: String,
    pub search_engine: Option<Arc<crate::search::SearchEngine>>,
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
    state.download_manager.delete_download(&id)?;
    let _ = state.db.delete_gallery_meta(&id, "download");
    Ok(())
}

#[tauri::command]
pub fn check_duplicate(url: String, state: State<'_, AppState>) -> Result<Option<DuplicateInfo>, String> {
    // Check downloads
    let downloads = state.db.list_downloads().map_err(|e| format!("DB error: {}", e))?;
    for dl in &downloads {
        if dl.url == url {
            return Ok(Some(DuplicateInfo {
                id: dl.id.clone(),
                content_type: "download".to_string(),
                title: dl.url.clone(),
                created_at: dl.created_at.clone(),
            }));
        }
    }
    // Check clips
    let clips = state.db.list_clips().map_err(|e| format!("DB error: {}", e))?;
    for clip in &clips {
        if clip.url == url {
            return Ok(Some(DuplicateInfo {
                id: clip.id.clone(),
                content_type: "clip".to_string(),
                title: clip.title.clone().unwrap_or_else(|| clip.url.clone()),
                created_at: clip.created_at.clone(),
            }));
        }
    }
    Ok(None)
}

#[tauri::command]
pub fn compute_file_hash(file_path: String) -> Result<String, String> {
    use sha2::{Sha256, Digest};
    use std::io::Read;

    let mut file = std::fs::File::open(&file_path)
        .map_err(|e| format!("Failed to open file: {}", e))?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 8192];
    loop {
        let bytes_read = file.read(&mut buffer)
            .map_err(|e| format!("Failed to read file: {}", e))?;
        if bytes_read == 0 { break; }
        hasher.update(&buffer[..bytes_read]);
    }
    Ok(format!("{:x}", hasher.finalize()))
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
    // Pro gating for high-quality video
    let app_settings = crate::settings::get_settings(&state.db)?;
    if !app_settings.pro_unlocked {
        if let Some(ref q) = quality {
            if q == "4k" || q == "1080p" {
                return Err("Pro required for 1080p and 4K quality".to_string());
            }
        }
    }

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
        file_hash: None,
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
            Ok((mut child, mut progress_rx, mut err_rx)) => {
                // Collect stderr in background
                let stderr_lines = Arc::new(tokio::sync::Mutex::new(Vec::<String>::new()));
                let stderr_lines_clone = stderr_lines.clone();
                tokio::spawn(async move {
                    while let Some(line) = err_rx.recv().await {
                        stderr_lines_clone.lock().await.push(line);
                    }
                });

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
                            let stderr = stderr_lines.lock().await.join("\n");
                            dl.error = Some(if stderr.is_empty() {
                                format!("yt-dlp exited with code: {}", exit)
                            } else {
                                format!("yt-dlp failed ({}): {}", exit, stderr)
                            });
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
    // Pro gating for premium audio formats/quality
    let app_settings = crate::settings::get_settings(&state.db)?;
    if !app_settings.pro_unlocked {
        if let Some(ref f) = format {
            if f != "mp3" {
                return Err("Pro required for FLAC, WAV, AAC, and Opus formats".to_string());
            }
        }
        if let Some(ref q) = quality {
            if q == "0" {
                return Err("Pro required for 320kbps quality".to_string());
            }
        }
    }

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
        file_hash: None,
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
        file_hash: None,
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
    let mut clip = build_clip_from_html(&raw_html, &url)?;
    state.db.insert_clip(&clip).map_err(|e| format!("DB error: {}", e))?;

    // Auto-tag and auto-summarize if enabled
    let app_settings = settings::get_settings(&state.db)?;
    if app_settings.auto_tag || app_settings.auto_summarize {
        let provider = ai::AiProvider::from_settings(&app_settings, &state.db);
        if let AiProvider::None = provider {
            // No provider configured, skip
        } else {
            let content = clip.markdown.as_deref().unwrap_or("").to_string();
            if app_settings.auto_tag {
                if let Ok(tags) = ai::auto_tag(&content, &provider).await {
                    let tags_json = serde_json::to_string(&tags).unwrap_or_else(|_| "[]".to_string());
                    clip.tags = tags_json;
                }
            }
            if app_settings.auto_summarize {
                if let Ok(summary) = ai::auto_summarize(&content, &provider).await {
                    clip.summary = Some(summary);
                }
            }
            clip.updated_at = Some(chrono::Utc::now().to_rfc3339());
            let _ = state.db.update_clip(&clip);
        }
    }

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
    state.db.delete_clip(&id).map_err(|e| format!("DB error: {}", e))?;
    let _ = state.db.delete_gallery_meta(&id, "clip");
    Ok(())
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
pub fn search_yoinks(query: String, limit: Option<usize>, state: State<'_, AppState>) -> Result<Vec<crate::search::SearchResult>, String> {
    let engine = state.search_engine.as_ref().ok_or("Search not initialized")?;
    engine.search(&query, limit.unwrap_or(20))
}

#[tauri::command]
pub fn rebuild_search_index(state: State<'_, AppState>) -> Result<(), String> {
    let engine = state.search_engine.as_ref().ok_or("Search not initialized")?;
    let clips = state.db.list_clips().map_err(|e| format!("DB error: {}", e))?;
    let downloads = state.db.list_downloads().map_err(|e| format!("DB error: {}", e))?;
    engine.rebuild_index(&clips, &downloads)
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

#[tauri::command]
pub async fn ai_tag_clip(id: String, state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let clip = state.db.get_clip(&id)
        .map_err(|e| format!("DB error: {}", e))?
        .ok_or_else(|| format!("Clip not found: {}", id))?;
    let app_settings = settings::get_settings(&state.db)?;
    let provider = ai::AiProvider::from_settings(&app_settings, &state.db);
    let content = clip.markdown.as_deref().unwrap_or("");
    let tags = ai::auto_tag(content, &provider).await?;
    // Update clip in DB
    let tags_json = serde_json::to_string(&tags).map_err(|e| format!("JSON error: {}", e))?;
    let mut updated = clip;
    updated.tags = tags_json;
    updated.updated_at = Some(chrono::Utc::now().to_rfc3339());
    state.db.update_clip(&updated).map_err(|e| format!("DB error: {}", e))?;
    Ok(tags)
}

#[tauri::command]
pub async fn ai_summarize_clip(id: String, state: State<'_, AppState>) -> Result<String, String> {
    let clip = state.db.get_clip(&id)
        .map_err(|e| format!("DB error: {}", e))?
        .ok_or_else(|| format!("Clip not found: {}", id))?;
    let app_settings = settings::get_settings(&state.db)?;
    let provider = ai::AiProvider::from_settings(&app_settings, &state.db);
    let content = clip.markdown.as_deref().unwrap_or("");
    let summary = ai::auto_summarize(content, &provider).await?;
    // Update clip in DB
    let mut updated = clip;
    updated.summary = Some(summary.clone());
    updated.updated_at = Some(chrono::Utc::now().to_rfc3339());
    state.db.update_clip(&updated).map_err(|e| format!("DB error: {}", e))?;
    Ok(summary)
}

#[tauri::command]
pub async fn chat_ask(question: String, state: State<'_, AppState>) -> Result<ai::ChatResponse, String> {
    let app_settings = settings::get_settings(&state.db)?;
    let provider = ai::AiProvider::from_settings(&app_settings, &state.db);
    let engine = state.search_engine.as_ref().ok_or("Search not initialized")?;
    let response = ai::ask_yoinks(&question, engine, &provider, &state.db).await?;

    // Save to chat_messages table
    let user_msg = crate::db::ChatMessage {
        id: uuid::Uuid::new_v4().to_string(),
        role: "user".to_string(),
        content: question,
        sources: "[]".to_string(),
        created_at: chrono::Utc::now().to_rfc3339(),
    };
    let _ = state.db.insert_chat_message(&user_msg);

    let assistant_msg = crate::db::ChatMessage {
        id: uuid::Uuid::new_v4().to_string(),
        role: "assistant".to_string(),
        content: response.answer.clone(),
        sources: serde_json::to_string(&response.source_ids).unwrap_or_else(|_| "[]".to_string()),
        created_at: chrono::Utc::now().to_rfc3339(),
    };
    let _ = state.db.insert_chat_message(&assistant_msg);

    Ok(response)
}

#[tauri::command]
pub fn chat_history(limit: Option<usize>, state: State<'_, AppState>) -> Result<Vec<crate::db::ChatMessage>, String> {
    state.db.list_chat_messages(limit.unwrap_or(50)).map_err(|e| format!("DB error: {}", e))
}

#[tauri::command]
pub fn chat_clear(state: State<'_, AppState>) -> Result<(), String> {
    state.db.clear_chat_history().map_err(|e| format!("DB error: {}", e))
}

#[tauri::command]
pub async fn structure_transcript_cmd(transcript: String, state: State<'_, AppState>) -> Result<Clip, String> {
    let app_settings = settings::get_settings(&state.db)?;
    let provider = ai::AiProvider::from_settings(&app_settings, &state.db);
    let structured = ai::structure_transcript(&transcript, &provider).await?;

    let clip = Clip {
        id: Uuid::new_v4().to_string(),
        url: "transcript".to_string(),
        title: Some("Structured Notes".to_string()),
        markdown: Some(structured),
        html: None,
        summary: None,
        tags: "[]".to_string(),
        source_type: "transcript".to_string(),
        vault_path: None,
        created_at: chrono::Utc::now().to_rfc3339(),
        updated_at: None,
    };
    state.db.insert_clip(&clip).map_err(|e| format!("DB error: {}", e))?;
    Ok(clip)
}

#[tauri::command]
pub fn export_clip_notebooklm(id: String, export_dir: String, state: State<'_, AppState>) -> Result<String, String> {
    let clip = state.db.get_clip(&id)
        .map_err(|e| format!("DB error: {}", e))?
        .ok_or_else(|| format!("Clip not found: {}", id))?;
    crate::notebooklm::export_for_notebooklm(&clip, &export_dir)
}

#[tauri::command]
pub fn export_batch_notebooklm(ids: Vec<String>, export_dir: String, batch_name: String, state: State<'_, AppState>) -> Result<String, String> {
    let mut clips = Vec::new();
    for id in &ids {
        let clip = state.db.get_clip(id)
            .map_err(|e| format!("DB error: {}", e))?
            .ok_or_else(|| format!("Clip not found: {}", id))?;
        clips.push(clip);
    }
    crate::notebooklm::export_batch_for_notebooklm(&clips, &export_dir, &batch_name)
}

// Monitor commands

#[tauri::command]
pub fn create_monitor(url: String, state: State<'_, AppState>) -> Result<String, String> {
    let app_settings = crate::settings::get_settings(&state.db)?;
    if !app_settings.pro_unlocked {
        return Err("Pro required for this feature".to_string());
    }

    let monitor = crate::db::Monitor {
        id: Uuid::new_v4().to_string(),
        url,
        last_hash: None,
        last_checked: None,
        change_detected: 0,
        notify: 1,
        created_at: chrono::Utc::now().to_rfc3339(),
    };
    state.db.insert_monitor(&monitor).map_err(|e| format!("DB error: {}", e))?;
    Ok(monitor.id)
}

#[tauri::command]
pub fn list_monitors(state: State<'_, AppState>) -> Result<Vec<crate::db::Monitor>, String> {
    state.db.list_monitors().map_err(|e| format!("DB error: {}", e))
}

#[tauri::command]
pub fn delete_monitor(id: String, state: State<'_, AppState>) -> Result<(), String> {
    state.db.delete_monitor(&id).map_err(|e| format!("DB error: {}", e))
}

#[tauri::command]
pub async fn check_monitor(id: String, state: State<'_, AppState>) -> Result<bool, String> {
    let monitor = state.db.get_monitor(&id)
        .map_err(|e| format!("DB error: {}", e))?
        .ok_or_else(|| format!("Monitor not found: {}", id))?;
    crate::monitor::check_for_changes(&monitor, &state.db).await
}

#[tauri::command]
pub async fn generate_digest(state: State<'_, AppState>) -> Result<Clip, String> {
    let app_settings = settings::get_settings(&state.db)?;
    let provider = ai::AiProvider::from_settings(&app_settings, &state.db);
    let clips = state.db.list_clips().map_err(|e| format!("DB error: {}", e))?;
    let downloads = state.db.list_downloads().map_err(|e| format!("DB error: {}", e))?;

    let digest_md = ai::generate_digest(&clips, &downloads, &provider).await?;

    // Save as a clip with source_type = "digest"
    let clip = Clip {
        id: Uuid::new_v4().to_string(),
        url: "digest".to_string(),
        title: Some(format!("Weekly Digest - {}", chrono::Utc::now().format("%Y-%m-%d"))),
        markdown: Some(digest_md),
        html: None,
        summary: None,
        tags: "[\"digest\"]".to_string(),
        source_type: "digest".to_string(),
        vault_path: None,
        created_at: chrono::Utc::now().to_rfc3339(),
        updated_at: None,
    };
    state.db.insert_clip(&clip).map_err(|e| format!("DB error: {}", e))?;
    Ok(clip)
}

// Schedule commands

#[tauri::command]
pub fn create_schedule(url: String, job_type: String, cron: String, flags: Option<String>, state: State<'_, AppState>) -> Result<String, String> {
    let app_settings = crate::settings::get_settings(&state.db)?;
    if !app_settings.pro_unlocked {
        return Err("Pro required for this feature".to_string());
    }

    let schedule = crate::db::Schedule {
        id: Uuid::new_v4().to_string(),
        url,
        job_type,
        cron: Some(cron),
        flags: flags.unwrap_or_default(),
        enabled: 1,
        last_run: None,
        next_run: None,
        created_at: chrono::Utc::now().to_rfc3339(),
    };
    state.db.insert_schedule(&schedule).map_err(|e| format!("DB error: {}", e))?;
    Ok(schedule.id)
}

#[tauri::command]
pub fn list_schedules(state: State<'_, AppState>) -> Result<Vec<crate::db::Schedule>, String> {
    state.db.list_schedules().map_err(|e| format!("DB error: {}", e))
}

#[tauri::command]
pub fn delete_schedule(id: String, state: State<'_, AppState>) -> Result<(), String> {
    state.db.delete_schedule(&id).map_err(|e| format!("DB error: {}", e))
}

#[tauri::command]
pub fn toggle_schedule(id: String, enabled: bool, state: State<'_, AppState>) -> Result<(), String> {
    let mut schedule = state.db.list_schedules()
        .map_err(|e| format!("DB error: {}", e))?
        .into_iter()
        .find(|s| s.id == id)
        .ok_or_else(|| format!("Schedule not found: {}", id))?;
    schedule.enabled = if enabled { 1 } else { 0 };
    state.db.update_schedule(&schedule).map_err(|e| format!("DB error: {}", e))
}

// Gallery commands

#[tauri::command]
pub fn list_gallery(limit: Option<i64>, offset: Option<i64>, state: State<'_, AppState>) -> Result<Vec<crate::db::GalleryItem>, String> {
    state.db.list_gallery_items(limit.unwrap_or(50), offset.unwrap_or(0))
        .map_err(|e| format!("DB error: {}", e))
}

#[tauri::command]
pub fn gallery_count(state: State<'_, AppState>) -> Result<i64, String> {
    state.db.count_gallery_items().map_err(|e| format!("DB error: {}", e))
}

#[tauri::command]
pub fn update_gallery_item(item_id: String, item_type: String, collection_id: Option<String>, tags: String, flag: String, state: State<'_, AppState>) -> Result<(), String> {
    state.db.update_gallery_meta(&item_id, &item_type, collection_id.as_deref(), &tags, &flag)
        .map_err(|e| format!("DB error: {}", e))
}

// Collection commands

#[tauri::command]
pub fn create_collection(name: String, color: Option<String>, state: State<'_, AppState>) -> Result<crate::db::Collection, String> {
    let collection = crate::db::Collection {
        id: uuid::Uuid::new_v4().to_string(),
        name,
        color,
        position: 0,
        created_at: chrono::Utc::now().to_rfc3339(),
    };
    state.db.insert_collection(&collection).map_err(|e| format!("DB error: {}", e))?;
    Ok(collection)
}

#[tauri::command]
pub fn list_collections_cmd(state: State<'_, AppState>) -> Result<Vec<crate::db::Collection>, String> {
    state.db.list_collections().map_err(|e| format!("DB error: {}", e))
}

#[tauri::command]
pub fn delete_collection_cmd(id: String, state: State<'_, AppState>) -> Result<(), String> {
    state.db.delete_collection(&id).map_err(|e| format!("DB error: {}", e))
}

// License activation

#[tauri::command]
pub async fn activate_license(license_key: String, state: State<'_, AppState>) -> Result<crate::license::ActivationResult, String> {
    let result = crate::license::activate_license(&license_key).await?;
    if result.success {
        let mut settings = crate::settings::get_settings(&state.db)?;
        settings.pro_unlocked = true;
        settings.license_key = license_key;
        settings.pro_since = chrono::Utc::now().to_rfc3339();
        crate::settings::update_settings(&state.db, &settings)?;
    }
    Ok(result)
}

// Legal consent

const TOS_VERSION: &str = "1.0";

#[tauri::command]
pub fn check_consent(state: State<'_, AppState>) -> Result<bool, String> {
    state.db.has_valid_consent(TOS_VERSION).map_err(|e| format!("DB error: {}", e))
}

#[tauri::command]
pub fn accept_consent(state: State<'_, AppState>) -> Result<(), String> {
    state.db.record_consent(TOS_VERSION).map_err(|e| format!("DB error: {}", e))
}

// Save link (bookmark/citation) without downloading

#[tauri::command]
pub async fn save_link(
    state: State<'_, AppState>,
    url: String,
    notes: Option<String>,
) -> Result<Clip, String> {
    // Fetch page metadata
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let resp = client.get(&url)
        .header("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch URL: {}", e))?;

    let html = resp.text().await.map_err(|e| format!("Failed to read response: {}", e))?;

    // Extract title and description
    let title = extract_meta_title(&html);
    let description = extract_meta_description(&html);

    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    let clip = Clip {
        id: id.clone(),
        url: url.clone(),
        title: Some(title.unwrap_or_else(|| url.clone())),
        markdown: notes,
        html: Some(description.unwrap_or_default()),
        summary: None,
        tags: String::new(),
        source_type: "link".to_string(),
        vault_path: None,
        created_at: now.clone(),
        updated_at: None,
    };

    state.db.insert_clip(&clip).map_err(|e| format!("DB error: {}", e))?;

    Ok(clip)
}

fn extract_meta_title(html: &str) -> Option<String> {
    let lower = html.to_lowercase();
    if let Some(start) = lower.find("<title") {
        if let Some(gt) = html[start..].find('>') {
            let after = &html[start + gt + 1..];
            if let Some(end) = after.find("</") {
                let title = after[..end].trim();
                if !title.is_empty() {
                    return Some(title.to_string());
                }
            }
        }
    }
    None
}

fn extract_meta_description(html: &str) -> Option<String> {
    let lower = html.to_lowercase();
    let patterns = ["name=\"description\"", "name='description'", "property=\"og:description\""];
    for pattern in patterns {
        if let Some(pos) = lower.find(pattern) {
            let region = &html[pos.saturating_sub(200)..std::cmp::min(pos + 500, html.len())];
            let region_lower = region.to_lowercase();
            if let Some(content_pos) = region_lower.find("content=\"") {
                let after = &region[content_pos + 9..];
                if let Some(end) = after.find('"') {
                    let desc = &after[..end];
                    if !desc.is_empty() {
                        return Some(desc.to_string());
                    }
                }
            }
        }
    }
    None
}
