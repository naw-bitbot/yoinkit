# Yoinkit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a macOS desktop app (Tauri v2) and browser extension that provides a GUI for Wget, bundling the binary so users never need Homebrew or the terminal.

**Architecture:** Tauri v2 monorepo with a Rust backend managing Wget subprocesses and a localhost REST API (port 9271). React + TypeScript + Tailwind frontend shared between the desktop app and browser extension via a shared UI package. SQLite for all persistence.

**Tech Stack:** Tauri v2, Rust, React 18, TypeScript, Tailwind CSS, SQLite (rusqlite), pnpm workspaces, WebExtension API

**Spec:** `docs/superpowers/specs/2026-03-20-yoinkit-design.md`

---

## File Structure

```
yoinkit/
├── pnpm-workspace.yaml
├── package.json
├── .gitignore
├── apps/
│   ├── desktop/
│   │   ├── package.json
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   ├── tailwind.config.js
│   │   ├── postcss.config.js
│   │   ├── src/
│   │   │   ├── main.tsx                    # React entry point
│   │   │   ├── App.tsx                     # Root app component with routing
│   │   │   ├── app.css                     # Global styles + Tailwind imports
│   │   │   ├── hooks/
│   │   │   │   ├── useDownloads.ts         # Download state management hook
│   │   │   │   └── useSettings.ts          # Settings state management hook
│   │   │   ├── pages/
│   │   │   │   ├── SimplePage.tsx           # Free tier - paste URL & download
│   │   │   │   ├── ProPage.tsx             # Pro tier - command builder
│   │   │   │   └── SettingsPage.tsx         # App settings
│   │   │   ├── components/
│   │   │   │   ├── DownloadItem.tsx         # Single download row with progress
│   │   │   │   ├── DownloadList.tsx         # List of all downloads
│   │   │   │   ├── UrlInput.tsx             # URL paste/drag-drop input
│   │   │   │   ├── CommandBuilder.tsx       # Pro: visual wget flag builder
│   │   │   │   ├── CommandPreview.tsx       # Pro: live command preview
│   │   │   │   ├── PresetManager.tsx        # Pro: saved presets
│   │   │   │   └── BatchInput.tsx           # Pro: multi-URL input
│   │   │   └── lib/
│   │   │       └── tauri.ts                # Tauri command bindings
│   │   └── src-tauri/
│   │       ├── Cargo.toml
│   │       ├── tauri.conf.json
│   │       ├── capabilities/
│   │       │   └── default.json
│   │       ├── src/
│   │       │   ├── main.rs                 # Tauri entry point
│   │       │   ├── lib.rs                  # Tauri plugin/command registration
│   │       │   ├── api.rs                  # Localhost REST API server (port 9271)
│   │       │   ├── auth.rs                 # Bearer token generation & validation
│   │       │   ├── db.rs                   # SQLite schema, queries, migrations
│   │       │   ├── download_manager.rs     # Download queue, Wget process management
│   │       │   ├── wget.rs                 # Wget process spawning & stderr parsing
│   │       │   ├── commands.rs             # Tauri IPC commands (frontend ↔ backend)
│   │       │   ├── settings.rs             # Settings read/write from SQLite
│   │       │   └── tray.rs                 # Menu bar tray icon & menu
│   │       └── bin/
│   │           └── wget                    # Bundled wget binary (placeholder)
│   └── extension/
│       ├── package.json
│       ├── vite.config.ts
│       ├── tsconfig.json
│       ├── tailwind.config.js
│       ├── postcss.config.js
│       ├── src/
│       │   ├── popup/
│       │   │   ├── Popup.tsx               # Extension popup UI
│       │   │   ├── popup.html              # Popup HTML entry
│       │   │   └── popup.css               # Popup styles
│       │   ├── background/
│       │   │   └── service-worker.ts       # Background script: one-click download, API calls
│       │   ├── lib/
│       │   │   └── api.ts                  # HTTP client for localhost:9271 API
│       │   └── options/
│       │       ├── Options.tsx             # Extension settings page
│       │       └── options.html            # Options HTML entry
│       └── manifests/
│           ├── chrome-manifest.json        # Manifest V3 for Chrome
│           ├── firefox-manifest.json       # Manifest V2/V3 for Firefox
│           └── safari-manifest.json        # Safari web extension manifest
├── packages/
│   └── ui/
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/
│       │   ├── index.ts                    # Barrel export
│       │   ├── ProgressBar.tsx             # Shared progress bar component
│       │   ├── StatusBadge.tsx             # Download status badge
│       │   ├── UrlField.tsx               # URL input field component
│       │   └── Button.tsx                 # Shared button component
│       └── tailwind-preset.js             # Shared Tailwind preset (colors, fonts)
```

---

## Task 1: Monorepo Scaffolding

**Files:**
- Create: `pnpm-workspace.yaml`, `package.json`, `.gitignore`
- Create: `packages/ui/package.json`, `packages/ui/tsconfig.json`, `packages/ui/src/index.ts`
- Create: `packages/ui/tailwind-preset.js`

- [ ] **Step 1: Initialize pnpm workspace**

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
```

```json
// package.json
{
  "name": "yoinkit",
  "private": true,
  "scripts": {
    "dev:desktop": "pnpm --filter @yoinkit/desktop dev",
    "dev:extension": "pnpm --filter @yoinkit/extension dev",
    "build:desktop": "pnpm --filter @yoinkit/desktop build",
    "build:extension": "pnpm --filter @yoinkit/extension build"
  }
}
```

```gitignore
# .gitignore
node_modules/
dist/
target/
.DS_Store
*.log
```

- [ ] **Step 2: Create shared UI package skeleton**

```json
// packages/ui/package.json
{
  "name": "@yoinkit/ui",
  "version": "0.1.0",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "peerDependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  }
}
```

```json
// packages/ui/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "outDir": "dist"
  },
  "include": ["src"]
}
```

```ts
// packages/ui/src/index.ts
// Shared UI components - will be populated in Task 6
export {};
```

```js
// packages/ui/tailwind-preset.js
module.exports = {
  theme: {
    extend: {
      colors: {
        yoinkit: {
          primary: '#6366f1',    // indigo-500
          secondary: '#8b5cf6',  // violet-500
          success: '#22c55e',    // green-500
          danger: '#ef4444',     // red-500
          warning: '#f59e0b',    // amber-500
          bg: '#0f172a',         // slate-900
          surface: '#1e293b',    // slate-800
          text: '#f8fafc',       // slate-50
          muted: '#94a3b8',      // slate-400
        },
      },
    },
  },
};
```

- [ ] **Step 3: Run `pnpm install` to verify workspace**

Run: `cd yoinkit && pnpm install`
Expected: Clean install, workspace packages linked

- [ ] **Step 4: Commit**

```bash
git add pnpm-workspace.yaml package.json .gitignore packages/
git commit -m "feat: scaffold pnpm monorepo with shared UI package"
```

---

## Task 2: Tauri Desktop App Scaffolding

**Files:**
- Create: `apps/desktop/package.json`, `apps/desktop/index.html`, `apps/desktop/vite.config.ts`
- Create: `apps/desktop/tsconfig.json`, `apps/desktop/tailwind.config.js`, `apps/desktop/postcss.config.js`
- Create: `apps/desktop/src/main.tsx`, `apps/desktop/src/App.tsx`, `apps/desktop/src/app.css`
- Create: `apps/desktop/src-tauri/Cargo.toml`, `apps/desktop/src-tauri/tauri.conf.json`
- Create: `apps/desktop/src-tauri/src/main.rs`, `apps/desktop/src-tauri/src/lib.rs`
- Create: `apps/desktop/src-tauri/capabilities/default.json`

- [ ] **Step 1: Create desktop app package.json with dependencies**

```json
// apps/desktop/package.json
{
  "name": "@yoinkit/desktop",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "tauri": "tauri"
  },
  "dependencies": {
    "@tauri-apps/api": "^2.0.0",
    "@tauri-apps/plugin-shell": "^2.0.0",
    "@yoinkit/ui": "workspace:*",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.20.0"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.5.0",
    "vite": "^5.4.0"
  }
}
```

- [ ] **Step 2: Create Vite config, Tailwind config, PostCSS config, and tsconfig**

```ts
// apps/desktop/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
});
```

```js
// apps/desktop/tailwind.config.js
const yoinkitPreset = require("@yoinkit/ui/tailwind-preset");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  presets: [yoinkitPreset],
  plugins: [],
};
```

```js
// apps/desktop/postcss.config.js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

```json
// apps/desktop/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create index.html and React entry point**

```html
<!-- apps/desktop/index.html -->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Yoinkit</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

```tsx
// apps/desktop/src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./app.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

```tsx
// apps/desktop/src/App.tsx
function App() {
  return (
    <div className="min-h-screen bg-yoinkit-bg text-yoinkit-text p-6">
      <h1 className="text-3xl font-bold">Yoinkit</h1>
      <p className="text-yoinkit-muted mt-2">Download anything from the web.</p>
    </div>
  );
}

