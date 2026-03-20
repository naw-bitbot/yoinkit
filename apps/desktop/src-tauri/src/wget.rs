use std::path::PathBuf;
use std::process::Stdio;
use tokio::process::{Child, Command};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::sync::mpsc;
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WgetProgress {
    pub percentage: f64,
    pub speed: Option<String>,
    pub eta: Option<String>,
    pub file_size: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WgetFlags {
    // Basic
    pub recursive: Option<bool>,
    pub depth: Option<u32>,
    pub convert_links: Option<bool>,
    pub page_requisites: Option<bool>,
    pub no_parent: Option<bool>,
    // Filtering
    pub accept: Option<String>,        // file type filter e.g. "*.pdf,*.doc"
    pub reject: Option<String>,
    // Rate & limits
    pub limit_rate: Option<String>,    // e.g. "200k"
    pub wait: Option<f64>,             // seconds between requests
    pub random_wait: Option<bool>,
    // Auth
    pub user: Option<String>,
    pub password: Option<String>,
    pub header: Option<Vec<String>>,
    // Resume
    pub continue_download: Option<bool>,
    // Mirror
    pub mirror: Option<bool>,
    pub timestamping: Option<bool>,
    // Output
    pub output_document: Option<String>,
    pub directory_prefix: Option<String>,
    // Misc
    pub user_agent: Option<String>,
    pub no_check_certificate: Option<bool>,
    pub timeout: Option<u32>,
    pub tries: Option<u32>,
    pub quiet: Option<bool>,
}

impl WgetFlags {
    pub fn to_args(&self) -> Vec<String> {
        let mut args = Vec::new();

        if self.recursive == Some(true) { args.push("--recursive".to_string()); }
        if let Some(d) = self.depth { args.push(format!("--level={}", d)); }
        if self.convert_links == Some(true) { args.push("--convert-links".to_string()); }
        if self.page_requisites == Some(true) { args.push("--page-requisites".to_string()); }
        if self.no_parent == Some(true) { args.push("--no-parent".to_string()); }
        if let Some(ref a) = self.accept { args.push(format!("--accept={}", a)); }
        if let Some(ref r) = self.reject { args.push(format!("--reject={}", r)); }
        if let Some(ref l) = self.limit_rate { args.push(format!("--limit-rate={}", l)); }
        if let Some(w) = self.wait { args.push(format!("--wait={}", w)); }
        if self.random_wait == Some(true) { args.push("--random-wait".to_string()); }
        if let Some(ref u) = self.user { args.push(format!("--user={}", u)); }
        if let Some(ref p) = self.password { args.push(format!("--password={}", p)); }
        if let Some(ref headers) = self.header {
            for h in headers { args.push(format!("--header={}", h)); }
        }
        if self.continue_download == Some(true) { args.push("--continue".to_string()); }
        if self.mirror == Some(true) { args.push("--mirror".to_string()); }
        if self.timestamping == Some(true) { args.push("--timestamping".to_string()); }
        if let Some(ref o) = self.output_document { args.push(format!("--output-document={}", o)); }
        if let Some(ref d) = self.directory_prefix { args.push(format!("--directory-prefix={}", d)); }
        if let Some(ref ua) = self.user_agent { args.push(format!("--user-agent={}", ua)); }
        if self.no_check_certificate == Some(true) { args.push("--no-check-certificate".to_string()); }
        if let Some(t) = self.timeout { args.push(format!("--timeout={}", t)); }
        if let Some(t) = self.tries { args.push(format!("--tries={}", t)); }
        if self.quiet == Some(true) { args.push("--quiet".to_string()); }

        args
    }
}

impl Default for WgetFlags {
    fn default() -> Self {
        Self {
            recursive: None, depth: None, convert_links: None,
            page_requisites: None, no_parent: None, accept: None,
            reject: None, limit_rate: None, wait: None, random_wait: None,
            user: None, password: None, header: None,
            continue_download: None, mirror: None, timestamping: None,
            output_document: None, directory_prefix: None,
            user_agent: None, no_check_certificate: None,
            timeout: None, tries: None, quiet: None,
        }
    }
}

pub fn wget_binary_path() -> PathBuf {
    // In production: bundled in app resources
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()));

    if let Some(dir) = exe_dir {
        // Check for bundled binary in Resources (macOS app bundle)
        let bundle_path = dir.join("../Resources/bin/wget");
        if bundle_path.exists() {
            return bundle_path;
        }
        // Dev mode: check src-tauri/bin
        let dev_path = dir.join("bin/wget");
        if dev_path.exists() {
            return dev_path;
        }
    }

    // Fallback: system wget
    PathBuf::from("/usr/local/bin/wget")
}

