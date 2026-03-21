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

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn new() -> Result<Self> {
        let db_path = Self::db_path();
        std::fs::create_dir_all(db_path.parent().unwrap()).ok();
        let conn = Connection::open(&db_path)?;
        let db = Self { conn: Mutex::new(conn) };
        db.init_tables()?;
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

    fn init_tables(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
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
            "INSERT INTO downloads (id, url, status, progress, save_path, flags, file_size, speed, eta, error, created_at, completed_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![
                download.id, download.url, download.status, download.progress,
                download.save_path, download.flags, download.file_size,
                download.speed, download.eta, download.error,
                download.created_at, download.completed_at,
            ],
        )?;
        Ok(())
    }

    pub fn update_download(&self, download: &Download) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE downloads SET status=?2, progress=?3, save_path=?4, flags=?5, file_size=?6, speed=?7, eta=?8, error=?9, completed_at=?10 WHERE id=?1",
            params![
                download.id, download.status, download.progress, download.save_path,
                download.flags, download.file_size, download.speed, download.eta,
                download.error, download.completed_at,
            ],
        )?;
        Ok(())
    }

    pub fn get_download(&self, id: &str) -> Result<Option<Download>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, url, status, progress, save_path, flags, file_size, speed, eta, error, created_at, completed_at FROM downloads WHERE id = ?1"
        )?;
        let mut rows = stmt.query_map(params![id], |row| {
            Ok(Download {
                id: row.get(0)?, url: row.get(1)?, status: row.get(2)?,
                progress: row.get(3)?, save_path: row.get(4)?, flags: row.get(5)?,
                file_size: row.get(6)?, speed: row.get(7)?, eta: row.get(8)?,
                error: row.get(9)?, created_at: row.get(10)?, completed_at: row.get(11)?,
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
            "SELECT id, url, status, progress, save_path, flags, file_size, speed, eta, error, created_at, completed_at FROM downloads ORDER BY created_at DESC"
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(Download {
                id: row.get(0)?, url: row.get(1)?, status: row.get(2)?,
                progress: row.get(3)?, save_path: row.get(4)?, flags: row.get(5)?,
                file_size: row.get(6)?, speed: row.get(7)?, eta: row.get(8)?,
                error: row.get(9)?, created_at: row.get(10)?, completed_at: row.get(11)?,
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
}