export default App;
```

```css
/* apps/desktop/src/app.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 4: Create Tauri Rust backend**

```toml
# apps/desktop/src-tauri/Cargo.toml
[package]
name = "yoinkit"
version = "0.1.0"
edition = "2021"

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-shell = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
rusqlite = { version = "0.31", features = ["bundled"] }
tokio = { version = "1", features = ["full"] }
axum = "0.7"
tower-http = { version = "0.5", features = ["cors"] }
uuid = { version = "1", features = ["v4"] }
rand = "0.8"

[build-dependencies]
tauri-build = { version = "2", features = [] }
```

```rust
// apps/desktop/src-tauri/src/main.rs
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    yoinkit_lib::run();
}
```

```rust
// apps/desktop/src-tauri/src/lib.rs
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 5: Create tauri.conf.json**

```json
// apps/desktop/src-tauri/tauri.conf.json
{
  "$schema": "https://raw.githubusercontent.com/tauri-apps/tauri/dev/crates/tauri-config-schema/schema.json",
  "productName": "Yoinkit",
  "version": "0.1.0",
  "identifier": "com.yoinkit.app",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:1420",
    "beforeDevCommand": "pnpm dev",
    "beforeBuildCommand": "pnpm build"
  },
  "app": {
    "windows": [
      {
        "title": "Yoinkit",
        "width": 900,
        "height": 650,
        "resizable": true,
        "fullscreen": false
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "resources": ["bin/wget"]
  }
}
```

```json
// apps/desktop/src-tauri/capabilities/default.json
{
  "identifier": "default",
  "description": "Default capability for Yoinkit",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "shell:allow-open"
  ]
}
```

- [ ] **Step 6: Create Tauri build.rs**

```rust
// apps/desktop/src-tauri/build.rs
fn main() {
    tauri_build::build()
}
```

- [ ] **Step 7: Verify the app compiles and launches**

Run: `cd apps/desktop && pnpm install && pnpm tauri dev`
Expected: Tauri window opens showing "Yoinkit" heading with dark background

- [ ] **Step 8: Commit**

```bash
git add apps/desktop/
git commit -m "feat: scaffold Tauri v2 desktop app with React frontend"
```

---

## Task 3: SQLite Database Layer

**Files:**
- Create: `apps/desktop/src-tauri/src/db.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Write db.rs with schema initialization**

```rust
// apps/desktop/src-tauri/src/db.rs
use rusqlite::{Connection, Result, params};
use std::path::PathBuf;
use std::fs;

pub fn db_path() -> PathBuf {
    let support_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("Yoinkit");
    fs::create_dir_all(&support_dir).expect("Failed to create Yoinkit data directory");
    support_dir.join("yoinkit.db")
}

pub fn init_db(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS downloads (
            id TEXT PRIMARY KEY,
            url TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            progress REAL NOT NULL DEFAULT 0.0,
            save_path TEXT NOT NULL,
            flags TEXT NOT NULL DEFAULT '',
            error_message TEXT,
            wget_exit_code INTEGER,
            file_size INTEGER,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            completed_at TEXT
        );

        CREATE TABLE IF NOT EXISTS presets (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            flags_json TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        INSERT OR IGNORE INTO settings (key, value) VALUES ('default_save_path', '~/Downloads/Yoinkit/');
        INSERT OR IGNORE INTO settings (key, value) VALUES ('one_click_mode', 'page');
        INSERT OR IGNORE INTO settings (key, value) VALUES ('max_concurrent', '3');
        INSERT OR IGNORE INTO settings (key, value) VALUES ('pro_unlocked', 'false');
        "
    )?;
    Ok(())
}

pub fn get_setting(conn: &Connection, key: &str) -> Result<Option<String>> {
    let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1")?;
    let mut rows = stmt.query(params![key])?;
    if let Some(row) = rows.next()? {
        Ok(Some(row.get(0)?))
    } else {
        Ok(None)
    }
}

pub fn set_setting(conn: &Connection, key: &str, value: &str) -> Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
        params![key, value],
    )?;
    Ok(())
}
```

- [ ] **Step 2: Add `dirs` crate to Cargo.toml**

Add to `[dependencies]` in `apps/desktop/src-tauri/Cargo.toml`:
```toml
dirs = "5"
```

- [ ] **Step 3: Wire db into lib.rs with managed state**

```rust
// apps/desktop/src-tauri/src/lib.rs
mod db;

use rusqlite::Connection;
use std::sync::Mutex;

pub struct AppState {
    pub db: Mutex<Connection>,
}

pub fn run() {
    let conn = Connection::open(db::db_path()).expect("Failed to open database");
    db::init_db(&conn).expect("Failed to initialize database");

    let state = AppState {
        db: Mutex::new(conn),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(state)
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 4: Verify compilation**

Run: `cd apps/desktop && pnpm tauri build --debug 2>&1 | tail -5`
Expected: Compiles without errors

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src-tauri/
git commit -m "feat: add SQLite database layer with schema and settings"
```

---

## Task 4: Auth Token Generation

**Files:**
- Create: `apps/desktop/src-tauri/src/auth.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Write auth.rs**

```rust
// apps/desktop/src-tauri/src/auth.rs
use rand::Rng;
use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::PathBuf;

fn token_path() -> PathBuf {
    let support_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("Yoinkit");
    fs::create_dir_all(&support_dir).expect("Failed to create Yoinkit data directory");
    support_dir.join("api_token")
}

pub fn get_or_create_token() -> String {
    let path = token_path();

    if path.exists() {
        if let Ok(token) = fs::read_to_string(&path) {
            let token = token.trim().to_string();
            if !token.is_empty() {
                return token;
            }
        }
    }

    let token: String = rand::thread_rng()
        .sample_iter(&rand::distributions::Alphanumeric)
        .take(64)
        .map(char::from)
        .collect();

    fs::write(&path, &token).expect("Failed to write API token");
    fs::set_permissions(&path, fs::Permissions::from_mode(0o600))
        .expect("Failed to set token file permissions");

    token
}

pub fn validate_token(provided: &str, expected: &str) -> bool {
    // Constant-time comparison to prevent timing attacks
    if provided.len() != expected.len() {
        return false;
    }
    provided
        .bytes()
        .zip(expected.bytes())
        .fold(0u8, |acc, (a, b)| acc | (a ^ b))
        == 0
}
```

- [ ] **Step 2: Add auth to AppState in lib.rs**

```rust
// apps/desktop/src-tauri/src/lib.rs
mod auth;
mod db;

use rusqlite::Connection;
use std::sync::Mutex;

pub struct AppState {
    pub db: Mutex<Connection>,
    pub api_token: String,
}

pub fn run() {
    let conn = Connection::open(db::db_path()).expect("Failed to open database");
    db::init_db(&conn).expect("Failed to initialize database");

    let api_token = auth::get_or_create_token();

    let state = AppState {
        db: Mutex::new(conn),
        api_token,
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(state)
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 3: Verify compilation**

Run: `cd apps/desktop && pnpm tauri build --debug 2>&1 | tail -5`
Expected: Compiles without errors

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src-tauri/src/auth.rs apps/desktop/src-tauri/src/lib.rs
git commit -m "feat: add bearer token auth for localhost API"
```

---

## Task 5: Wget Process Manager

**Files:**
- Create: `apps/desktop/src-tauri/src/wget.rs`
- Create: `apps/desktop/src-tauri/src/download_manager.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Write wget.rs — process spawning and stderr parsing**

```rust
// apps/desktop/src-tauri/src/wget.rs
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};

#[derive(Debug, Clone)]
pub struct WgetProgress {
    pub percent: f64,
    pub speed: String,
    pub eta: String,
}

pub fn bundled_wget_path() -> PathBuf {
    let exe_dir = std::env::current_exe()
        .expect("Failed to get executable path")
        .parent()
        .expect("Failed to get executable directory")
        .to_path_buf();

    // In development, check relative to project
    let dev_path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("bin").join("wget");
    if dev_path.exists() {
        return dev_path;
    }

    // In production macOS bundle: ../Resources/bin/wget
    let bundle_path = exe_dir.join("../Resources/bin/wget");
    if bundle_path.exists() {
        return bundle_path;
    }

    // Fallback to system wget
    PathBuf::from("wget")
}

pub fn spawn_wget(url: &str, save_path: &str, extra_flags: &[String]) -> std::io::Result<Child> {
    let wget = bundled_wget_path();

    let mut cmd = Command::new(wget);
    cmd.arg("--progress=bar:force:noscroll")
        .arg("-P")
        .arg(save_path)
        .args(extra_flags)
        .arg(url)
        .stderr(Stdio::piped())
        .stdout(Stdio::piped());

    cmd.spawn()
}

pub fn parse_progress_line(line: &str) -> Option<WgetProgress> {
    // Wget progress format: "  50% [=====>       ] 1,234,567   1.23MB/s  eta 2m 30s"
    let line = line.trim();

    // Look for percentage
    if let Some(pct_pos) = line.find('%') {
        let pct_start = line[..pct_pos]
            .rfind(|c: char| !c.is_ascii_digit())
            .map(|i| i + 1)
            .unwrap_or(0);
        if let Ok(percent) = line[pct_start..pct_pos].parse::<f64>() {
            let speed = extract_speed(line).unwrap_or_default();
            let eta = extract_eta(line).unwrap_or_default();
            return Some(WgetProgress {
                percent,
                speed,
                eta,
            });
        }
    }
    None
}

fn extract_speed(line: &str) -> Option<String> {
    // Look for patterns like "1.23MB/s" or "456KB/s"
    let parts: Vec<&str> = line.split_whitespace().collect();
    for part in parts {
        if part.ends_with("/s") {
            return Some(part.to_string());
        }
    }
    None
}

fn extract_eta(line: &str) -> Option<String> {
    if let Some(eta_pos) = line.find("eta") {
        let eta_str = line[eta_pos + 3..].trim();
        if !eta_str.is_empty() {
            return Some(eta_str.to_string());
        }
    }
    None
}
```

- [ ] **Step 2: Write download_manager.rs — queue and lifecycle management**

```rust
// apps/desktop/src-tauri/src/download_manager.rs
use crate::db;
use crate::wget;
use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::BufRead;
use std::process::Child;
use std::sync::Mutex;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Download {
    pub id: String,
    pub url: String,
    pub status: String,
    pub progress: f64,
    pub save_path: String,
    pub flags: String,
    pub error_message: Option<String>,
    pub wget_exit_code: Option<i32>,
    pub file_size: Option<i64>,
    pub created_at: String,
    pub completed_at: Option<String>,
    pub speed: Option<String>,
    pub eta: Option<String>,
}

pub struct DownloadManager {
    active_processes: Mutex<HashMap<String, Child>>,
}

impl DownloadManager {
    pub fn new() -> Self {
        Self {
            active_processes: Mutex::new(HashMap::new()),
        }
    }

    pub fn start_download(
        &self,
        conn: &Connection,
        url: &str,
        save_path: &str,
        flags: &[String],
    ) -> Result<String, String> {
        let id = Uuid::new_v4().to_string();

        conn.execute(
            "INSERT INTO downloads (id, url, status, save_path, flags) VALUES (?1, ?2, 'downloading', ?3, ?4)",
            params![id, url, save_path, flags.join(" ")],
        ).map_err(|e| format!("DB error: {}", e))?;

        let child = wget::spawn_wget(url, save_path, flags)
            .map_err(|e| format!("Failed to spawn wget: {}", e))?;

        self.active_processes
            .lock()
            .unwrap()
            .insert(id.clone(), child);

        Ok(id)
    }

    pub fn cancel_download(&self, conn: &Connection, id: &str) -> Result<(), String> {
        if let Some(mut child) = self.active_processes.lock().unwrap().remove(id) {
            let _ = child.kill();
        }
        conn.execute(
            "UPDATE downloads SET status = 'cancelled' WHERE id = ?1",
            params![id],
        ).map_err(|e| format!("DB error: {}", e))?;
        Ok(())
    }

    pub fn pause_download(&self, conn: &Connection, id: &str) -> Result<(), String> {
        // Kill the process - resume will use wget -c
        if let Some(mut child) = self.active_processes.lock().unwrap().remove(id) {
            let _ = child.kill();
        }
        conn.execute(
            "UPDATE downloads SET status = 'paused' WHERE id = ?1",
            params![id],
        ).map_err(|e| format!("DB error: {}", e))?;
        Ok(())
    }

    pub fn resume_download(&self, conn: &Connection, id: &str) -> Result<(), String> {
        let mut stmt = conn.prepare(
            "SELECT url, save_path, flags FROM downloads WHERE id = ?1"
        ).map_err(|e| format!("DB error: {}", e))?;

        let (url, save_path, flags_str): (String, String, String) = stmt
            .query_row(params![id], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?))
            })
            .map_err(|e| format!("Download not found: {}", e))?;

        let mut flags: Vec<String> = if flags_str.is_empty() {
            vec![]
        } else {
            flags_str.split_whitespace().map(String::from).collect()
        };

        // Add --continue flag for resume
        if !flags.contains(&"-c".to_string()) && !flags.contains(&"--continue".to_string()) {
            flags.push("--continue".to_string());
        }

        let child = wget::spawn_wget(&url, &save_path, &flags)
            .map_err(|e| format!("Failed to spawn wget: {}", e))?;

        self.active_processes
            .lock()
            .unwrap()
            .insert(id.to_string(), child);

        conn.execute(
            "UPDATE downloads SET status = 'downloading' WHERE id = ?1",
            params![id],
        ).map_err(|e| format!("DB error: {}", e))?;

        Ok(())
    }

    pub fn get_downloads(conn: &Connection) -> Result<Vec<Download>, String> {
        let mut stmt = conn.prepare(
            "SELECT id, url, status, progress, save_path, flags, error_message, wget_exit_code, file_size, created_at, completed_at FROM downloads ORDER BY created_at DESC"
        ).map_err(|e| format!("DB error: {}", e))?;

        let downloads = stmt
            .query_map([], |row| {
                Ok(Download {
                    id: row.get(0)?,
                    url: row.get(1)?,
                    status: row.get(2)?,
                    progress: row.get(3)?,
                    save_path: row.get(4)?,
                    flags: row.get(5)?,
                    error_message: row.get(6)?,
                    wget_exit_code: row.get(7)?,
                    file_size: row.get(8)?,
                    created_at: row.get(9)?,
                    completed_at: row.get(10)?,
                    speed: None,
                    eta: None,
                })
            })
            .map_err(|e| format!("DB error: {}", e))?
            .filter_map(|r| r.ok())
            .collect();

        Ok(downloads)
    }
}
```

- [ ] **Step 3: Add DownloadManager to AppState in lib.rs**

```rust
// apps/desktop/src-tauri/src/lib.rs
mod auth;
mod db;
mod download_manager;
mod wget;

use download_manager::DownloadManager;
use rusqlite::Connection;
use std::sync::Mutex;

pub struct AppState {
    pub db: Mutex<Connection>,
    pub api_token: String,
    pub download_manager: DownloadManager,
}

pub fn run() {
    let conn = Connection::open(db::db_path()).expect("Failed to open database");
    db::init_db(&conn).expect("Failed to initialize database");

    let api_token = auth::get_or_create_token();

    let state = AppState {
        db: Mutex::new(conn),
        api_token,
        download_manager: DownloadManager::new(),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(state)
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 4: Verify compilation**

Run: `cd apps/desktop && pnpm tauri build --debug 2>&1 | tail -5`
Expected: Compiles without errors

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src-tauri/src/
git commit -m "feat: add wget process manager and download lifecycle"
```

---

## Task 6: Tauri IPC Commands

**Files:**
- Create: `apps/desktop/src-tauri/src/commands.rs`
- Create: `apps/desktop/src-tauri/src/settings.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Write settings.rs**

```rust
// apps/desktop/src-tauri/src/settings.rs
use crate::db;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub default_save_path: String,
    pub one_click_mode: String,
    pub max_concurrent: u32,
    pub pro_unlocked: bool,
}

pub fn get_all_settings(conn: &Connection) -> Result<AppSettings, String> {
    let get = |key: &str, default: &str| -> String {
        db::get_setting(conn, key)
            .ok()
            .flatten()
            .unwrap_or_else(|| default.to_string())
    };

    Ok(AppSettings {
        default_save_path: get("default_save_path", "~/Downloads/Yoinkit/"),
        one_click_mode: get("one_click_mode", "page"),
        max_concurrent: get("max_concurrent", "3").parse().unwrap_or(3),
        pro_unlocked: get("pro_unlocked", "false") == "true",
    })
}

pub fn update_settings(conn: &Connection, settings: &AppSettings) -> Result<(), String> {
    db::set_setting(conn, "default_save_path", &settings.default_save_path)
        .map_err(|e| e.to_string())?;
    db::set_setting(conn, "one_click_mode", &settings.one_click_mode)
        .map_err(|e| e.to_string())?;
    db::set_setting(conn, "max_concurrent", &settings.max_concurrent.to_string())
        .map_err(|e| e.to_string())?;
    db::set_setting(conn, "pro_unlocked", if settings.pro_unlocked { "true" } else { "false" })
        .map_err(|e| e.to_string())?;
    Ok(())
}
```

- [ ] **Step 2: Write commands.rs — Tauri IPC commands**

```rust
// apps/desktop/src-tauri/src/commands.rs
use crate::download_manager::Download;
use crate::settings::{self, AppSettings};
use crate::AppState;
use serde::Deserialize;
use tauri::State;

#[derive(Deserialize)]
pub struct StartDownloadRequest {
    pub url: String,
    pub save_path: Option<String>,
    pub flags: Option<Vec<String>>,
}

#[tauri::command]
pub fn start_download(
    state: State<AppState>,
    request: StartDownloadRequest,
) -> Result<String, String> {
    let conn = state.db.lock().unwrap();
    let save_path = request
        .save_path
        .unwrap_or_else(|| {
            settings::get_all_settings(&conn)
                .map(|s| s.default_save_path)
                .unwrap_or_else(|_| "~/Downloads/Yoinkit/".to_string())
        });
    let flags = request.flags.unwrap_or_default();

    state
        .download_manager
        .start_download(&conn, &request.url, &save_path, &flags)
}

#[tauri::command]
pub fn get_downloads(state: State<AppState>) -> Result<Vec<Download>, String> {
    let conn = state.db.lock().unwrap();
    crate::download_manager::DownloadManager::get_downloads(&conn)
}

#[tauri::command]
pub fn pause_download(state: State<AppState>, id: String) -> Result<(), String> {
    let conn = state.db.lock().unwrap();
    state.download_manager.pause_download(&conn, &id)
}

#[tauri::command]
pub fn resume_download(state: State<AppState>, id: String) -> Result<(), String> {
    let conn = state.db.lock().unwrap();
    state.download_manager.resume_download(&conn, &id)
}

#[tauri::command]
pub fn cancel_download(state: State<AppState>, id: String) -> Result<(), String> {
    let conn = state.db.lock().unwrap();
    state.download_manager.cancel_download(&conn, &id)
}

#[tauri::command]
pub fn get_settings(state: State<AppState>) -> Result<AppSettings, String> {
    let conn = state.db.lock().unwrap();
    settings::get_all_settings(&conn)
}

#[tauri::command]
pub fn update_settings(
    state: State<AppState>,
    new_settings: AppSettings,
) -> Result<(), String> {
    let conn = state.db.lock().unwrap();
    settings::update_settings(&conn, &new_settings)
}

#[tauri::command]
pub fn get_api_token(state: State<AppState>) -> String {
    state.api_token.clone()
}
```

- [ ] **Step 3: Register commands in lib.rs**

```rust
// apps/desktop/src-tauri/src/lib.rs
mod auth;
mod commands;
mod db;
mod download_manager;
mod settings;
mod wget;

use download_manager::DownloadManager;
use rusqlite::Connection;
use std::sync::Mutex;

pub struct AppState {
    pub db: Mutex<Connection>,
    pub api_token: String,
    pub download_manager: DownloadManager,
}

pub fn run() {
    let conn = Connection::open(db::db_path()).expect("Failed to open database");
    db::init_db(&conn).expect("Failed to initialize database");

    let api_token = auth::get_or_create_token();

    let state = AppState {
        db: Mutex::new(conn),
        api_token,
        download_manager: DownloadManager::new(),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            commands::start_download,
            commands::get_downloads,
            commands::pause_download,
            commands::resume_download,
            commands::cancel_download,
            commands::get_settings,
            commands::update_settings,
            commands::get_api_token,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 4: Verify compilation**

Run: `cd apps/desktop && pnpm tauri build --debug 2>&1 | tail -5`
Expected: Compiles without errors

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src-tauri/src/
git commit -m "feat: add Tauri IPC commands for downloads and settings"
```

---

## Task 7: Localhost REST API Server

**Files:**
- Create: `apps/desktop/src-tauri/src/api.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Write api.rs — Axum HTTP server on port 9271**

```rust
// apps/desktop/src-tauri/src/api.rs
use crate::download_manager::{Download, DownloadManager};
use crate::settings::{self, AppSettings};
use crate::{auth, db};
use axum::{
    extract::{Path, State as AxumState},
    http::{HeaderMap, Method, StatusCode},
    routing::{delete, get, post, put},
    Json, Router,
};
use rusqlite::Connection;
use serde::Deserialize;
use std::sync::{Arc, Mutex};
use tower_http::cors::{Any, CorsLayer};

pub struct ApiState {
    pub db: Arc<Mutex<Connection>>,
    pub api_token: String,
    pub download_manager: Arc<DownloadManager>,
}

#[derive(Deserialize)]
pub struct DownloadRequest {
    pub url: String,
    pub save_path: Option<String>,
    pub flags: Option<Vec<String>>,
}

#[derive(serde::Serialize)]
struct ErrorResponse {
    error: String,
}

#[derive(serde::Serialize)]
struct IdResponse {
    id: String,
}

fn check_auth(headers: &HeaderMap, expected_token: &str) -> Result<(), (StatusCode, Json<ErrorResponse>)> {
    let auth_header = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    let token = auth_header.strip_prefix("Bearer ").unwrap_or("");

    if !auth::validate_token(token, expected_token) {
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(ErrorResponse {
                error: "Invalid or missing bearer token".to_string(),
            }),
        ));
    }
    Ok(())
}

async fn health() -> &'static str {
    "ok"
}

async fn create_download(
    AxumState(state): AxumState<Arc<ApiState>>,
    headers: HeaderMap,
    Json(req): Json<DownloadRequest>,
) -> Result<(StatusCode, Json<IdResponse>), (StatusCode, Json<ErrorResponse>)> {
    check_auth(&headers, &state.api_token)?;

    let conn = state.db.lock().unwrap();
    let save_path = req.save_path.unwrap_or_else(|| {
        settings::get_all_settings(&conn)
            .map(|s| s.default_save_path)
            .unwrap_or_else(|_| "~/Downloads/Yoinkit/".to_string())
    });
    let flags = req.flags.unwrap_or_default();

    match state.download_manager.start_download(&conn, &req.url, &save_path, &flags) {
        Ok(id) => Ok((StatusCode::CREATED, Json(IdResponse { id }))),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse { error: e }),
        )),
    }
}

async fn list_downloads(
    AxumState(state): AxumState<Arc<ApiState>>,
    headers: HeaderMap,
) -> Result<Json<Vec<Download>>, (StatusCode, Json<ErrorResponse>)> {
    check_auth(&headers, &state.api_token)?;
    let conn = state.db.lock().unwrap();
    match DownloadManager::get_downloads(&conn) {
        Ok(downloads) => Ok(Json(downloads)),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse { error: e }),
        )),
    }
}

async fn pause(
    AxumState(state): AxumState<Arc<ApiState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<StatusCode, (StatusCode, Json<ErrorResponse>)> {
    check_auth(&headers, &state.api_token)?;
    let conn = state.db.lock().unwrap();
    state
        .download_manager
        .pause_download(&conn, &id)
        .map(|_| StatusCode::OK)
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse { error: e }),
            )
        })
}

async fn resume(
    AxumState(state): AxumState<Arc<ApiState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<StatusCode, (StatusCode, Json<ErrorResponse>)> {
    check_auth(&headers, &state.api_token)?;
    let conn = state.db.lock().unwrap();
    state
        .download_manager
        .resume_download(&conn, &id)
        .map(|_| StatusCode::OK)
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse { error: e }),
            )
        })
}

async fn cancel(
    AxumState(state): AxumState<Arc<ApiState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<StatusCode, (StatusCode, Json<ErrorResponse>)> {
    check_auth(&headers, &state.api_token)?;
    let conn = state.db.lock().unwrap();
    state
        .download_manager
        .cancel_download(&conn, &id)
        .map(|_| StatusCode::OK)
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse { error: e }),
            )
        })
}

async fn get_settings_handler(
    AxumState(state): AxumState<Arc<ApiState>>,
    headers: HeaderMap,
) -> Result<Json<AppSettings>, (StatusCode, Json<ErrorResponse>)> {
    check_auth(&headers, &state.api_token)?;
    let conn = state.db.lock().unwrap();
    settings::get_all_settings(&conn)
        .map(Json)
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse { error: e }),
            )
        })
}

async fn update_settings_handler(
    AxumState(state): AxumState<Arc<ApiState>>,
    headers: HeaderMap,
    Json(new_settings): Json<AppSettings>,
) -> Result<StatusCode, (StatusCode, Json<ErrorResponse>)> {
    check_auth(&headers, &state.api_token)?;
    let conn = state.db.lock().unwrap();
    settings::update_settings(&conn, &new_settings)
        .map(|_| StatusCode::OK)
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse { error: e }),
            )
        })
}

pub async fn start_api_server(
    db: Arc<Mutex<Connection>>,
    api_token: String,
    download_manager: Arc<DownloadManager>,
) {
    let state = Arc::new(ApiState {
        db,
        api_token,
        download_manager,
    });

    let cors = CorsLayer::new()
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE])
        .allow_headers(Any)
        .allow_origin(Any); // Tightened per-extension in production

    let app = Router::new()
        .route("/health", get(health))
        .route("/download", post(create_download))
        .route("/downloads", get(list_downloads))
        .route("/downloads/{id}/pause", post(pause))
        .route("/downloads/{id}/resume", post(resume))
        .route("/downloads/{id}", delete(cancel))
        .route("/settings", get(get_settings_handler))
        .route("/settings", put(update_settings_handler))
        .layer(cors)
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("127.0.0.1:9271")
        .await
        .expect("Failed to bind to port 9271");

    axum::serve(listener, app)
        .await
        .expect("API server error");
}
```

- [ ] **Step 2: Launch API server in lib.rs alongside Tauri**

```rust
// apps/desktop/src-tauri/src/lib.rs
mod api;
mod auth;
mod commands;
mod db;
mod download_manager;
mod settings;
mod wget;

use download_manager::DownloadManager;
use rusqlite::Connection;
use std::sync::{Arc, Mutex};

pub struct AppState {
    pub db: Arc<Mutex<Connection>>,
    pub api_token: String,
    pub download_manager: Arc<DownloadManager>,
}

pub fn run() {
    let conn = Connection::open(db::db_path()).expect("Failed to open database");
    db::init_db(&conn).expect("Failed to initialize database");

    let api_token = auth::get_or_create_token();
    let db = Arc::new(Mutex::new(conn));
    let download_manager = Arc::new(DownloadManager::new());

    // Start API server in background
    let api_db = db.clone();
    let api_token_clone = api_token.clone();
    let api_dm = download_manager.clone();
    std::thread::spawn(move || {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(api::start_api_server(api_db, api_token_clone, api_dm));
    });

    let state = AppState {
        db,
        api_token,
        download_manager,
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            commands::start_download,
            commands::get_downloads,
            commands::pause_download,
            commands::resume_download,
            commands::cancel_download,
            commands::get_settings,
            commands::update_settings,
            commands::get_api_token,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 3: Update commands.rs for Arc types**

Update `commands.rs` to use `Arc<Mutex<Connection>>` and `Arc<DownloadManager>` instead of `Mutex<Connection>` and `DownloadManager` directly — match the new `AppState` struct.

- [ ] **Step 4: Verify compilation and test API**

Run: `cd apps/desktop && pnpm tauri dev`
Then in another terminal: `curl http://localhost:9271/health`
Expected: Response `ok`

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src-tauri/src/
git commit -m "feat: add localhost REST API server on port 9271"
```

---

## Task 8: Menu Bar Tray

**Files:**
- Create: `apps/desktop/src-tauri/src/tray.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Write tray.rs**

```rust
// apps/desktop/src-tauri/src/tray.rs
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    AppHandle, Manager,
};

pub fn create_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let show = MenuItem::with_id(app, "show", "Show Yoinkit", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &quit])?;

    TrayIconBuilder::new()
        .menu(&menu)
        .tooltip("Yoinkit")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}
```

- [ ] **Step 2: Wire tray into lib.rs using setup hook**

Add to `lib.rs` after `.manage(state)`:

```rust
.setup(|app| {
    tray::create_tray(app.handle())?;
    Ok(())
})
```

Add `mod tray;` to the top of lib.rs.

- [ ] **Step 3: Verify tray icon appears**

Run: `cd apps/desktop && pnpm tauri dev`
Expected: Tray icon appears in macOS menu bar with "Show Yoinkit" and "Quit" options

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src-tauri/src/tray.rs apps/desktop/src-tauri/src/lib.rs
git commit -m "feat: add macOS menu bar tray icon"
```

---

## Task 9: Desktop App Frontend — Simple Mode

**Files:**
- Create: `apps/desktop/src/hooks/useDownloads.ts`
- Create: `apps/desktop/src/hooks/useSettings.ts`
- Create: `apps/desktop/src/lib/tauri.ts`
- Create: `apps/desktop/src/components/UrlInput.tsx`
- Create: `apps/desktop/src/components/DownloadItem.tsx`
- Create: `apps/desktop/src/components/DownloadList.tsx`
- Create: `apps/desktop/src/pages/SimplePage.tsx`
- Create: `apps/desktop/src/pages/SettingsPage.tsx`
- Modify: `apps/desktop/src/App.tsx`

- [ ] **Step 1: Create Tauri command bindings**

```ts
// apps/desktop/src/lib/tauri.ts
import { invoke } from "@tauri-apps/api/core";

export interface Download {
  id: string;
  url: string;
  status: string;
  progress: number;
  save_path: string;
  flags: string;
  error_message: string | null;
  wget_exit_code: number | null;
  file_size: number | null;
  created_at: string;
  completed_at: string | null;
  speed: string | null;
  eta: string | null;
}

export interface AppSettings {
  default_save_path: string;
  one_click_mode: string;
  max_concurrent: number;
  pro_unlocked: boolean;
}

export const api = {
  startDownload: (url: string, savePath?: string, flags?: string[]) =>
    invoke<string>("start_download", {
      request: { url, save_path: savePath, flags },
    }),

  getDownloads: () => invoke<Download[]>("get_downloads"),

  pauseDownload: (id: string) => invoke<void>("pause_download", { id }),

  resumeDownload: (id: string) => invoke<void>("resume_download", { id }),

  cancelDownload: (id: string) => invoke<void>("cancel_download", { id }),

  getSettings: () => invoke<AppSettings>("get_settings"),

  updateSettings: (settings: AppSettings) =>
    invoke<void>("update_settings", { newSettings: settings }),

  getApiToken: () => invoke<string>("get_api_token"),
};
```

- [ ] **Step 2: Create hooks**

```ts
// apps/desktop/src/hooks/useDownloads.ts
import { useCallback, useEffect, useState } from "react";
import { api, Download } from "../lib/tauri";

export function useDownloads() {
  const [downloads, setDownloads] = useState<Download[]>([]);

  const refresh = useCallback(async () => {
    const data = await api.getDownloads();
    setDownloads(data);
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 1000);
    return () => clearInterval(interval);
  }, [refresh]);

  const startDownload = async (url: string) => {
    await api.startDownload(url);
    refresh();
  };

  const pause = async (id: string) => {
    await api.pauseDownload(id);
    refresh();
  };

  const resume = async (id: string) => {
    await api.resumeDownload(id);
    refresh();
  };

  const cancel = async (id: string) => {
    await api.cancelDownload(id);
    refresh();
  };

  return { downloads, startDownload, pause, resume, cancel, refresh };
}
```

```ts
// apps/desktop/src/hooks/useSettings.ts
import { useCallback, useEffect, useState } from "react";
import { api, AppSettings } from "../lib/tauri";

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);

  const refresh = useCallback(async () => {
    const data = await api.getSettings();
    setSettings(data);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const update = async (newSettings: AppSettings) => {
    await api.updateSettings(newSettings);
    setSettings(newSettings);
  };

  return { settings, update, refresh };
}
```

- [ ] **Step 3: Create UrlInput component**

```tsx
// apps/desktop/src/components/UrlInput.tsx
import { useState } from "react";

interface Props {
  onSubmit: (url: string) => void;
}

export function UrlInput({ onSubmit }: Props) {
  const [url, setUrl] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onSubmit(url.trim());
      setUrl("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Paste URL here..."
        className="flex-1 bg-yoinkit-surface text-yoinkit-text border border-slate-600 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-yoinkit-primary placeholder:text-yoinkit-muted"
      />
      <button
        type="submit"
        className="bg-yoinkit-primary hover:bg-indigo-400 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
      >
        Yoink!
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Create DownloadItem and DownloadList components**

```tsx
// apps/desktop/src/components/DownloadItem.tsx
import { Download } from "../lib/tauri";

interface Props {
  download: Download;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
}

export function DownloadItem({ download, onPause, onResume, onCancel }: Props) {
  const statusColors: Record<string, string> = {
    downloading: "text-yoinkit-primary",
    completed: "text-yoinkit-success",
    paused: "text-yoinkit-warning",
    cancelled: "text-yoinkit-danger",
    failed: "text-yoinkit-danger",
  };

  return (
    <div className="bg-yoinkit-surface rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-yoinkit-text truncate max-w-md" title={download.url}>
          {download.url}
        </span>
        <span className={`text-xs font-medium ${statusColors[download.status] || "text-yoinkit-muted"}`}>
          {download.status}
        </span>
      </div>

      {download.status === "downloading" && (
        <div className="mb-2">
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div
              className="bg-yoinkit-primary h-2 rounded-full transition-all"
              style={{ width: `${download.progress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-yoinkit-muted mt-1">
            <span>{download.progress.toFixed(1)}%</span>
            {download.speed && <span>{download.speed}</span>}
            {download.eta && <span>ETA: {download.eta}</span>}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {download.status === "downloading" && (
          <button
            onClick={() => onPause(download.id)}
            className="text-xs text-yoinkit-muted hover:text-yoinkit-warning"
          >
            Pause
          </button>
        )}
        {download.status === "paused" && (
          <button
            onClick={() => onResume(download.id)}
            className="text-xs text-yoinkit-muted hover:text-yoinkit-primary"
          >
            Resume
          </button>
        )}
        {(download.status === "downloading" || download.status === "paused") && (
          <button
            onClick={() => onCancel(download.id)}
            className="text-xs text-yoinkit-muted hover:text-yoinkit-danger"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
```

```tsx
// apps/desktop/src/components/DownloadList.tsx
import { Download } from "../lib/tauri";
import { DownloadItem } from "./DownloadItem";

interface Props {
  downloads: Download[];
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
}

export function DownloadList({ downloads, onPause, onResume, onCancel }: Props) {
  if (downloads.length === 0) {
    return (
      <div className="text-center text-yoinkit-muted py-12">
        <p className="text-lg">No downloads yet</p>
        <p className="text-sm mt-1">Paste a URL above to get started</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {downloads.map((d) => (
        <DownloadItem
          key={d.id}
          download={d}
          onPause={onPause}
          onResume={onResume}
          onCancel={onCancel}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Create SimplePage**

```tsx
// apps/desktop/src/pages/SimplePage.tsx
import { UrlInput } from "../components/UrlInput";
import { DownloadList } from "../components/DownloadList";
import { useDownloads } from "../hooks/useDownloads";

export function SimplePage() {
  const { downloads, startDownload, pause, resume, cancel } = useDownloads();

  return (
    <div className="space-y-6">
      <UrlInput onSubmit={startDownload} />
      <DownloadList
        downloads={downloads}
        onPause={pause}
        onResume={resume}
        onCancel={cancel}
      />
    </div>
  );
}
```

- [ ] **Step 6: Create SettingsPage**

```tsx
// apps/desktop/src/pages/SettingsPage.tsx
import { useSettings } from "../hooks/useSettings";

export function SettingsPage() {
  const { settings, update } = useSettings();

  if (!settings) return <p className="text-yoinkit-muted">Loading...</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Settings</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-yoinkit-muted mb-1">Default save path</label>
          <input
            type="text"
            value={settings.default_save_path}
            onChange={(e) => update({ ...settings, default_save_path: e.target.value })}
            className="w-full bg-yoinkit-surface text-yoinkit-text border border-slate-600 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yoinkit-primary"
          />
        </div>

        <div>
          <label className="block text-sm text-yoinkit-muted mb-1">One-click download mode</label>
          <select
            value={settings.one_click_mode}
            onChange={(e) => update({ ...settings, one_click_mode: e.target.value })}
            className="w-full bg-yoinkit-surface text-yoinkit-text border border-slate-600 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yoinkit-primary"
          >
            <option value="page">Current page only</option>
            <option value="site">Whole site (recursive)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-yoinkit-muted mb-1">Max concurrent downloads</label>
          <input
            type="number"
            min={1}
            max={10}
            value={settings.max_concurrent}
            onChange={(e) => update({ ...settings, max_concurrent: parseInt(e.target.value) || 3 })}
            className="w-24 bg-yoinkit-surface text-yoinkit-text border border-slate-600 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yoinkit-primary"
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Update App.tsx with routing**

```tsx
// apps/desktop/src/App.tsx
import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import { SimplePage } from "./pages/SimplePage";
import { SettingsPage } from "./pages/SettingsPage";

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-yoinkit-bg text-yoinkit-text">
        <header className="border-b border-slate-700 px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">Yoinkit</h1>
          <nav className="flex gap-4">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `text-sm ${isActive ? "text-yoinkit-primary" : "text-yoinkit-muted hover:text-yoinkit-text"}`
              }
            >
              Downloads
            </NavLink>
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `text-sm ${isActive ? "text-yoinkit-primary" : "text-yoinkit-muted hover:text-yoinkit-text"}`
              }
            >
              Settings
            </NavLink>
          </nav>
        </header>
        <main className="p-6">
          <Routes>
            <Route path="/" element={<SimplePage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
```

- [ ] **Step 8: Verify the app renders correctly**

Run: `cd apps/desktop && pnpm tauri dev`
Expected: App shows with nav bar, URL input, empty download list, and settings page

- [ ] **Step 9: Commit**

```bash
git add apps/desktop/src/
git commit -m "feat: add Simple mode frontend with URL input, download list, and settings"
```

---

## Task 10: Desktop App Frontend — Pro Mode

**Files:**
- Create: `apps/desktop/src/components/CommandBuilder.tsx`
- Create: `apps/desktop/src/components/CommandPreview.tsx`
- Create: `apps/desktop/src/components/PresetManager.tsx`
- Create: `apps/desktop/src/components/BatchInput.tsx`
- Create: `apps/desktop/src/pages/ProPage.tsx`
- Modify: `apps/desktop/src/App.tsx`

- [ ] **Step 1: Create CommandBuilder — visual flag selector for common flags**

```tsx
// apps/desktop/src/components/CommandBuilder.tsx
import { useState } from "react";

export interface WgetFlags {
  recursive: boolean;
  depth: number;
  continueDownload: boolean;
  mirror: boolean;
  convertLinks: boolean;
  pageRequisites: boolean;
  noClobber: boolean;
  limitRate: string;
  accept: string;
  reject: string;
  excludeDirs: string;
  userAgent: string;
  httpUser: string;
  httpPassword: string;
  retries: number;
  timeout: number;
  waitBetween: number;
  randomWait: boolean;
  rawFlags: string;
}

const defaultFlags: WgetFlags = {
  recursive: false,
  depth: 5,
  continueDownload: false,
  mirror: false,
  convertLinks: false,
  pageRequisites: false,
  noClobber: false,
  limitRate: "",
  accept: "",
  reject: "",
  excludeDirs: "",
  userAgent: "",
  httpUser: "",
  httpPassword: "",
  retries: 20,
  timeout: 900,
  waitBetween: 0,
  randomWait: false,
  rawFlags: "",
};

interface Props {
  flags: WgetFlags;
  onChange: (flags: WgetFlags) => void;
}

export function CommandBuilder({ flags, onChange }: Props) {
  const set = <K extends keyof WgetFlags>(key: K, value: WgetFlags[K]) =>
    onChange({ ...flags, [key]: value });

  return (
    <div className="space-y-4">
      {/* Recursion */}
      <fieldset className="border border-slate-600 rounded-lg p-4">
        <legend className="text-sm font-medium text-yoinkit-muted px-2">Recursion</legend>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={flags.recursive} onChange={(e) => set("recursive", e.target.checked)} />
            Recursive download (-r)
          </label>
          {flags.recursive && (
            <label className="flex items-center gap-2 text-sm ml-6">
              Depth: <input type="number" min={1} max={99} value={flags.depth} onChange={(e) => set("depth", parseInt(e.target.value) || 5)} className="w-16 bg-yoinkit-surface border border-slate-600 rounded px-2 py-1 text-sm" />
            </label>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={flags.mirror} onChange={(e) => set("mirror", e.target.checked)} />
            Mirror mode (--mirror)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={flags.convertLinks} onChange={(e) => set("convertLinks", e.target.checked)} />
            Convert links for offline viewing (-k)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={flags.pageRequisites} onChange={(e) => set("pageRequisites", e.target.checked)} />
            Download page requisites (-p)
          </label>
        </div>
      </fieldset>

      {/* Download behavior */}
      <fieldset className="border border-slate-600 rounded-lg p-4">
        <legend className="text-sm font-medium text-yoinkit-muted px-2">Download Behavior</legend>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={flags.continueDownload} onChange={(e) => set("continueDownload", e.target.checked)} />
            Continue partial download (-c)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={flags.noClobber} onChange={(e) => set("noClobber", e.target.checked)} />
            Don't overwrite existing files (-nc)
          </label>
          <label className="flex items-center gap-2 text-sm">
            Rate limit: <input type="text" value={flags.limitRate} onChange={(e) => set("limitRate", e.target.value)} placeholder="e.g. 500k, 2m" className="w-32 bg-yoinkit-surface border border-slate-600 rounded px-2 py-1 text-sm" />
          </label>
          <label className="flex items-center gap-2 text-sm">
            Retries: <input type="number" min={0} value={flags.retries} onChange={(e) => set("retries", parseInt(e.target.value) || 20)} className="w-16 bg-yoinkit-surface border border-slate-600 rounded px-2 py-1 text-sm" />
          </label>
          <label className="flex items-center gap-2 text-sm">
            Timeout (sec): <input type="number" min={0} value={flags.timeout} onChange={(e) => set("timeout", parseInt(e.target.value) || 900)} className="w-20 bg-yoinkit-surface border border-slate-600 rounded px-2 py-1 text-sm" />
          </label>
        </div>
      </fieldset>

      {/* Filtering */}
      <fieldset className="border border-slate-600 rounded-lg p-4">
        <legend className="text-sm font-medium text-yoinkit-muted px-2">Filtering</legend>
        <div className="space-y-2">
          <label className="block text-sm">
            Accept file types (-A): <input type="text" value={flags.accept} onChange={(e) => set("accept", e.target.value)} placeholder="e.g. jpg,png,gif" className="w-full mt-1 bg-yoinkit-surface border border-slate-600 rounded px-2 py-1 text-sm" />
          </label>
          <label className="block text-sm">
            Reject file types (-R): <input type="text" value={flags.reject} onChange={(e) => set("reject", e.target.value)} placeholder="e.g. exe,zip" className="w-full mt-1 bg-yoinkit-surface border border-slate-600 rounded px-2 py-1 text-sm" />
          </label>
          <label className="block text-sm">
            Exclude directories (-X): <input type="text" value={flags.excludeDirs} onChange={(e) => set("excludeDirs", e.target.value)} placeholder="e.g. /ads,/tracking" className="w-full mt-1 bg-yoinkit-surface border border-slate-600 rounded px-2 py-1 text-sm" />
          </label>
        </div>
      </fieldset>

      {/* Throttling */}
      <fieldset className="border border-slate-600 rounded-lg p-4">
        <legend className="text-sm font-medium text-yoinkit-muted px-2">Throttling</legend>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            Wait between requests (sec): <input type="number" min={0} value={flags.waitBetween} onChange={(e) => set("waitBetween", parseInt(e.target.value) || 0)} className="w-16 bg-yoinkit-surface border border-slate-600 rounded px-2 py-1 text-sm" />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={flags.randomWait} onChange={(e) => set("randomWait", e.target.checked)} />
            Random wait (--random-wait)
          </label>
        </div>
      </fieldset>

      {/* Authentication */}
      <fieldset className="border border-slate-600 rounded-lg p-4">
        <legend className="text-sm font-medium text-yoinkit-muted px-2">Authentication</legend>
        <div className="space-y-2">
          <label className="block text-sm">
            User Agent: <input type="text" value={flags.userAgent} onChange={(e) => set("userAgent", e.target.value)} placeholder="Custom user agent string" className="w-full mt-1 bg-yoinkit-surface border border-slate-600 rounded px-2 py-1 text-sm" />
          </label>
          <label className="block text-sm">
            HTTP User: <input type="text" value={flags.httpUser} onChange={(e) => set("httpUser", e.target.value)} className="w-full mt-1 bg-yoinkit-surface border border-slate-600 rounded px-2 py-1 text-sm" />
          </label>
          <label className="block text-sm">
            HTTP Password: <input type="password" value={flags.httpPassword} onChange={(e) => set("httpPassword", e.target.value)} className="w-full mt-1 bg-yoinkit-surface border border-slate-600 rounded px-2 py-1 text-sm" />
          </label>
        </div>
      </fieldset>

      {/* Raw flags escape hatch */}
      <fieldset className="border border-slate-600 rounded-lg p-4">
        <legend className="text-sm font-medium text-yoinkit-muted px-2">Raw Flags</legend>
        <label className="block text-sm">
          Additional wget flags (advanced):
          <input type="text" value={flags.rawFlags} onChange={(e) => set("rawFlags", e.target.value)} placeholder="e.g. --no-check-certificate --header='Cookie: val'" className="w-full mt-1 bg-yoinkit-surface border border-slate-600 rounded px-2 py-1 text-sm font-mono" />
        </label>
      </fieldset>
    </div>
  );
}

