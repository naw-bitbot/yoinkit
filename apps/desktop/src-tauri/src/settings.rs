use crate::db::Database;
use serde::{Serialize, Deserialize};
use std::sync::Arc;

#[derive(Debug, Serialize, Deserialize)]
pub struct AppSettings {
    pub default_save_path: String,
    pub one_click_mode: String,
    pub max_concurrent: u32,
    pub pro_unlocked: bool,
    pub obsidian_vault_path: String,
    pub obsidian_attachments_folder: String,
    pub auto_tag: bool,
    pub auto_summarize: bool,
    pub ai_provider: String,
    pub ai_api_key_configured: bool,
    pub ai_model: String,
    pub clip_on_download: bool,
    pub bandwidth_limit: u32,
    pub license_key: String,
    pub pro_since: String,
    pub gallery_view: String,
}

pub fn get_settings(db: &Arc<Database>) -> Result<AppSettings, String> {
    let get = |key: &str, default: &str| -> String {
        db.get_setting(key)
            .ok()
            .flatten()
            .unwrap_or_else(|| default.to_string())
    };

    Ok(AppSettings {
        default_save_path: get("default_save_path", "~/Downloads/Yoinkit"),
        one_click_mode: get("one_click_mode", "current_page"),
        max_concurrent: get("max_concurrent", "3").parse().unwrap_or(3),
        pro_unlocked: get("pro_unlocked", "false") == "true",
        obsidian_vault_path: get("obsidian_vault_path", ""),
        obsidian_attachments_folder: get("obsidian_attachments_folder", "assets/yoinkit"),
        auto_tag: get("auto_tag", "false") == "true",
        auto_summarize: get("auto_summarize", "false") == "true",
        ai_provider: get("ai_provider", "none"),
        ai_api_key_configured: get("ai_api_key_configured", "false") == "true",
        ai_model: get("ai_model", ""),
        clip_on_download: get("clip_on_download", "false") == "true",
        bandwidth_limit: get("bandwidth_limit", "0").parse().unwrap_or(0),
        license_key: get("license_key", ""),
        pro_since: get("pro_since", ""),
        gallery_view: get("gallery_view", "grid"),
    })
}

pub fn update_settings(db: &Arc<Database>, settings: &AppSettings) -> Result<(), String> {
    let set = |key: &str, value: &str| -> Result<(), String> {
        db.set_setting(key, value).map_err(|e| format!("Failed to set {}: {}", key, e))
    };

    set("default_save_path", &settings.default_save_path)?;
    set("one_click_mode", &settings.one_click_mode)?;
    set("max_concurrent", &settings.max_concurrent.to_string())?;
    set("pro_unlocked", if settings.pro_unlocked { "true" } else { "false" })?;
    set("obsidian_vault_path", &settings.obsidian_vault_path)?;
    set("obsidian_attachments_folder", &settings.obsidian_attachments_folder)?;
    set("auto_tag", if settings.auto_tag { "true" } else { "false" })?;
    set("auto_summarize", if settings.auto_summarize { "true" } else { "false" })?;
    set("ai_provider", &settings.ai_provider)?;
    set("ai_api_key_configured", if settings.ai_api_key_configured { "true" } else { "false" })?;
    set("ai_model", &settings.ai_model)?;
    set("clip_on_download", if settings.clip_on_download { "true" } else { "false" })?;
    set("bandwidth_limit", &settings.bandwidth_limit.to_string())?;
    set("license_key", &settings.license_key)?;
    set("pro_since", &settings.pro_since)?;
    set("gallery_view", &settings.gallery_view)?;
    Ok(())
}
