mod ai;
mod api;
mod archiver;
mod auth;
mod commands;
mod db;
mod download_manager;
mod markdown;
mod search;
mod settings;
mod tray;
mod wget;
mod ytdlp;
mod image_scraper;
mod clipper;
mod mcp_server;
mod notebooklm;

use auth::AuthManager;
use commands::AppState;
use db::Database;
use download_manager::DownloadManager;
use std::sync::Arc;

pub fn run() {
    let db = Arc::new(Database::new().expect("Failed to initialize database"));
    let download_manager = Arc::new(DownloadManager::new(db.clone()));
    let auth = Arc::new(AuthManager::new());

    let search_engine = {
        let mut index_path = dirs::data_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
        index_path.push("Yoinkit");
        index_path.push("search_index");
        match search::SearchEngine::new(&index_path.to_string_lossy()) {
            Ok(engine) => Some(Arc::new(engine)),
            Err(e) => {
                eprintln!("Warning: Search engine failed to initialize: {}", e);
                None
            }
        }
    };

    let app_state = Arc::new(AppState {
        db: db.clone(),
        download_manager: download_manager.clone(),
        auth_token: auth.get_token(),
        search_engine,
    });

    // Clone for API server
    let api_state = app_state.clone();
    let api_auth = auth.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(app_state.as_ref().clone())
        .setup(|app| {
            // Set up tray
            tray::setup_tray(app)?;

            // Start REST API server
            tauri::async_runtime::spawn(async move {
                api::start_api_server(api_state, api_auth).await;
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::start_download,
            commands::pause_download,
            commands::resume_download,
            commands::cancel_download,
            commands::get_download,
            commands::list_downloads,
            commands::delete_download,
            commands::get_settings,
            commands::update_settings,
            commands::save_preset,
            commands::list_presets,
            commands::delete_preset,
            commands::get_auth_token,
            commands::get_video_info,
            commands::start_video_download,
            commands::start_audio_download,
            commands::download_subtitles,
            commands::scrape_images,
            commands::download_images,
            commands::clip_url,
            commands::clip_html,
            commands::list_clips,
            commands::get_clip,
            commands::delete_clip,
            commands::update_clip_tags,
            commands::export_clip_to_vault,
            commands::archive_url,
            commands::check_link_status,
            commands::check_all_archived_links,
            commands::search_yoinks,
            commands::rebuild_search_index,
            commands::ai_tag_clip,
            commands::ai_summarize_clip,
            commands::chat_ask,
            commands::chat_history,
            commands::chat_clear,
            commands::structure_transcript_cmd,
            commands::export_clip_notebooklm,
            commands::export_batch_notebooklm,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