export function flagsToArgs(flags: WgetFlags): string[] {
  const args: string[] = [];
  if (flags.recursive) { args.push("-r"); args.push("-l"); args.push(flags.depth.toString()); }
  if (flags.continueDownload) args.push("-c");
  if (flags.mirror) args.push("--mirror");
  if (flags.convertLinks) args.push("-k");
  if (flags.pageRequisites) args.push("-p");
  if (flags.noClobber) args.push("-nc");
  if (flags.limitRate) { args.push("--limit-rate"); args.push(flags.limitRate); }
  if (flags.accept) { args.push("-A"); args.push(flags.accept); }
  if (flags.reject) { args.push("-R"); args.push(flags.reject); }
  if (flags.excludeDirs) { args.push("-X"); args.push(flags.excludeDirs); }
  if (flags.userAgent) { args.push("-U"); args.push(flags.userAgent); }
  if (flags.httpUser) { args.push("--http-user"); args.push(flags.httpUser); }
  if (flags.httpPassword) { args.push("--http-password"); args.push(flags.httpPassword); }
  if (flags.retries !== 20) { args.push("-t"); args.push(flags.retries.toString()); }
  if (flags.timeout !== 900) { args.push("-T"); args.push(flags.timeout.toString()); }
  if (flags.waitBetween > 0) { args.push("-w"); args.push(flags.waitBetween.toString()); }
  if (flags.randomWait) args.push("--random-wait");
  if (flags.rawFlags.trim()) { args.push(...flags.rawFlags.trim().split(/\s+/)); }
  return args;
}

