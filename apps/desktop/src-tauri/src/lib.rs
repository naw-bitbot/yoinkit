mod api;
mod auth;
mod commands;
mod db;
mod download_manager;
mod settings;
mod tray;
mod wget;

use auth::AuthManager;
use commands::AppState;
use db::Database;
use download_manager::DownloadManager;
use std::sync::Arc;

pub fn run() {
    let db = Arc::new(Database::new().expect("Failed to initialize database"));
    let download_manager = Arc::new(DownloadManager::new(db.clone()));
    let auth = Arc::new(AuthManager::new());

    let app_state = Arc::new(AppState {
        db: db.clone(),
        download_manager: download_manager.clone(),
    });

    // Clone for API server
    let api_state = app_state.clone();
    let api_auth = auth.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage((*app_state).clone())
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
