use crate::db::{Database, Preset};
use crate::download_manager::DownloadManager;
use crate::settings::{self, AppSettings};
use crate::wget::WgetFlags;
use std::sync::Arc;
use tauri::State;
use uuid::Uuid;

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
