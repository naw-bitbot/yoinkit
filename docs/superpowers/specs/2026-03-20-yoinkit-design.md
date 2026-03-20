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
- Visual Wget command builder for the ~20 most common flags, grouped by category (recursion, filtering, authentication, rate limiting, mirrors, etc.), plus a raw command text field as an escape hatch for power users
- Live command preview showing the actual `wget` command being constructed
- Saved presets (e.g. "Mirror full site", "Download all PDFs", "Resume large file")
- Batch downloads (paste multiple URLs or import from a file)

Note: Scheduling (download at specific times/intervals) is deferred to v2 — it adds significant complexity around app lifecycle, sleep/wake, and launchd integration.

### System Tray / Menu Bar

- Yoinkit lives in the macOS menu bar when minimized
- Shows active download count badge
- Quick access to recent downloads

## Browser Extension

### Toolbar Button Behaviors

- **Left click:** Instantly downloads the current tab's URL using the user's default preference (current page only or whole site recursive mirror). Shows a brief "Sent to Yoinkit!" badge on the icon. "Current page" means Wget downloads the resource at the URL as-is (HTML page, PDF, image, etc.).
- **Context menu → "Yoinkit Options":** Opens the full popup/panel UI. (Uses the browser's context menu API rather than right-click on toolbar icon, for cross-browser compatibility.)

### Extension Popup/Panel

- URL input field (pre-filled with current tab URL)
- Quick toggles: recursive download, depth limit, file type filter
- Pro users see the full command builder
- Download history / status from the app
- Settings: default one-click behavior (current page vs. whole site), default save location

### Connection Status

- Extension checks `localhost:9271/health` on popup open
- If Yoinkit app isn't running: shows a message with instructions to open the app (extensions cannot launch native apps directly; a registered `yoinkit://` custom URL scheme will be used to attempt launch where supported)
- Colored dot on toolbar icon (green = connected, grey = app not running)

### Cross-Browser Support

- Single codebase using WebExtension API (Chrome + Firefox)
- Safari version via Xcode's "convert to Safari web extension" tooling (must be distributed inside a native app container)
- Separate manifest files per browser (Manifest V3 for Chrome, Manifest V2/V3 for Firefox)

## Local REST API

Runs on `localhost:9271`. CORS restricted to browser extension origins and the Tauri app.

### Authentication

On first launch, the app generates a random bearer token and writes it to `~/Library/Application Support/Yoinkit/api_token`. The file is readable only by the current user (`chmod 600`). The browser extension reads this token (via native messaging bootstrap or user paste on first setup) and includes it as `Authorization: Bearer <token>` on all API requests. This prevents other local processes from making unauthorized requests.

### Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/health` | GET | Extension connectivity check (no auth required) |
| `/download` | POST | Start a new download (URL, flags, save path) |
| `/downloads` | GET | List all downloads with status |
| `/downloads/:id` | GET | Single download status (progress, speed, ETA) |
| `/downloads/:id` | DELETE | Cancel/remove a download |
| `/downloads/:id/pause` | POST | Pause a download |
| `/downloads/:id/resume` | POST | Resume a download |
| `/settings` | GET/PUT | Read/update user preferences |

### Error Responses

All endpoints return standard HTTP error codes with a JSON body: `{ "error": "message" }`. Common cases:
- `401` — missing or invalid bearer token
- `404` — download ID not found
- `409` — download already paused/running
- `500` — Wget process failed (includes Wget exit code and stderr in response)

## Download Manager (Rust)

- Spawns `wget` as a child process with constructed flags
- Only uses the bundled Wget binary (never a system-installed one) to ensure consistent output parsing
- Parses Wget's stderr output in real-time for progress percentage, speed, and ETA
- Manages a download queue with configurable concurrency (default: 3 simultaneous)
- Persists download history to SQLite
- **Pause:** kills the Wget process gracefully (SIGTERM). **Resume:** re-invokes Wget with `--continue` (`-c`) flag to resume from where it left off. **Cancel:** kills the process (SIGTERM) and optionally cleans up partial files.
- **Error handling:** Wget non-zero exit codes are captured and stored in the download record. Network failures mid-download are reported to the UI with a retry option. Disk-full errors are detected and surfaced to the user.

## Bundled Wget

- Statically compiled Wget binary included in the app bundle
- TLS backend: OpenSSL (statically linked). Optional features like IDN and metalink are omitted to simplify the static build.
- Universal binary (arm64 + x86_64) via `lipo` for Apple Silicon and Intel Macs
- Location: `Yoinkit.app/Contents/Resources/bin/wget`
- No Homebrew or external dependency required
- Updated via app updates when Wget CVEs are discovered

## Data Storage

### SQLite Database

Location: `~/Library/Application Support/Yoinkit/yoinkit.db`

All settings and configuration are stored in SQLite (no separate config.json). First launch prompts user to pick default save directory.

**downloads table:**
- id, url, status, progress, save_path, flags, error_message, wget_exit_code, created_at, completed_at, file_size

**presets table (Pro):**
- id, name, flags_json, created_at

**settings table:**
- key-value pairs: default_save_path, one_click_mode, max_concurrent, pro_unlocked

## Pro Gating

- Local boolean flag (`pro_unlocked`) in settings table
- Pro UI elements are present but hidden/disabled in free mode
- No server-side validation for now — this is intentionally honor-system for the initial release
- Payment integration to be added later (will set the flag via license key or receipt validation)

## Distribution

### Desktop App
- Distributed as a `.dmg` direct download (not Mac App Store initially, to avoid sandbox restrictions on subprocess spawning)
- Code-signed with an Apple Developer ID certificate
- Notarized via `notarytool` for Gatekeeper compatibility
- Auto-updates via Tauri v2's updater plugin

### Browser Extensions
- Chrome: Chrome Web Store (Manifest V3)
- Firefox: Firefox Add-ons (AMO)
- Safari: Distributed inside the Yoinkit macOS app container, submitted to Mac App Store as a Safari extension

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
│   └── ui/               # Shared React components & styles (Tailwind classes only, no inline styles, to comply with extension CSP)
├── bin/
│   └── wget              # Bundled Wget binary (universal macOS)
├── package.json
└── pnpm-workspace.yaml
```

**Monorepo:** pnpm workspaces so the desktop app and extension share UI components.

## Key Decisions

- **Tauri v2** over Electron for small app size and Rust backend performance
- **Localhost API** over Native Messaging for cross-browser simplicity
- **Bearer token auth** on the local API to prevent unauthorized local access
- **Bundled Wget** so users never touch Homebrew or the terminal
- **Kill + `wget -c`** for pause/resume instead of SIGSTOP/SIGCONT (TCP connections would time out)
- **SQLite** as single source of truth for all settings and data (no separate config file)
- **Direct `.dmg` distribution** to avoid App Sandbox restrictions on subprocess spawning
- **pnpm monorepo** for shared code between app and extension
- **Scheduling deferred to v2** to keep v1 scope manageable
