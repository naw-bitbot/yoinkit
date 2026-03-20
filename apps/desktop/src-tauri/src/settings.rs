use crate::db::Database;
use serde::{Serialize, Deserialize};
use std::sync::Arc;

#[derive(Debug, Serialize, Deserialize)]
pub struct AppSettings {
    pub default_save_path: String,
    pub one_click_mode: String,
    pub max_concurrent: u32,
    pub pro_unlocked: bool,
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
    Ok(())
}
