use crate::db::{Database, Download};
use crate::wget::{self, WgetFlags};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::process::Child;
use tokio::sync::Mutex;
use uuid::Uuid;
use chrono::Utc;

struct ActiveDownload {
    child: Child,
    #[allow(dead_code)]
    pid: u32,
}

pub struct DownloadManager {
    db: Arc<Database>,
    active: Arc<Mutex<HashMap<String, ActiveDownload>>>,
    max_concurrent: usize,
}

impl DownloadManager {
    pub fn new(db: Arc<Database>) -> Self {
        let max_concurrent = db.get_setting("max_concurrent")
            .ok()
            .flatten()
            .and_then(|v| v.parse().ok())
            .unwrap_or(3);

        Self {
            db,
            active: Arc::new(Mutex::new(HashMap::new())),
            max_concurrent,
        }
    }

    pub async fn start_download(&self, url: String, flags: WgetFlags, save_path: Option<String>) -> Result<String, String> {
        // Check concurrency limit
        let active_count = self.active.lock().await.len();
        if active_count >= self.max_concurrent {
            return Err(format!("Max concurrent downloads ({}) reached", self.max_concurrent));
        }

        let save_dir = save_path.unwrap_or_else(|| {
            self.db.get_setting("default_save_path")
                .ok()
                .flatten()
                .unwrap_or_else(|| "~/Downloads/Yoinkit".to_string())
        });

        // Create save directory
        let expanded_path = shellexpand::tilde(&save_dir).to_string();
        std::fs::create_dir_all(&expanded_path).map_err(|e| format!("Failed to create directory: {}", e))?;

        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();

        let download = Download {
            id: id.clone(),
            url: url.clone(),
            status: "downloading".to_string(),
            progress: 0.0,
            save_path: expanded_path.clone(),
            flags: serde_json::to_string(&flags).unwrap_or_default(),
            file_size: None,
            speed: None,
            eta: None,
            error: None,
            created_at: now,
            completed_at: None,
        };

        self.db.insert_download(&download).map_err(|e| format!("DB error: {}", e))?;

        // Spawn wget
        let (child, mut progress_rx) = wget::spawn_wget(&url, &flags, &expanded_path).await?;
        let pid = child.id().unwrap_or(0);

        self.active.lock().await.insert(id.clone(), ActiveDownload { child, pid });

        // Spawn progress monitor
        let db = self.db.clone();
        let active = self.active.clone();
        let dl_id = id.clone();

        tokio::spawn(async move {
            while let Some(progress) = progress_rx.recv().await {
                if let Ok(Some(mut dl)) = db.get_download(&dl_id) {
                    dl.progress = progress.percentage;
                    dl.speed = progress.speed;
                    dl.eta = progress.eta;
                    if let Some(size) = progress.file_size {
                        dl.file_size = Some(size);
                    }
                    let _ = db.update_download(&dl);
                }
            }

            // Download finished — check exit status
            let mut active_map = active.lock().await;
            if let Some(mut active_dl) = active_map.remove(&dl_id) {
                let status = active_dl.child.wait().await;
                if let Ok(Some(mut dl)) = db.get_download(&dl_id) {
                    match status {
                        Ok(exit) if exit.success() => {
                            dl.status = "completed".to_string();
                            dl.progress = 100.0;
                            dl.completed_at = Some(Utc::now().to_rfc3339());
                        }
                        Ok(exit) => {
                            dl.status = "failed".to_string();
                            dl.error = Some(format!("wget exited with code: {}", exit));
                        }
                        Err(e) => {
                            dl.status = "failed".to_string();
                            dl.error = Some(format!("Process error: {}", e));
                        }
                    }
                    let _ = db.update_download(&dl);
                }
            }
        });

        Ok(id)
    }

    pub async fn pause_download(&self, id: &str) -> Result<(), String> {
        let active = self.active.lock().await;
        if let Some(dl) = active.get(id) {
            #[cfg(unix)]
            {
                use nix::sys::signal::{kill, Signal};
                use nix::unistd::Pid;
                kill(Pid::from_raw(dl.pid as i32), Signal::SIGSTOP)
                    .map_err(|e| format!("Failed to pause: {}", e))?;
            }
            if let Ok(Some(mut download)) = self.db.get_download(id) {
                download.status = "paused".to_string();
                let _ = self.db.update_download(&download);
            }
            Ok(())
        } else {
            Err("Download not found or not active".to_string())
        }
    }

    pub async fn resume_download(&self, id: &str) -> Result<(), String> {
        let active = self.active.lock().await;
        if let Some(dl) = active.get(id) {
            #[cfg(unix)]
            {
                use nix::sys::signal::{kill, Signal};
                use nix::unistd::Pid;
                kill(Pid::from_raw(dl.pid as i32), Signal::SIGCONT)
                    .map_err(|e| format!("Failed to resume: {}", e))?;
            }
            if let Ok(Some(mut download)) = self.db.get_download(id) {
                download.status = "downloading".to_string();
                let _ = self.db.update_download(&download);
            }
            Ok(())
        } else {
            Err("Download not found or not active".to_string())
        }
    }

    pub async fn cancel_download(&self, id: &str) -> Result<(), String> {
        let mut active = self.active.lock().await;
        if let Some(mut dl) = active.remove(id) {
            dl.child.kill().await.map_err(|e| format!("Failed to kill: {}", e))?;
            if let Ok(Some(mut download)) = self.db.get_download(id) {
                download.status = "cancelled".to_string();
                let _ = self.db.update_download(&download);
            }
            Ok(())
        } else {
            Err("Download not found or not active".to_string())
        }
    }

    pub fn get_download(&self, id: &str) -> Result<Option<Download>, String> {
        self.db.get_download(id).map_err(|e| format!("DB error: {}", e))
    }

    pub fn list_downloads(&self) -> Result<Vec<Download>, String> {
        self.db.list_downloads().map_err(|e| format!("DB error: {}", e))
    }

    pub fn delete_download(&self, id: &str) -> Result<(), String> {
        self.db.delete_download(id).map_err(|e| format!("DB error: {}", e))
    }
}
