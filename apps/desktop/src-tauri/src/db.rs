use rusqlite::{Connection, Result, params};
use serde::{Serialize, Deserialize};
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Download {
    pub id: String,
    pub url: String,
    pub status: String, // "queued", "downloading", "paused", "completed", "failed", "cancelled"
    pub progress: f64,
    pub save_path: String,
    pub flags: String, // JSON string of wget flags
    pub file_size: Option<i64>,
    pub speed: Option<String>,
    pub eta: Option<String>,
    pub error: Option<String>,
    pub created_at: String,
    pub completed_at: Option<String>,
    pub file_hash: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Preset {
    pub id: String,
    pub name: String,
    pub flags_json: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Setting {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Clip {
    pub id: String,
    pub url: String,
    pub title: Option<String>,
    pub markdown: Option<String>,
    pub html: Option<String>,
    pub summary: Option<String>,
    pub tags: String,
    pub source_type: String,
    pub vault_path: Option<String>,
    pub created_at: String,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub id: String,
    pub role: String,
    pub content: String,
    pub sources: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Schedule {
    pub id: String,
    pub url: String,
    pub job_type: String,
    pub cron: Option<String>,
    pub flags: String,
    pub last_run: Option<String>,
    pub next_run: Option<String>,
    pub enabled: i64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Monitor {
    pub id: String,
    pub url: String,
    pub last_hash: Option<String>,
    pub last_checked: Option<String>,
    pub change_detected: i64,
    pub notify: i64,
    pub created_at: String,
}

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn new_with_path(path: &str) -> Result<Self> {
        let db_path = PathBuf::from(path);
        std::fs::create_dir_all(db_path.parent().unwrap()).ok();
        let conn = Connection::open(&db_path)?;

        conn.execute_batch("
            CREATE TABLE IF NOT EXISTS schema_version (
                version INTEGER PRIMARY KEY,
                applied_at TEXT NOT NULL
            );
        ")?;

        let current_version: i64 = conn.query_row(
            "SELECT COALESCE(MAX(version), 0) FROM schema_version", [], |row| row.get(0)
        ).unwrap_or(0);

        if current_version < 1 {
            Self::migrate_v1(&conn)?;
        }
        if current_version < 2 {
            Self::migrate_v2(&conn)?;
        }
        if current_version < 3 {
            Self::migrate_v3(&conn)?;
        }

        let db = Self { conn: Mutex::new(conn) };
        db.init_default_settings()?;
        Ok(db)
    }

    pub fn new() -> Result<Self> {
        let db_path = Self::db_path();
        std::fs::create_dir_all(db_path.parent().unwrap()).ok();
        let conn = Connection::open(&db_path)?;

        conn.execute_batch("
            CREATE TABLE IF NOT EXISTS schema_version (
                version INTEGER PRIMARY KEY,
                applied_at TEXT NOT NULL
            );
        ")?;

        let current_version: i64 = conn.query_row(
            "SELECT COALESCE(MAX(version), 0) FROM schema_version", [], |row| row.get(0)
        ).unwrap_or(0);

        if current_version < 1 {
            Self::migrate_v1(&conn)?;
        }
        if current_version < 2 {
            Self::migrate_v2(&conn)?;
        }
        if current_version < 3 {
            Self::migrate_v3(&conn)?;
        }

        let db = Self { conn: Mutex::new(conn) };
        db.init_default_settings()?;
        db.cleanup_stale_downloads()?;
        Ok(db)
    }

    fn db_path() -> PathBuf {
        let mut path = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
        path.push("Yoinkit");
        path.push("yoinkit.db");
        path
    }

    fn migrate_v1(conn: &Connection) -> Result<()> {
        conn.execute_batch("
            CREATE TABLE IF NOT EXISTS downloads (
                id TEXT PRIMARY KEY,
                url TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'queued',
                progress REAL NOT NULL DEFAULT 0.0,
                save_path TEXT NOT NULL,
                flags TEXT NOT NULL DEFAULT '{}',
                file_size INTEGER,
                speed TEXT,
                eta TEXT,
                error TEXT,
                created_at TEXT NOT NULL,
                completed_at TEXT
            );
            CREATE TABLE IF NOT EXISTS presets (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                flags_json TEXT NOT NULL DEFAULT '{}',
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
        ")?;
        conn.execute(
            "INSERT OR IGNORE INTO schema_version (version, applied_at) VALUES (1, datetime('now'))",
            [],
        )?;
        Ok(())
    }

    fn migrate_v2(conn: &Connection) -> Result<()> {
        conn.execute_batch("
            CREATE TABLE IF NOT EXISTS clips (
                id TEXT PRIMARY KEY,
                url TEXT NOT NULL,
                title TEXT,
                markdown TEXT,
                html TEXT,
                summary TEXT,
                tags TEXT DEFAULT '[]',
                source_type TEXT DEFAULT 'clip',
                vault_path TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT
            );
            CREATE TABLE IF NOT EXISTS search_index (
                id TEXT PRIMARY KEY,
                content_type TEXT,
                content_id TEXT,
                indexed_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS chat_messages (
                id TEXT PRIMARY KEY,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                sources TEXT DEFAULT '[]',
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS schedules (
                id TEXT PRIMARY KEY,
                url TEXT NOT NULL,
                job_type TEXT NOT NULL,
                cron TEXT,
                flags TEXT DEFAULT '{}',
                last_run TEXT,
                next_run TEXT,
                enabled INTEGER DEFAULT 1,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS monitors (
                id TEXT PRIMARY KEY,
                url TEXT NOT NULL,
                last_hash TEXT,
                last_checked TEXT,
                change_detected INTEGER DEFAULT 0,
                notify INTEGER DEFAULT 1,
                created_at TEXT NOT NULL
            );
        ")?;
        conn.execute(
            "INSERT OR IGNORE INTO schema_version (version, applied_at) VALUES (2, datetime('now'))",
            [],
        )?;
        Ok(())
    }

    fn migrate_v3(conn: &Connection) -> Result<()> {
        conn.execute_batch("
            ALTER TABLE downloads ADD COLUMN file_hash TEXT;
        ")?;
        conn.execute(
            "INSERT INTO schema_version (version, applied_at) VALUES (3, ?1)",
            params![chrono::Utc::now().to_rfc3339()],
        )?;
        Ok(())
    }

    fn init_default_settings(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let defaults = vec![
            ("default_save_path", dirs::download_dir()
                .unwrap_or_else(|| PathBuf::from("~/Downloads"))
                .join("Yoinkit")
                .to_string_lossy()
                .to_string()),
            ("one_click_mode", "current_page".to_string()),
            ("max_concurrent", "3".to_string()),
            ("pro_unlocked", "false".to_string()),
            ("obsidian_vault_path", "".to_string()),
            ("obsidian_attachments_folder", "assets/yoinkit".to_string()),
            ("obsidian_frontmatter_template", "".to_string()),
            ("auto_tag", "false".to_string()),
            ("auto_summarize", "false".to_string()),
            ("ai_provider", "none".to_string()),
            ("ai_api_key_configured", "false".to_string()),
            ("ai_model", "".to_string()),
            ("clip_on_download", "false".to_string()),
            ("bandwidth_limit", "0".to_string()),
        ];
        for (key, value) in defaults {
            conn.execute(
                "INSERT OR IGNORE INTO settings (key, value) VALUES (?1, ?2)",
                params![key, value],
            )?;
        }
        Ok(())
    }

    /// On startup, mark any "downloading" or "queued" entries as "failed"
    /// since those processes are dead after an app restart.
    fn cleanup_stale_downloads(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE downloads SET status = 'failed', error = 'App restarted — download interrupted' WHERE status IN ('downloading', 'queued')",
            [],
        )?;
        Ok(())
    }

    // Downloads CRUD
    pub fn insert_download(&self, download: &Download) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO downloads (id, url, status, progress, save_path, flags, file_size, speed, eta, error, created_at, completed_at, file_hash)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            params![
                download.id, download.url, download.status, download.progress,
                download.save_path, download.flags, download.file_size,
                download.speed, download.eta, download.error,
                download.created_at, download.completed_at, download.file_hash,
            ],
        )?;
        Ok(())
    }

    pub fn update_download(&self, download: &Download) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE downloads SET status=?2, progress=?3, save_path=?4, flags=?5, file_size=?6, speed=?7, eta=?8, error=?9, completed_at=?10, file_hash=?11 WHERE id=?1",
            params![
                download.id, download.status, download.progress, download.save_path,
                download.flags, download.file_size, download.speed, download.eta,
                download.error, download.completed_at, download.file_hash,
            ],
        )?;
        Ok(())
    }

    pub fn get_download(&self, id: &str) -> Result<Option<Download>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, url, status, progress, save_path, flags, file_size, speed, eta, error, created_at, completed_at, file_hash FROM downloads WHERE id = ?1"
        )?;
        let mut rows = stmt.query_map(params![id], |row| {
            Ok(Download {
                id: row.get(0)?, url: row.get(1)?, status: row.get(2)?,
                progress: row.get(3)?, save_path: row.get(4)?, flags: row.get(5)?,
                file_size: row.get(6)?, speed: row.get(7)?, eta: row.get(8)?,
                error: row.get(9)?, created_at: row.get(10)?, completed_at: row.get(11)?,
                file_hash: row.get(12)?,
            })
        })?;
        match rows.next() {
            Some(row) => Ok(Some(row?)),
            None => Ok(None),
        }
    }

    pub fn list_downloads(&self) -> Result<Vec<Download>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, url, status, progress, save_path, flags, file_size, speed, eta, error, created_at, completed_at, file_hash FROM downloads ORDER BY created_at DESC"
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(Download {
                id: row.get(0)?, url: row.get(1)?, status: row.get(2)?,
                progress: row.get(3)?, save_path: row.get(4)?, flags: row.get(5)?,
                file_size: row.get(6)?, speed: row.get(7)?, eta: row.get(8)?,
                error: row.get(9)?, created_at: row.get(10)?, completed_at: row.get(11)?,
                file_hash: row.get(12)?,
            })
        })?;
        rows.collect()
    }

    pub fn delete_download(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM downloads WHERE id = ?1", params![id])?;
        Ok(())
    }

    // Presets CRUD
    pub fn insert_preset(&self, preset: &Preset) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO presets (id, name, flags_json, created_at) VALUES (?1, ?2, ?3, ?4)",
            params![preset.id, preset.name, preset.flags_json, preset.created_at],
        )?;
        Ok(())
    }

    pub fn list_presets(&self) -> Result<Vec<Preset>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, name, flags_json, created_at FROM presets ORDER BY created_at DESC")?;
        let rows = stmt.query_map([], |row| {
            Ok(Preset {
                id: row.get(0)?, name: row.get(1)?, flags_json: row.get(2)?, created_at: row.get(3)?,
            })
        })?;
        rows.collect()
    }

    pub fn delete_preset(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM presets WHERE id = ?1", params![id])?;
        Ok(())
    }

    // Settings
    pub fn get_setting(&self, key: &str) -> Result<Option<String>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1")?;
        let mut rows = stmt.query_map(params![key], |row| row.get(0))?;
        match rows.next() {
            Some(row) => Ok(Some(row?)),
            None => Ok(None),
        }
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
            params![key, value],
        )?;
        Ok(())
    }

    pub fn get_all_settings(&self) -> Result<Vec<Setting>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT key, value FROM settings")?;
        let rows = stmt.query_map([], |row| {
            Ok(Setting { key: row.get(0)?, value: row.get(1)? })
        })?;
        rows.collect()
    }

    // Clips CRUD
    pub fn insert_clip(&self, clip: &Clip) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO clips (id, url, title, markdown, html, summary, tags, source_type, vault_path, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                clip.id, clip.url, clip.title, clip.markdown, clip.html,
                clip.summary, clip.tags, clip.source_type, clip.vault_path,
                clip.created_at, clip.updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn get_clip(&self, id: &str) -> Result<Option<Clip>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, url, title, markdown, html, summary, tags, source_type, vault_path, created_at, updated_at FROM clips WHERE id = ?1"
        )?;
        let mut rows = stmt.query_map(params![id], |row| {
            Ok(Clip {
                id: row.get(0)?, url: row.get(1)?, title: row.get(2)?,
                markdown: row.get(3)?, html: row.get(4)?, summary: row.get(5)?,
                tags: row.get(6)?, source_type: row.get(7)?, vault_path: row.get(8)?,
                created_at: row.get(9)?, updated_at: row.get(10)?,
            })
        })?;
        match rows.next() {
            Some(row) => Ok(Some(row?)),
            None => Ok(None),
        }
    }

    pub fn list_clips(&self) -> Result<Vec<Clip>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, url, title, markdown, html, summary, tags, source_type, vault_path, created_at, updated_at FROM clips ORDER BY created_at DESC"
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(Clip {
                id: row.get(0)?, url: row.get(1)?, title: row.get(2)?,
                markdown: row.get(3)?, html: row.get(4)?, summary: row.get(5)?,
                tags: row.get(6)?, source_type: row.get(7)?, vault_path: row.get(8)?,
                created_at: row.get(9)?, updated_at: row.get(10)?,
            })
        })?;
        rows.collect()
    }

    pub fn update_clip(&self, clip: &Clip) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE clips SET url=?2, title=?3, markdown=?4, html=?5, summary=?6, tags=?7, source_type=?8, vault_path=?9, updated_at=?10 WHERE id=?1",
            params![
                clip.id, clip.url, clip.title, clip.markdown, clip.html,
                clip.summary, clip.tags, clip.source_type, clip.vault_path,
                clip.updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn delete_clip(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM clips WHERE id = ?1", params![id])?;
        Ok(())
    }

    // ChatMessage CRUD
    pub fn insert_chat_message(&self, msg: &ChatMessage) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO chat_messages (id, role, content, sources, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![msg.id, msg.role, msg.content, msg.sources, msg.created_at],
        )?;
        Ok(())
    }

    pub fn list_chat_messages(&self, limit: usize) -> Result<Vec<ChatMessage>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, role, content, sources, created_at FROM chat_messages ORDER BY created_at DESC LIMIT ?1"
        )?;
        let rows = stmt.query_map(params![limit as i64], |row| {
            Ok(ChatMessage {
                id: row.get(0)?, role: row.get(1)?, content: row.get(2)?,
                sources: row.get(3)?, created_at: row.get(4)?,
            })
        })?;
        let mut messages: Vec<ChatMessage> = rows.collect::<Result<Vec<_>>>()?;
        messages.reverse();
        Ok(messages)
    }

    pub fn clear_chat_history(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM chat_messages", [])?;
        Ok(())
    }

    // Schedules CRUD
    pub fn insert_schedule(&self, schedule: &Schedule) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO schedules (id, url, job_type, cron, flags, last_run, next_run, enabled, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                schedule.id, schedule.url, schedule.job_type, schedule.cron,
                schedule.flags, schedule.last_run, schedule.next_run,
                schedule.enabled, schedule.created_at,
            ],
        )?;
        Ok(())
    }

    pub fn get_schedule(&self, id: &str) -> Result<Option<Schedule>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, url, job_type, cron, flags, last_run, next_run, enabled, created_at FROM schedules WHERE id = ?1"
        )?;
        let mut rows = stmt.query_map(params![id], |row| {
            Ok(Schedule {
                id: row.get(0)?, url: row.get(1)?, job_type: row.get(2)?,
                cron: row.get(3)?, flags: row.get(4)?, last_run: row.get(5)?,
                next_run: row.get(6)?, enabled: row.get(7)?, created_at: row.get(8)?,
            })
        })?;
        match rows.next() {
            Some(row) => Ok(Some(row?)),
            None => Ok(None),
        }
    }

    pub fn list_schedules(&self) -> Result<Vec<Schedule>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, url, job_type, cron, flags, last_run, next_run, enabled, created_at FROM schedules ORDER BY created_at DESC"
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(Schedule {
                id: row.get(0)?, url: row.get(1)?, job_type: row.get(2)?,
                cron: row.get(3)?, flags: row.get(4)?, last_run: row.get(5)?,
                next_run: row.get(6)?, enabled: row.get(7)?, created_at: row.get(8)?,
            })
        })?;
        rows.collect()
    }

    pub fn update_schedule(&self, schedule: &Schedule) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE schedules SET url=?2, job_type=?3, cron=?4, flags=?5, last_run=?6, next_run=?7, enabled=?8 WHERE id=?1",
            params![
                schedule.id, schedule.url, schedule.job_type, schedule.cron,
                schedule.flags, schedule.last_run, schedule.next_run, schedule.enabled,
            ],
        )?;
        Ok(())
    }

    pub fn delete_schedule(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM schedules WHERE id = ?1", params![id])?;
        Ok(())
    }

    // Monitors CRUD
    pub fn insert_monitor(&self, monitor: &Monitor) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO monitors (id, url, last_hash, last_checked, change_detected, notify, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                monitor.id, monitor.url, monitor.last_hash, monitor.last_checked,
                monitor.change_detected, monitor.notify, monitor.created_at,
            ],
        )?;
        Ok(())
    }

    pub fn get_monitor(&self, id: &str) -> Result<Option<Monitor>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, url, last_hash, last_checked, change_detected, notify, created_at FROM monitors WHERE id = ?1"
        )?;
        let mut rows = stmt.query_map(params![id], |row| {
            Ok(Monitor {
                id: row.get(0)?, url: row.get(1)?, last_hash: row.get(2)?,
                last_checked: row.get(3)?, change_detected: row.get(4)?,
                notify: row.get(5)?, created_at: row.get(6)?,
            })
        })?;
        match rows.next() {
            Some(row) => Ok(Some(row?)),
            None => Ok(None),
        }
    }

    pub fn list_monitors(&self) -> Result<Vec<Monitor>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, url, last_hash, last_checked, change_detected, notify, created_at FROM monitors ORDER BY created_at DESC"
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(Monitor {
                id: row.get(0)?, url: row.get(1)?, last_hash: row.get(2)?,
                last_checked: row.get(3)?, change_detected: row.get(4)?,
                notify: row.get(5)?, created_at: row.get(6)?,
            })
        })?;
        rows.collect()
    }

    pub fn update_monitor(&self, monitor: &Monitor) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE monitors SET url=?2, last_hash=?3, last_checked=?4, change_detected=?5, notify=?6 WHERE id=?1",
            params![
                monitor.id, monitor.url, monitor.last_hash, monitor.last_checked,
                monitor.change_detected, monitor.notify,
            ],
        )?;
        Ok(())
    }

    pub fn delete_monitor(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM monitors WHERE id = ?1", params![id])?;
        Ok(())
    }
}
