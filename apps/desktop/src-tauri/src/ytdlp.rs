use std::path::PathBuf;
use std::process::Stdio;
use tokio::process::{Child, Command};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::sync::mpsc;
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct YtdlpProgress {
    pub percentage: f64,
    pub speed: Option<String>,
    pub eta: Option<String>,
    pub file_size: Option<String>,
    pub status: String, // "downloading", "processing", "complete"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoInfo {
    pub title: String,
    pub url: String,
    pub thumbnail: Option<String>,
    pub duration: Option<String>,
    pub formats: Vec<FormatInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FormatInfo {
    pub format_id: String,
    pub ext: String,
    pub resolution: Option<String>,
    pub filesize: Option<i64>,
    pub vcodec: Option<String>,
    pub acodec: Option<String>,
    pub format_note: Option<String>,
}

pub fn ytdlp_binary_path() -> PathBuf {
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()));

    if let Some(dir) = exe_dir {
        let bundle_path = dir.join("../Resources/bin/yt-dlp");
        if bundle_path.exists() {
            return bundle_path;
        }
        let dev_path = dir.join("bin/yt-dlp");
        if dev_path.exists() {
            return dev_path;
        }
    }
    PathBuf::from("/usr/local/bin/yt-dlp")
}

pub fn ffmpeg_binary_path() -> PathBuf {
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()));

    if let Some(dir) = exe_dir {
        let bundle_path = dir.join("../Resources/bin/ffmpeg");
        if bundle_path.exists() {
            return bundle_path;
        }
        let dev_path = dir.join("bin/ffmpeg");
        if dev_path.exists() {
            return dev_path;
        }
    }
    PathBuf::from("/usr/local/bin/ffmpeg")
}

/// Fetch video info without downloading
pub async fn get_video_info(url: &str) -> Result<VideoInfo, String> {
    let ytdlp = ytdlp_binary_path();
    let output = Command::new(&ytdlp)
        .args(["--dump-json", "--no-download", url])
        .output()
        .await
        .map_err(|e| format!("Failed to run yt-dlp: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("yt-dlp error: {}", stderr));
    }

    let json: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Failed to parse yt-dlp output: {}", e))?;

    let formats = json["formats"].as_array()
        .map(|fmts| {
            fmts.iter().filter_map(|f| {
                Some(FormatInfo {
                    format_id: f["format_id"].as_str()?.to_string(),
                    ext: f["ext"].as_str().unwrap_or("mp4").to_string(),
                    resolution: f["resolution"].as_str().map(|s| s.to_string()),
                    filesize: f["filesize"].as_i64().or_else(|| f["filesize_approx"].as_i64()),
                    vcodec: f["vcodec"].as_str().map(|s| s.to_string()),
                    acodec: f["acodec"].as_str().map(|s| s.to_string()),
                    format_note: f["format_note"].as_str().map(|s| s.to_string()),
                })
            }).collect()
        })
        .unwrap_or_default();

    let duration_secs = json["duration"].as_f64();
    let duration = duration_secs.map(|d| {
        let mins = (d / 60.0).floor() as u64;
        let secs = (d % 60.0).floor() as u64;
        format!("{}:{:02}", mins, secs)
    });

    Ok(VideoInfo {
        title: json["title"].as_str().unwrap_or("Unknown").to_string(),
        url: url.to_string(),
        thumbnail: json["thumbnail"].as_str().map(|s| s.to_string()),
        duration,
        formats,
    })
}

/// Download video with yt-dlp
pub async fn spawn_video_download(
    url: &str,
    format: Option<&str>,
    quality: Option<&str>,
    audio_only: bool,
    save_dir: &str,
) -> Result<(Child, mpsc::Receiver<YtdlpProgress>), String> {
    let ytdlp = ytdlp_binary_path();
    let ffmpeg = ffmpeg_binary_path();

    let mut cmd = Command::new(&ytdlp);
    cmd.arg("--newline") // One progress line per update
        .arg("--progress-template")
        .arg("download:%(progress._percent_str)s %(progress._speed_str)s %(progress._eta_str)s %(progress._total_bytes_str)s");

    // Set ffmpeg location if bundled
    if ffmpeg.exists() {
        cmd.arg("--ffmpeg-location").arg(ffmpeg.parent().unwrap_or(&ffmpeg));
    }

    if audio_only {
        cmd.arg("-x"); // Extract audio
        let audio_format = format.unwrap_or("mp3");
        cmd.arg("--audio-format").arg(audio_format);
        if let Some(q) = quality {
            cmd.arg("--audio-quality").arg(q);
        }
    } else {
        // Video download
        if let Some(fmt) = format {
            cmd.arg("-f").arg(fmt);
        } else if let Some(q) = quality {
            // Map quality labels to format strings
            let format_str = match q {
                "4k" | "2160p" => "bestvideo[height<=2160]+bestaudio/best[height<=2160]",
                "1080p" => "bestvideo[height<=1080]+bestaudio/best[height<=1080]",
                "720p" => "bestvideo[height<=720]+bestaudio/best[height<=720]",
                "480p" => "bestvideo[height<=480]+bestaudio/best[height<=480]",
                "360p" => "bestvideo[height<=360]+bestaudio/best[height<=360]",
                _ => "bestvideo+bestaudio/best",
            };
            cmd.arg("-f").arg(format_str);
        }
        cmd.arg("--merge-output-format").arg("mp4");
    }

    cmd.arg("-o").arg(format!("{}/%(title)s.%(ext)s", save_dir))
        .arg(url)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn yt-dlp: {}", e))?;
    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let (tx, rx) = mpsc::channel(100);

    tokio::spawn(async move {
        let reader = BufReader::new(stdout);
        let mut lines = reader.lines();

        while let Ok(Some(line)) = lines.next_line().await {
            if let Some(progress) = parse_ytdlp_progress(&line) {
                let _ = tx.send(progress).await;
            }
        }
    });

    Ok((child, rx))
}

fn parse_ytdlp_progress(line: &str) -> Option<YtdlpProgress> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return None;
    }

    // Parse custom progress template: "download:  45.2% 1.23MiB/s 00:30 50.00MiB"
    if trimmed.starts_with("download:") {
        let rest = trimmed.strip_prefix("download:").unwrap_or(trimmed).trim();
        let parts: Vec<&str> = rest.split_whitespace().collect();

        let percentage = parts.first()
            .and_then(|p| p.trim_end_matches('%').trim().parse::<f64>().ok())
            .unwrap_or(0.0);

        let speed = parts.get(1).map(|s| s.to_string());
        let eta = parts.get(2).map(|s| s.to_string());
        let file_size = parts.get(3).map(|s| s.to_string());

        return Some(YtdlpProgress {
            percentage,
            speed,
            eta,
            file_size,
            status: if percentage >= 100.0 { "complete".to_string() } else { "downloading".to_string() },
        });
    }

    // Detect post-processing
    if trimmed.contains("[Merger]") || trimmed.contains("[ExtractAudio]") || trimmed.contains("[ffmpeg]") {
        return Some(YtdlpProgress {
            percentage: 100.0,
            speed: None,
            eta: None,
            file_size: None,
            status: "processing".to_string(),
        });
    }

    None
}
