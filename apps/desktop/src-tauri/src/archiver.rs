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
