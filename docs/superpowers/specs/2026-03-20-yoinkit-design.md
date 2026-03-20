# Yoinkit — Design Spec

A macOS desktop app and browser extension that provides a graphical interface for Wget, bundling the binary so users never need Homebrew or the terminal.

## Architecture

**Approach:** Tauri v2 desktop app with a localhost REST API. Browser extension is a thin client that communicates with the app over HTTP (`localhost:9271`).

```
Browser Extension (Chrome/Firefox/Safari)
    │
    │ HTTP (localhost:9271)
    ▼
Tauri Desktop App
    ├── Local REST API (Rust)
    ├── App UI (React + TypeScript)
    ├── Download Manager (Rust)
    └── Bundled Wget Binary (macOS universal)
```

## Desktop App

### Tech Stack

- **Framework:** Tauri v2 (Rust backend, web frontend)
- **Frontend:** React + TypeScript + Tailwind CSS
- **Database:** SQLite via `rusqlite`
- **Process management:** Rust `std::process::Command` for spawning Wget

### Free (Simple) Mode

- Paste or drag-and-drop a URL
- One-click download button
- Pick save location (default: `~/Downloads/Yoinkit/`)
- Download progress bar with speed and ETA
- Download history list
- Pause / resume / cancel downloads

### Pro Mode (gated locally, payment TBD)

- Everything in Free, plus:
- Full visual Wget command builder — checkboxes, dropdowns, inputs for all Wget flags, grouped by category (recursion, filtering, authentication, rate limiting, mirrors, etc.)
- Live command preview showing the actual `wget` command being constructed
- Saved presets (e.g. "Mirror full site", "Download all PDFs", "Resume large file")
- Batch downloads (paste multiple URLs or import from a file)
- Scheduling (download at a specific time or interval)

### System Tray / Menu Bar

- Yoinkit lives in the macOS menu bar when minimized
- Shows active download count badge
- Quick access to recent downloads

## Browser Extension

### Toolbar Button Behaviors

- **Left click:** Instantly downloads the current tab's URL using the user's default preference (current page only or whole site recursive mirror). Shows a brief "Sent to Yoinkit!" badge on the icon.
- **Right-click → "Yoinkit Options":** Opens the full popup/panel UI.

### Extension Popup/Panel

- URL input field (pre-filled with current tab URL)
- Quick toggles: recursive download, depth limit, file type filter
- Pro users see the full command builder
- Download history / status from the app
- Settings: default one-click behavior (current page vs. whole site), default save location

### Connection Status

- Extension checks `localhost:9271/health` on popup open
- If Yoinkit app isn't running: shows "Launch Yoinkit" button
- Colored dot on toolbar icon (green = connected, grey = app not running)

### Cross-Browser Support

- Single codebase using WebExtension API (Chrome + Firefox)
- Safari version via Xcode's "convert to Safari web extension" tooling
- Separate manifest files per browser

## Local REST API

Runs on `localhost:9271`. CORS restricted to browser extension origins and the Tauri app.

| Endpoint | Method | Purpose |
|---|---|---|
| `/health` | GET | Extension connectivity check |
| `/download` | POST | Start a new download (URL, flags, save path) |
| `/downloads` | GET | List all downloads with status |
| `/downloads/:id` | GET | Single download status (progress, speed, ETA) |
| `/downloads/:id` | DELETE | Cancel/remove a download |
| `/downloads/:id/pause` | POST | Pause a download |
| `/downloads/:id/resume` | POST | Resume a download |
| `/settings` | GET/PUT | Read/update user preferences |

## Download Manager (Rust)

- Spawns `wget` as a child process with constructed flags
- Parses Wget's stderr output in real-time for progress percentage, speed, and ETA
- Manages a download queue with configurable concurrency (default: 3 simultaneous)
- Persists download history to SQLite
- Handles pause (SIGSTOP) / resume (SIGCONT) / cancel (SIGTERM)

## Bundled Wget

- Statically compiled Wget binary included in the app bundle
- Universal binary (arm64 + x86_64) for Apple Silicon and Intel Macs
- Location: `Yoinkit.app/Contents/Resources/bin/wget`
- No Homebrew or external dependency required

## Data Storage

### SQLite Database

Location: `~/Library/Application Support/Yoinkit/yoinkit.db`

**downloads table:**
- id, url, status, progress, save_path, flags, created_at, completed_at, file_size

**presets table (Pro):**
- id, name, flags_json, created_at

**settings table:**
- key-value pairs: default_save_path, one_click_mode, max_concurrent, pro_unlocked

### App Config

- Location: `~/Library/Application Support/Yoinkit/config.json`
- First launch prompts user to pick default save directory

## Pro Gating

- Local boolean flag (`pro_unlocked`) in settings
- Pro UI elements are present but hidden/disabled in free mode
- No server-side validation for now
- Payment integration to be added later (will set the flag via license key or receipt validation)

## Project Structure

```
yoinkit/
├── apps/
│   ├── desktop/          # Tauri app
│   │   ├── src-tauri/    # Rust backend (API, download manager, Wget process)
│   │   └── src/          # React frontend
│   └── extension/        # Browser extension
│       ├── src/          # React popup + background script
│       └── manifests/    # Chrome, Firefox, Safari manifest files
├── packages/
│   └── ui/               # Shared React components & styles
├── bin/
│   └── wget              # Bundled Wget binary (universal macOS)
├── package.json
└── pnpm-workspace.yaml
```

**Monorepo:** pnpm workspaces so the desktop app and extension share UI components.

## Key Decisions

- **Tauri v2** over Electron for small app size and Rust backend performance
- **Localhost API** over Native Messaging for cross-browser simplicity
- **Bundled Wget** so users never touch Homebrew or the terminal
- **SQLite** for simple, reliable local persistence
- **pnpm monorepo** for shared code between app and extension
