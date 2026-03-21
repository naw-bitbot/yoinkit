use serde::{Serialize, Deserialize};
use std::process::Stdio;
use tokio::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScrapedImage {
    pub url: String,
    pub alt: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub file_type: Option<String>,
}

/// Scrape images from a webpage using wget to fetch HTML, then parse it
pub async fn scrape_images(page_url: &str) -> Result<Vec<ScrapedImage>, String> {
    // Use wget to fetch the page HTML
    let wget_path = crate::wget::wget_binary_path();
    let output = Command::new(&wget_path)
        .args([
            "--quiet",
            "--output-document=-",
            "--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            page_url,
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .output()
        .await
        .map_err(|e| format!("Failed to fetch page: {}", e))?;

    if !output.status.success() {
        return Err("Failed to fetch page".to_string());
    }

    let html = String::from_utf8_lossy(&output.stdout).to_string();
    let base_url = extract_base_url(page_url);
    let images = parse_images_from_html(&html, &base_url);

    Ok(images)
}

fn extract_base_url(url: &str) -> String {
    // Extract scheme + host from URL
    if let Some(pos) = url.find("://") {
        let after_scheme = &url[pos + 3..];
        if let Some(slash_pos) = after_scheme.find('/') {
            return url[..pos + 3 + slash_pos].to_string();
        }
    }
    url.to_string()
}

fn parse_images_from_html(html: &str, base_url: &str) -> Vec<ScrapedImage> {
    let mut images = Vec::new();
    let mut seen_urls = std::collections::HashSet::new();

    // Parse <img> tags
    let img_re_src = regex_lite::Regex::new(r#"<img[^>]+src\s*=\s*["']([^"']+)["']"#).unwrap();
    let img_re_alt = regex_lite::Regex::new(r#"alt\s*=\s*["']([^"']*)["']"#).unwrap();
    let img_re_width = regex_lite::Regex::new(r#"width\s*=\s*["']?(\d+)"#).unwrap();
    let img_re_height = regex_lite::Regex::new(r#"height\s*=\s*["']?(\d+)"#).unwrap();

    for cap in img_re_src.captures_iter(html) {
        let raw_url = cap[1].to_string();
        let full_url = resolve_url(&raw_url, base_url);

        if seen_urls.contains(&full_url) {
            continue;
        }
        seen_urls.insert(full_url.clone());

        // Get surrounding context for alt/width/height
        let img_tag_start = cap.get(0).unwrap().start();
        let img_tag_end = html[img_tag_start..].find('>').map(|p| img_tag_start + p + 1).unwrap_or(cap.get(0).unwrap().end());
        let img_tag = &html[img_tag_start..img_tag_end];

        let alt = img_re_alt.captures(img_tag).map(|c| c[1].to_string());
        let width = img_re_width.captures(img_tag).and_then(|c| c[1].parse().ok());
        let height = img_re_height.captures(img_tag).and_then(|c| c[1].parse().ok());

        let file_type = detect_image_type(&full_url);

        images.push(ScrapedImage {
            url: full_url,
            alt,
            width,
            height,
            file_type,
        });
    }

    // Parse CSS background-image
    let bg_re = regex_lite::Regex::new(r#"background-image\s*:\s*url\s*\(\s*["']?([^"')]+)["']?\s*\)"#).unwrap();
    for cap in bg_re.captures_iter(html) {
        let raw_url = cap[1].to_string();
        let full_url = resolve_url(&raw_url, base_url);

        if seen_urls.contains(&full_url) {
            continue;
        }
        seen_urls.insert(full_url.clone());

        images.push(ScrapedImage {
            url: full_url,
            alt: None,
            width: None,
            height: None,
            file_type: detect_image_type(&cap[1]),
        });
    }

    // Parse <source> tags in <picture> elements
    let source_re = regex_lite::Regex::new(r#"<source[^>]+srcset\s*=\s*["']([^"']+)["']"#).unwrap();
    for cap in source_re.captures_iter(html) {
        // srcset can have multiple URLs with sizes, take the first
        let srcset = &cap[1];
        let first_url = srcset.split(',').next().unwrap_or("").trim().split_whitespace().next().unwrap_or("");
        if first_url.is_empty() {
            continue;
        }
        let full_url = resolve_url(first_url, base_url);

        if seen_urls.contains(&full_url) {
            continue;
        }
        seen_urls.insert(full_url.clone());

        images.push(ScrapedImage {
            url: full_url,
            alt: None,
            width: None,
            height: None,
            file_type: detect_image_type(first_url),
        });
    }

    // Parse data-src (lazy loading)
    let datasrc_re = regex_lite::Regex::new(r#"data-src\s*=\s*["']([^"']+)["']"#).unwrap();
    for cap in datasrc_re.captures_iter(html) {
        let raw_url = cap[1].to_string();
        if !looks_like_image_url(&raw_url) {
            continue;
        }
        let full_url = resolve_url(&raw_url, base_url);
        if seen_urls.contains(&full_url) {
            continue;
        }
        seen_urls.insert(full_url.clone());

        images.push(ScrapedImage {
            url: full_url,
            alt: None,
            width: None,
            height: None,
            file_type: detect_image_type(&raw_url),
        });
    }

    images
}

fn resolve_url(raw: &str, base_url: &str) -> String {
    if raw.starts_with("http://") || raw.starts_with("https://") {
        return raw.to_string();
    }
    if raw.starts_with("//") {
        return format!("https:{}", raw);
    }
    if raw.starts_with('/') {
        return format!("{}{}", base_url, raw);
    }
    format!("{}/{}", base_url, raw)
}

fn detect_image_type(url: &str) -> Option<String> {
    let lower = url.to_lowercase();
    let path = lower.split('?').next().unwrap_or(&lower);
    if path.ends_with(".jpg") || path.ends_with(".jpeg") { Some("JPEG".to_string()) }
    else if path.ends_with(".png") { Some("PNG".to_string()) }
    else if path.ends_with(".gif") { Some("GIF".to_string()) }
    else if path.ends_with(".webp") { Some("WebP".to_string()) }
    else if path.ends_with(".svg") { Some("SVG".to_string()) }
    else if path.ends_with(".bmp") { Some("BMP".to_string()) }
    else if path.ends_with(".ico") { Some("ICO".to_string()) }
    else if path.ends_with(".avif") { Some("AVIF".to_string()) }
    else { None }
}

fn looks_like_image_url(url: &str) -> bool {
    let lower = url.to_lowercase();
    let path = lower.split('?').next().unwrap_or(&lower);
    let extensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".ico", ".avif"];
    extensions.iter().any(|ext| path.ends_with(ext))
}

/// Download specific images using wget
pub async fn download_images(
    image_urls: Vec<String>,
    save_dir: &str,
) -> Result<(), String> {
    let wget_path = crate::wget::wget_binary_path();
    let expanded = shellexpand::tilde(save_dir).to_string();
    std::fs::create_dir_all(&expanded).map_err(|e| format!("Failed to create dir: {}", e))?;

    for url in &image_urls {
        let mut cmd = Command::new(&wget_path);
        cmd.args([
            "--no-clobber",
            "--content-disposition",
            &format!("--directory-prefix={}", expanded),
            "--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            url,
        ])
        .stdout(Stdio::null())
        .stderr(Stdio::null());

        let status = cmd.status().await.map_err(|e| format!("wget failed: {}", e))?;
        if !status.success() {
            eprintln!("Warning: failed to download {}", url);
        }
    }

    Ok(())
}