export { defaultFlags };
```

- [ ] **Step 2: Create CommandPreview**

```tsx
// apps/desktop/src/components/CommandPreview.tsx
import { WgetFlags, flagsToArgs } from "./CommandBuilder";

interface Props {
  url: string;
  flags: WgetFlags;
  savePath: string;
}

export function CommandPreview({ url, flags, savePath }: Props) {
  const args = flagsToArgs(flags);
  const command = ["wget", ...args, "-P", savePath, url].join(" ");

  return (
    <div className="bg-slate-900 border border-slate-600 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-yoinkit-muted">Command Preview</span>
        <button
          onClick={() => navigator.clipboard.writeText(command)}
          className="text-xs text-yoinkit-primary hover:text-indigo-400"
        >
          Copy
        </button>
      </div>
      <code className="text-sm text-green-400 font-mono break-all">{command}</code>
    </div>
  );
}
```

- [ ] **Step 3: Create BatchInput**

```tsx
// apps/desktop/src/components/BatchInput.tsx
import { useState } from "react";

interface Props {
  onSubmit: (urls: string[]) => void;
}

export function BatchInput({ onSubmit }: Props) {
  const [text, setText] = useState("");

  const handleSubmit = () => {
    const urls = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && line.startsWith("http"));
    if (urls.length > 0) {
      onSubmit(urls);
      setText("");
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm text-yoinkit-muted">Batch URLs (one per line)</label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder={"https://example.com/file1.zip\nhttps://example.com/file2.zip"}
        className="w-full bg-yoinkit-surface text-yoinkit-text border border-slate-600 rounded-lg px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-yoinkit-primary placeholder:text-yoinkit-muted"
      />
      <button
        onClick={handleSubmit}
        className="bg-yoinkit-primary hover:bg-indigo-400 text-white font-semibold px-6 py-2 rounded-lg transition-colors text-sm"
      >
        Yoink All!
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Create PresetManager (stub — saves/loads flag configurations)**

```tsx
// apps/desktop/src/components/PresetManager.tsx
import { WgetFlags } from "./CommandBuilder";

interface Preset {
  name: string;
  flags: WgetFlags;
}

const builtInPresets: Preset[] = [
  {
    name: "Mirror full site",
    flags: {
      recursive: true, depth: 99, continueDownload: true, mirror: true,
      convertLinks: true, pageRequisites: true, noClobber: false,
      limitRate: "", accept: "", reject: "", excludeDirs: "",
      userAgent: "", httpUser: "", httpPassword: "",
      retries: 20, timeout: 900, waitBetween: 1, randomWait: true, rawFlags: "",
    },
  },
  {
    name: "Download all PDFs",
    flags: {
      recursive: true, depth: 5, continueDownload: true, mirror: false,
      convertLinks: false, pageRequisites: false, noClobber: true,
      limitRate: "", accept: "pdf", reject: "", excludeDirs: "",
      userAgent: "", httpUser: "", httpPassword: "",
      retries: 20, timeout: 900, waitBetween: 0, randomWait: false, rawFlags: "",
    },
  },
  {
    name: "Download all images",
    flags: {
      recursive: true, depth: 5, continueDownload: true, mirror: false,
      convertLinks: false, pageRequisites: false, noClobber: true,
      limitRate: "", accept: "jpg,jpeg,png,gif,webp,svg", reject: "", excludeDirs: "",
      userAgent: "", httpUser: "", httpPassword: "",
      retries: 20, timeout: 900, waitBetween: 0, randomWait: false, rawFlags: "",
    },
  },
];

interface Props {
  onSelect: (flags: WgetFlags) => void;
}

export function PresetManager({ onSelect }: Props) {
  return (
    <div className="space-y-2">
      <label className="block text-sm text-yoinkit-muted">Quick Presets</label>
      <div className="flex flex-wrap gap-2">
        {builtInPresets.map((preset) => (
          <button
            key={preset.name}
            onClick={() => onSelect(preset.flags)}
            className="bg-yoinkit-surface border border-slate-600 hover:border-yoinkit-primary text-yoinkit-text text-xs px-3 py-1.5 rounded-lg transition-colors"
          >
            {preset.name}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create ProPage**

```tsx
// apps/desktop/src/pages/ProPage.tsx
import { useState } from "react";
import { CommandBuilder, WgetFlags, defaultFlags, flagsToArgs } from "../components/CommandBuilder";
import { CommandPreview } from "../components/CommandPreview";
import { PresetManager } from "../components/PresetManager";
import { BatchInput } from "../components/BatchInput";
import { DownloadList } from "../components/DownloadList";
import { useDownloads } from "../hooks/useDownloads";
import { useSettings } from "../hooks/useSettings";
import { api } from "../lib/tauri";

export function ProPage() {
  const [url, setUrl] = useState("");
  const [flags, setFlags] = useState<WgetFlags>(defaultFlags);
  const [mode, setMode] = useState<"single" | "batch">("single");
  const { downloads, pause, resume, cancel, refresh } = useDownloads();
  const { settings } = useSettings();
  const savePath = settings?.default_save_path || "~/Downloads/Yoinkit/";

  const handleDownload = async () => {
    if (!url.trim()) return;
    const args = flagsToArgs(flags);
    await api.startDownload(url.trim(), savePath, args);
    setUrl("");
    refresh();
  };

  const handleBatch = async (urls: string[]) => {
    const args = flagsToArgs(flags);
    for (const u of urls) {
      await api.startDownload(u, savePath, args);
    }
    refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-slate-700 pb-2">
        <button
          onClick={() => setMode("single")}
          className={`text-sm px-3 py-1 rounded ${mode === "single" ? "bg-yoinkit-primary text-white" : "text-yoinkit-muted"}`}
        >
          Single URL
        </button>
        <button
          onClick={() => setMode("batch")}
          className={`text-sm px-3 py-1 rounded ${mode === "batch" ? "bg-yoinkit-primary text-white" : "text-yoinkit-muted"}`}
        >
          Batch
        </button>
      </div>

      {mode === "single" ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste URL here..."
            className="flex-1 bg-yoinkit-surface text-yoinkit-text border border-slate-600 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-yoinkit-primary placeholder:text-yoinkit-muted"
          />
          <button
            onClick={handleDownload}
            className="bg-yoinkit-primary hover:bg-indigo-400 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
          >
            Yoink!
          </button>
        </div>
      ) : (
        <BatchInput onSubmit={handleBatch} />
      )}

      <PresetManager onSelect={setFlags} />
      <CommandBuilder flags={flags} onChange={setFlags} />
      <CommandPreview url={url || "https://example.com"} flags={flags} savePath={savePath} />

      <DownloadList
        downloads={downloads}
        onPause={pause}
        onResume={resume}
        onCancel={cancel}
      />
    </div>
  );
}
```

- [ ] **Step 6: Update App.tsx to include Pro page with gating**

Update `App.tsx` to add a "Pro" nav link and route. Show a lock icon if `pro_unlocked` is false, and render the ProPage or a "Pro features locked" message accordingly.

```tsx
// Add to App.tsx imports:
import { ProPage } from "./pages/ProPage";
import { useSettings } from "./hooks/useSettings";

// Add Pro NavLink in the nav:
<NavLink
  to="/pro"
  className={({ isActive }) =>
    `text-sm ${isActive ? "text-yoinkit-primary" : "text-yoinkit-muted hover:text-yoinkit-text"}`
  }
>
  Pro
</NavLink>

// Add Pro route:
<Route path="/pro" element={<ProPage />} />
```

- [ ] **Step 7: Verify Pro mode renders**

Run: `cd apps/desktop && pnpm tauri dev`
Expected: Pro tab shows command builder with presets, flag controls, live command preview, and batch input

- [ ] **Step 8: Commit**

```bash
git add apps/desktop/src/
git commit -m "feat: add Pro mode with command builder, presets, batch downloads"
```

---

## Task 11: Browser Extension

**Files:**
- Create: `apps/extension/package.json`, `apps/extension/vite.config.ts`, `apps/extension/tsconfig.json`
- Create: `apps/extension/tailwind.config.js`, `apps/extension/postcss.config.js`
- Create: `apps/extension/src/lib/api.ts`
- Create: `apps/extension/src/background/service-worker.ts`
- Create: `apps/extension/src/popup/popup.html`, `apps/extension/src/popup/Popup.tsx`, `apps/extension/src/popup/popup.css`
- Create: `apps/extension/src/popup/main.tsx`
- Create: `apps/extension/manifests/chrome-manifest.json`

- [ ] **Step 1: Create extension package.json**

```json
// apps/extension/package.json
{
  "name": "@yoinkit/extension",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "vite build --watch",
    "build": "vite build"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@types/chrome": "^0.0.268",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.5.0",
    "vite": "^5.4.0"
  }
}
```

- [ ] **Step 2: Create Vite config for extension (multi-entry build)**

```ts
// apps/extension/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "src/popup/popup.html"),
        "service-worker": resolve(__dirname, "src/background/service-worker.ts"),
      },
      output: {
        entryFileNames: "[name].js",
      },
    },
  },
});
```

```js
// apps/extension/tailwind.config.js
const yoinkitPreset = require("@yoinkit/ui/tailwind-preset");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  presets: [yoinkitPreset],
  plugins: [],
};
```

```js
// apps/extension/postcss.config.js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

