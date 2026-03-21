use std::path::PathBuf;
use std::process::Command;

/// Archive a web page into a single self-contained HTML file using monolith.
pub async fn archive_page(url: &str, save_dir: &str) -> Result<String, String> {
    let save_path = shellexpand::tilde(save_dir).to_string();
    std::fs::create_dir_all(&save_path).map_err(|e| format!("Failed to create dir: {}", e))?;

    let filename = sanitize_filename(url);
    let output_path = format!("{}/{}.html", save_path, filename);

    let monolith = monolith_binary_path();

    let output = Command::new(&monolith)
        .args([url, "-o", &output_path, "-I", "-j", "-t", "30"])
        .output()
        .map_err(|e| {
            format!(
                "Failed to run monolith: {}. Is it installed at {:?}?",
                e, monolith
            )
        })?;

    if !output.status.success() {
        return Err(format!(
            "monolith failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    Ok(output_path)
}

/// Get the file size of an archived page in bytes.
pub fn archive_size(path: &str) -> Option<u64> {
    std::fs::metadata(path).ok().map(|m| m.len())
}

fn monolith_binary_path() -> PathBuf {
    // Check bundled binary location first (Tauri sidecar pattern)
    let bundled = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.join("monolith")));

    if let Some(path) = bundled {
        if path.exists() {
            return path;
        }
    }

    // Fall back to system PATH
    PathBuf::from("monolith")
}

/// Check if a URL is still alive (returns HTTP status)
pub async fn check_link(url: &str) -> Result<LinkStatus, String> {
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;

    match client.head(url).send().await {
        Ok(resp) => {
            let status = resp.status().as_u16();
            let alive = status < 400;
            Ok(LinkStatus { url: url.to_string(), status, alive })
        }
        Err(_e) => {
            // Timeout or connection refused = possibly dead
            Ok(LinkStatus { url: url.to_string(), status: 0, alive: false })
        }
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct LinkStatus {
    pub url: String,
    pub status: u16,
    pub alive: bool,
}

/// Check all archived clips for link rot. Returns dead links.
pub async fn check_all_links(clips: &[crate::db::Clip]) -> Vec<LinkStatus> {
    let mut results = Vec::new();
    for clip in clips.iter().filter(|c| c.source_type == "archive") {
        if let Ok(status) = check_link(&clip.url).await {
            if !status.alive {
                results.push(status);
            }
        }
    }
    results
}

fn sanitize_filename(url: &str) -> String {
    // Strip protocol, replace non-alphanumeric with dashes, truncate
    let cleaned = url
        .replace("https://", "")
        .replace("http://", "")
        .replace("www.", "");

    let sanitized: String = cleaned
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '.' {
                c
            } else {
                '-'
            }
        })
        .collect();

    // Truncate to reasonable length
    let truncated = if sanitized.len() > 100 {
        sanitized[..100].to_string()
    } else {
        sanitized
    };

    // Remove trailing dashes
    truncated.trim_end_matches('-').to_string()
}