pub async fn spawn_wget(
    url: &str,
    flags: &WgetFlags,
    save_dir: &str,
) -> Result<(Child, mpsc::Receiver<WgetProgress>), String> {
    // Basic URL validation
    if !url.starts_with("http://") && !url.starts_with("https://") && !url.starts_with("ftp://") {
        return Err("Invalid URL: must start with http://, https://, or ftp://".to_string());
    }

    let wget_path = wget_binary_path();

    let mut cmd = Command::new(&wget_path);
    let flag_args = flags.to_args();
    let has_dir_prefix = flag_args.iter().any(|a| a.starts_with("--directory-prefix"));
    cmd.arg("--progress=dot:default")
        .args(&flag_args);
    if !has_dir_prefix {
        cmd.arg(format!("--directory-prefix={}", save_dir));
    }
    cmd.arg(url)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn wget: {}", e))?;

    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;
    let (tx, rx) = mpsc::channel(100);

    tokio::spawn(async move {
        let reader = BufReader::new(stderr);
        let mut lines = reader.lines();

        while let Ok(Some(line)) = lines.next_line().await {
            if let Some(progress) = parse_wget_progress(&line) {
                let _ = tx.send(progress).await;
            }
        }
    });

    Ok((child, rx))
}

fn parse_wget_progress(line: &str) -> Option<WgetProgress> {
    // Parse wget progress output
    // Wget outputs lines like: "     0K .......... .......... .......... .......... ..........  1% 1.23M 2m30s"
    // Or percentage lines like: " 50% [======>     ] 1,234,567   1.23M/s  eta 2m 30s"

    let trimmed = line.trim();

    // Try to find percentage pattern
    if let Some(pct_pos) = trimmed.find('%') {
        let before_pct = &trimmed[..pct_pos];
        // Get the last number before %
        let num_str: String = before_pct.chars().rev().take_while(|c| c.is_ascii_digit()).collect::<String>().chars().rev().collect();
        if let Ok(pct) = num_str.parse::<f64>() {
            let speed = extract_speed(trimmed);
            let eta = extract_eta(trimmed);
            return Some(WgetProgress {
                percentage: pct,
                speed,
                eta,
                file_size: None,
            });
        }
    }
    None
}

fn extract_speed(line: &str) -> Option<String> {
    // Look for patterns like "1.23M/s" or "1.23MB/s" or "500K"
    let parts: Vec<&str> = line.split_whitespace().collect();
    for part in &parts {
        if (part.contains("K/s") || part.contains("M/s") || part.contains("G/s")
            || part.contains("KB/s") || part.contains("MB/s") || part.contains("GB/s"))
        {
            return Some(part.to_string());
        }
    }
    // Wget dot format: speed is second to last field
    if let Some(part) = parts.iter().rev().nth(1) {
        if part.contains('K') || part.contains('M') || part.contains('G') {
            return Some(format!("{}/s", part));
        }
    }
    None
}

fn extract_eta(line: &str) -> Option<String> {
    let parts: Vec<&str> = line.split_whitespace().collect();
    // ETA is typically the last field, like "2m30s" or "eta 2m 30s"
    if let Some(last) = parts.last() {
        if last.contains('m') || last.contains('s') || last.contains('h') {
            if last.chars().any(|c| c.is_ascii_digit()) {
                return Some(last.to_string());
            }
        }
    }
    None
}