```json
// apps/extension/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["chrome"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create API client**

```ts
// apps/extension/src/lib/api.ts
const API_BASE = "http://localhost:9271";

async function getToken(): Promise<string> {
  return new Promise((resolve) => {
    chrome.storage.local.get("api_token", (result) => {
      resolve(result.api_token || "");
    });
  });
}

export async function setToken(token: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ api_token: token }, resolve);
  });
}

async function request(path: string, options: RequestInit = {}) {
  const token = await getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  return res;
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

export async function startDownload(
  url: string,
  savePath?: string,
  flags?: string[]
) {
  const res = await request("/download", {
    method: "POST",
    body: JSON.stringify({ url, save_path: savePath, flags }),
  });
  return res.json();
}

export async function getDownloads() {
  const res = await request("/downloads");
  return res.json();
}

export async function getSettings() {
  const res = await request("/settings");
  return res.json();
}
```

- [ ] **Step 4: Create background service worker**

```ts
// apps/extension/src/background/service-worker.ts
import { checkHealth, startDownload, getSettings } from "../lib/api";

// One-click toolbar button: download current tab
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.url || tab.url.startsWith("chrome://")) return;

  const healthy = await checkHealth();
  if (!healthy) {
    chrome.action.setBadgeText({ text: "!", tabId: tab.id });
    chrome.action.setBadgeBackgroundColor({ color: "#ef4444" });
    // Try to open Yoinkit via custom URL scheme
    chrome.tabs.create({ url: "yoinkit://open" });
    return;
  }

  try {
    const settings = await getSettings();
    const flags: string[] = [];
    if (settings.one_click_mode === "site") {
      flags.push("--mirror", "-k", "-p");
    }

    await startDownload(tab.url, undefined, flags);

    // Show success badge briefly
    chrome.action.setBadgeText({ text: "OK", tabId: tab.id });
    chrome.action.setBadgeBackgroundColor({ color: "#22c55e" });
    setTimeout(() => {
      chrome.action.setBadgeText({ text: "", tabId: tab.id });
    }, 2000);
  } catch (err) {
    chrome.action.setBadgeText({ text: "!", tabId: tab.id });
    chrome.action.setBadgeBackgroundColor({ color: "#ef4444" });
  }
});

