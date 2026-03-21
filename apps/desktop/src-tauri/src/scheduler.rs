use crate::db::{Database, Schedule};
use std::sync::Arc;
use tokio::time::{sleep, Duration};

pub struct Scheduler {
    db: Arc<Database>,
}

impl Scheduler {
    pub fn new(db: Arc<Database>) -> Self {
        Self { db }
    }

    /// Start the scheduler background loop
    pub async fn run(&self) {
        loop {
            if let Ok(schedules) = self.db.list_schedules() {
                for schedule in schedules {
                    if schedule.enabled == 0 {
                        continue;
                    }
                    if self.should_run(&schedule) {
                        self.execute_schedule(&schedule).await;
                    }
                }
            }
            sleep(Duration::from_secs(60)).await;
        }
    }

    fn should_run(&self, schedule: &Schedule) -> bool {
        // Simple interval-based check: compare last_run + interval vs now
        let now = chrono::Utc::now();
        if let Some(ref last_run) = schedule.last_run {
            if let Ok(last) = chrono::DateTime::parse_from_rfc3339(last_run) {
                let cron_expr = schedule.cron.as_deref().unwrap_or("hourly");
                let interval_secs = self.parse_cron_to_seconds(cron_expr);
                let next_run = last + chrono::Duration::seconds(interval_secs as i64);
                return now >= next_run;
            }
        }
        // Never run before — run now
        true
    }

    fn parse_cron_to_seconds(&self, cron: &str) -> u64 {
        // Simple parser: "hourly" = 3600, "daily" = 86400, "weekly" = 604800
        // Or parse "Xm" / "Xh" / "Xd" format
        match cron.trim().to_lowercase().as_str() {
            "hourly" => 3600,
            "daily" => 86400,
            "weekly" => 604800,
            s => {
                if let Some(mins) = s.strip_suffix('m') {
                    mins.parse::<u64>().unwrap_or(60) * 60
                } else if let Some(hours) = s.strip_suffix('h') {
                    hours.parse::<u64>().unwrap_or(1) * 3600
                } else if let Some(days) = s.strip_suffix('d') {
                    days.parse::<u64>().unwrap_or(1) * 86400
                } else {
                    3600 // default hourly
                }
            }
        }
    }

    async fn execute_schedule(&self, schedule: &Schedule) {
        // Update last_run
        let mut updated = schedule.clone();
        updated.last_run = Some(chrono::Utc::now().to_rfc3339());
        let _ = self.db.update_schedule(&updated);

        // Execute based on job_type
        match schedule.job_type.as_str() {
            "download" => {
                // Re-download the URL
                // This would integrate with download_manager but for now just log
                eprintln!("Scheduler: executing download for {}", schedule.url);
            }
            "mirror" => {
                eprintln!("Scheduler: executing mirror for {}", schedule.url);
            }
            "monitor" => {
                eprintln!("Scheduler: executing monitor check for {}", schedule.url);
            }
            _ => {
                eprintln!("Scheduler: unknown job type: {}", schedule.job_type);
            }
        }
    }
}
