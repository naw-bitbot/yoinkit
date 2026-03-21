use crate::db::{Database, Monitor};
use sha2::{Sha256, Digest};

/// Check a single monitored URL for changes
pub async fn check_for_changes(monitor: &Monitor, db: &Database) -> Result<bool, String> {
    // 1. Fetch the page
    let html = crate::clipper::fetch_page(&monitor.url).await?;

    // 2. Extract readable content
    let content = crate::clipper::extract_readable(&html, &monitor.url)
        .map(|c| c.content_html)
        .unwrap_or_else(|_| html.clone());

    // 3. Hash the content
    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    let hash = format!("{:x}", hasher.finalize());

    // 4. Compare to stored hash
    let changed = monitor.last_hash.as_ref() != Some(&hash);

    // 5. Update the monitor record
    let mut updated = monitor.clone();
    updated.last_hash = Some(hash);
    updated.last_checked = Some(chrono::Utc::now().to_rfc3339());
    updated.change_detected = if changed { 1 } else { 0 };
    db.update_monitor(&updated).map_err(|e| format!("DB error: {}", e))?;

    Ok(changed)
}

/// Check all active monitors
pub async fn check_all_monitors(db: &Database) -> Result<Vec<(String, bool)>, String> {
    let monitors = db.list_monitors().map_err(|e| format!("DB error: {}", e))?;
    let mut results = Vec::new();

    for monitor in &monitors {
        match check_for_changes(monitor, db).await {
            Ok(changed) => results.push((monitor.url.clone(), changed)),
            Err(e) => {
                eprintln!("Monitor check failed for {}: {}", monitor.url, e);
                results.push((monitor.url.clone(), false));
            }
        }
    }

    Ok(results)
}