// Context menu for opening popup
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "yoinkit-options",
    title: "Yoinkit Options",
    contexts: ["action"],
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === "yoinkit-options") {
    chrome.action.setPopup({ popup: "src/popup/popup.html" });
    chrome.action.openPopup();
    // Reset to no popup (one-click mode) after
    setTimeout(() => {
      chrome.action.setPopup({ popup: "" });
    }, 100);
  }
});
```

- [ ] **Step 5: Create popup UI**

```html
<!-- apps/extension/src/popup/popup.html -->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Yoinkit</title>
  </head>
  <body style="width: 380px; min-height: 400px;">
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

```tsx
// apps/extension/src/popup/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { Popup } from "./Popup";
import "./popup.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
);
```

```css
/* apps/extension/src/popup/popup.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

```tsx
// apps/extension/src/popup/Popup.tsx
import { useEffect, useState } from "react";
import { checkHealth, startDownload, setToken } from "../lib/api";

export function Popup() {
  const [url, setUrl] = useState("");
  const [connected, setConnected] = useState<boolean | null>(null);
  const [status, setStatus] = useState("");
  const [token, setTokenInput] = useState("");
  const [showTokenInput, setShowTokenInput] = useState(false);

  useEffect(() => {
    // Pre-fill with current tab URL
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.url) setUrl(tabs[0].url);
    });

    checkHealth().then(setConnected);
  }, []);

  const handleDownload = async () => {
    if (!url.trim()) return;
    try {
      await startDownload(url.trim());
      setStatus("Sent to Yoinkit!");
      setTimeout(() => setStatus(""), 2000);
    } catch {
      setStatus("Failed — check Yoinkit app");
    }
  };

  const handleSaveToken = async () => {
    await setToken(token);
    setShowTokenInput(false);
    checkHealth().then(setConnected);
  };

  return (
    <div className="bg-yoinkit-bg text-yoinkit-text p-4 min-h-[400px]">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold">Yoinkit</h1>
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              connected === true
                ? "bg-yoinkit-success"
                : connected === false
                ? "bg-yoinkit-danger"
                : "bg-yoinkit-muted"
            }`}
          />
          <span className="text-xs text-yoinkit-muted">
            {connected === true ? "Connected" : connected === false ? "Not connected" : "Checking..."}
          </span>
        </div>
      </div>

      {connected === false && (
        <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 mb-4">
          <p className="text-sm text-yoinkit-warning mb-2">
            Yoinkit app is not running. Please open the app first.
          </p>
          {!showTokenInput ? (
            <button
              onClick={() => setShowTokenInput(true)}
              className="text-xs text-yoinkit-primary hover:text-indigo-400"
            >
              Set API token
            </button>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={token}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Paste API token..."
                className="flex-1 bg-yoinkit-surface border border-slate-600 rounded px-2 py-1 text-xs"
              />
              <button
                onClick={handleSaveToken}
                className="bg-yoinkit-primary text-white text-xs px-3 py-1 rounded"
              >
                Save
              </button>
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="URL..."
            className="flex-1 bg-yoinkit-surface text-yoinkit-text border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yoinkit-primary placeholder:text-yoinkit-muted"
          />
          <button
            onClick={handleDownload}
            disabled={connected !== true}
            className="bg-yoinkit-primary hover:bg-indigo-400 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg transition-colors text-sm"
          >
            Yoink!
          </button>
        </div>

        {status && (
          <p className={`text-sm ${status.includes("Failed") ? "text-yoinkit-danger" : "text-yoinkit-success"}`}>
            {status}
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Create Chrome Manifest V3**

```json
// apps/extension/manifests/chrome-manifest.json
{
  "manifest_version": 3,
  "name": "Yoinkit",
  "version": "0.1.0",
  "description": "Download anything from the web with one click. Powered by Wget.",
  "permissions": [
    "activeTab",
    "contextMenus",
    "storage"
  ],
  "host_permissions": [
    "http://localhost:9271/*"
  ],
  "action": {
    "default_title": "Yoinkit - Click to download"
  },
  "background": {
    "service_worker": "service-worker.js"
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

- [ ] **Step 7: Add build script to copy manifest into dist**

Add a post-build step in `apps/extension/package.json`:
```json
"scripts": {
  "dev": "vite build --watch",
  "build": "vite build && cp manifests/chrome-manifest.json dist/manifest.json"
}
```

- [ ] **Step 8: Verify extension builds**

Run: `cd apps/extension && pnpm install && pnpm build`
Expected: `dist/` directory with `manifest.json`, `service-worker.js`, `src/popup/popup.html`

- [ ] **Step 9: Commit**

```bash
git add apps/extension/
git commit -m "feat: add Chrome browser extension with one-click download and popup"
```

---

## Task 12: Shared UI Components

**Files:**
- Create: `packages/ui/src/ProgressBar.tsx`
- Create: `packages/ui/src/StatusBadge.tsx`
- Create: `packages/ui/src/Button.tsx`
- Create: `packages/ui/src/UrlField.tsx`
- Modify: `packages/ui/src/index.ts`

- [ ] **Step 1: Create shared components**

```tsx
// packages/ui/src/ProgressBar.tsx
import React from "react";

interface Props {
  percent: number;
  className?: string;
}

export function ProgressBar({ percent, className = "" }: Props) {
  return (
    <div className={`w-full bg-slate-700 rounded-full h-2 ${className}`}>
      <div
        className="bg-yoinkit-primary h-2 rounded-full transition-all duration-300"
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      />
    </div>
  );
}
```

```tsx
// packages/ui/src/StatusBadge.tsx
import React from "react";

const colors: Record<string, string> = {
  downloading: "bg-yoinkit-primary",
  completed: "bg-yoinkit-success",
  paused: "bg-yoinkit-warning",
  cancelled: "bg-yoinkit-danger",
  failed: "bg-yoinkit-danger",
  pending: "bg-yoinkit-muted",
};

interface Props {
  status: string;
}

export function StatusBadge({ status }: Props) {
  return (
    <span className={`inline-block text-xs font-medium text-white px-2 py-0.5 rounded-full ${colors[status] || colors.pending}`}>
      {status}
    </span>
  );
}
```

```tsx
// packages/ui/src/Button.tsx
import React from "react";

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost";
}

export function Button({ variant = "primary", className = "", children, ...props }: Props) {
  const base = "font-semibold rounded-lg transition-colors text-sm";
  const variants = {
    primary: "bg-yoinkit-primary hover:bg-indigo-400 text-white px-6 py-3",
    ghost: "text-yoinkit-muted hover:text-yoinkit-text px-3 py-1",
  };

  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
```

```tsx
// packages/ui/src/UrlField.tsx
import React from "react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function UrlField({ value, onChange, placeholder = "Paste URL here..." }: Props) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="flex-1 bg-yoinkit-surface text-yoinkit-text border border-slate-600 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-yoinkit-primary placeholder:text-yoinkit-muted"
    />
  );
}
```

- [ ] **Step 2: Update barrel export**

```ts
// packages/ui/src/index.ts
export { ProgressBar } from "./ProgressBar";
export { StatusBadge } from "./StatusBadge";
export { Button } from "./Button";
export { UrlField } from "./UrlField";
```

- [ ] **Step 3: Commit**

```bash
git add packages/ui/
git commit -m "feat: add shared UI components (ProgressBar, StatusBadge, Button, UrlField)"
```

---

## Task 13: Bundled Wget Binary

**Files:**
- Create: `apps/desktop/src-tauri/bin/README.md`
- Create: `scripts/build-wget.sh`

- [ ] **Step 1: Create wget build script**

```bash
#!/bin/bash
# scripts/build-wget.sh
# Builds a statically-linked universal wget binary for macOS
# Requires: Xcode command line tools, autoconf, automake
# Run on a macOS machine with both arm64 and x86_64 support

set -e

WGET_VERSION="1.24.5"
OPENSSL_VERSION="3.2.1"
BUILD_DIR=$(mktemp -d)
OUTPUT_DIR="$(cd "$(dirname "$0")/../apps/desktop/src-tauri/bin" && pwd)"

echo "Building wget ${WGET_VERSION} with OpenSSL ${OPENSSL_VERSION}"
echo "Build dir: ${BUILD_DIR}"
echo "Output: ${OUTPUT_DIR}"

cd "${BUILD_DIR}"

# Download sources
curl -LO "https://ftp.gnu.org/gnu/wget/wget-${WGET_VERSION}.tar.gz"
curl -LO "https://www.openssl.org/source/openssl-${OPENSSL_VERSION}.tar.gz"

# Build for each architecture
for ARCH in arm64 x86_64; do
  echo "=== Building for ${ARCH} ==="
  PREFIX="${BUILD_DIR}/install-${ARCH}"
  mkdir -p "${PREFIX}"

  # Build OpenSSL
  tar xzf "openssl-${OPENSSL_VERSION}.tar.gz"
  cd "openssl-${OPENSSL_VERSION}"
  if [ "${ARCH}" = "arm64" ]; then
    ./Configure darwin64-arm64-cc --prefix="${PREFIX}" no-shared
  else
    ./Configure darwin64-x86_64-cc --prefix="${PREFIX}" no-shared
  fi
  make -j$(sysctl -n hw.ncpu)
  make install_sw
  cd ..
  rm -rf "openssl-${OPENSSL_VERSION}"

  # Build wget
  tar xzf "wget-${WGET_VERSION}.tar.gz"
  cd "wget-${WGET_VERSION}"
  CFLAGS="-arch ${ARCH}" LDFLAGS="-arch ${ARCH}" \
    ./configure \
      --prefix="${PREFIX}" \
      --with-ssl=openssl \
      --with-openssl="${PREFIX}" \
      --without-libidn \
      --without-metalink \
      --disable-nls \
      OPENSSL_CFLAGS="-I${PREFIX}/include" \
      OPENSSL_LIBS="-L${PREFIX}/lib -lssl -lcrypto"
  make -j$(sysctl -n hw.ncpu)
  cp src/wget "${PREFIX}/wget"
  cd ..
  rm -rf "wget-${WGET_VERSION}"
done

# Create universal binary
mkdir -p "${OUTPUT_DIR}"
lipo -create \
  "${BUILD_DIR}/install-arm64/wget" \
  "${BUILD_DIR}/install-x86_64/wget" \
  -output "${OUTPUT_DIR}/wget"

chmod +x "${OUTPUT_DIR}/wget"
echo "Built universal wget binary at ${OUTPUT_DIR}/wget"

# Verify
file "${OUTPUT_DIR}/wget"
"${OUTPUT_DIR}/wget" --version | head -1

# Cleanup
rm -rf "${BUILD_DIR}"
```

- [ ] **Step 2: Create placeholder README**

```markdown
<!-- apps/desktop/src-tauri/bin/README.md -->
# Bundled Wget Binary

This directory contains the statically-compiled universal macOS wget binary.

To build it, run: `bash scripts/build-wget.sh`

The binary is a universal fat binary (arm64 + x86_64) with statically-linked OpenSSL.
IDN and metalink support are omitted to simplify the static build.
```

- [ ] **Step 3: Commit**

```bash
git add scripts/build-wget.sh apps/desktop/src-tauri/bin/README.md
git commit -m "feat: add wget static build script for macOS universal binary"
```

---

## Task 14: Integration Testing & Polish

- [ ] **Step 1: Build the wget binary**

Run: `bash scripts/build-wget.sh`
Expected: Universal binary at `apps/desktop/src-tauri/bin/wget`

- [ ] **Step 2: Run full desktop app**

Run: `cd apps/desktop && pnpm tauri dev`
Expected: App launches, API responds on `:9271`, tray icon visible

- [ ] **Step 3: Test a real download from the app UI**

Paste `https://example.com` into the URL input, click Yoink!
Expected: Download appears in list, progresses, completes

- [ ] **Step 4: Test the API directly**

```bash
TOKEN=$(cat ~/Library/Application\ Support/Yoinkit/api_token)
curl -H "Authorization: Bearer $TOKEN" http://localhost:9271/downloads
```
Expected: JSON array of downloads

- [ ] **Step 5: Build and load the browser extension**

Run: `cd apps/extension && pnpm build`
Then load `apps/extension/dist` as unpacked extension in Chrome
Expected: Yoinkit icon appears in toolbar

- [ ] **Step 6: Test one-click download from extension**

Navigate to any page, click the Yoinkit toolbar icon
Expected: Badge shows "OK", download appears in desktop app

- [ ] **Step 7: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration testing fixes"
```

---

## Summary

| Task | What it builds | Depends on |
|------|---------------|-----------|
| 1 | Monorepo scaffolding | — |
| 2 | Tauri app skeleton | 1 |
| 3 | SQLite database layer | 2 |
| 4 | Auth token generation | 3 |
| 5 | Wget process manager | 3, 4 |
| 6 | Tauri IPC commands | 5 |
| 7 | Localhost REST API | 5, 4 |
| 8 | Menu bar tray | 2 |
| 9 | Simple mode frontend | 6 |
| 10 | Pro mode frontend | 9 |
| 11 | Browser extension | 7 |
| 12 | Shared UI components | 1 |
| 13 | Bundled wget binary | — |
| 14 | Integration testing | All |
