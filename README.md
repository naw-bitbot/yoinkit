# Yoinkit

**Download anything from the web. No terminal required.**

Yoinkit is a macOS desktop app and browser extension that puts the full power of [Wget](https://www.gnu.org/software/wget/) behind a clean, modern UI. No Homebrew, no command line -- just download and go.

![macOS](https://img.shields.io/badge/macOS-000000?style=flat&logo=apple&logoColor=white)
![Tauri](https://img.shields.io/badge/Tauri_v2-FFC131?style=flat&logo=tauri&logoColor=black)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## What is Yoinkit?

Wget is one of the most powerful download tools ever made -- recursive site mirroring, resume interrupted downloads, batch fetching, file filtering -- but it's trapped in the terminal. Yoinkit frees it.

- **Casual users** get a simple paste-a-URL-and-download experience
- **Power users** get a full visual command builder exposing every Wget flag
- **Browser extension** adds one-click downloading from any tab

## Download

| Platform | Download |
|----------|----------|
| macOS (Apple Silicon) | [Yoinkit_0.1.0_aarch64.dmg](https://github.com/naw-bitbot/yoinkit/releases/latest/download/Yoinkit_0.1.0_aarch64.dmg) |
| macOS (Intel) | [Yoinkit_0.1.0_x64.dmg](https://github.com/naw-bitbot/yoinkit/releases/latest/download/Yoinkit_0.1.0_x64.dmg) |
| Chrome Extension | Coming soon |
| Firefox Extension | Coming soon |
| Safari Extension | Coming soon |

> Wget is bundled inside the app. You do **not** need Homebrew or any other package manager.

## Features

### Free Tier
- Paste a URL and download with one click
- Drag-and-drop URL support
- Download progress with speed and ETA
- Pause, resume, and cancel downloads
- Download history
- Menu bar icon with active download count
- Pick your default save location

### Pro Tier (coming soon)
- Full visual Wget command builder -- every flag, no terminal
- Live command preview (see the actual `wget` command being built)
- Saved presets ("Mirror full site", "Download all PDFs", etc.)
- Batch downloads (paste multiple URLs or import from file)
- Scheduled downloads
- Recursive site mirroring with depth control
- File type filtering

### Browser Extension
- **One click** the toolbar button to instantly download the current page
- Configurable default: download current page only, or mirror the whole site
- Full popup UI for pasting URLs and configuring options
- Connection status indicator (green = app running, grey = not running)
- Works with Chrome, Firefox, and Safari

## How It Works

```
Browser Extension  -->  localhost:9271  -->  Yoinkit App  -->  Wget (bundled)
                         REST API              Rust backend      subprocess
```

1. The desktop app runs a local REST API on port 9271
2. The browser extension talks to this API to trigger downloads
3. The Rust backend spawns Wget as a subprocess and parses its output for progress
4. Downloads land in your chosen folder (default: `~/Downloads/Yoinkit/`)

## Use Cases

- **Save a webpage** for offline reading
- **Mirror an entire website** for backup or migration
- **Batch download** files from a directory listing
- **Resume** a large download that got interrupted
- **Download all PDFs** (or images, or videos) from a page
- **Archive a site** before it goes offline
- **Migrate web content** between servers

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Desktop app | [Tauri v2](https://v2.tauri.app/) (Rust backend, React frontend) |
| Frontend | React 18, TypeScript, Tailwind CSS |
| Database | SQLite (rusqlite) |
| Download engine | Wget (bundled universal binary) |
| Browser extension | WebExtension API (Chrome, Firefox, Safari) |
| Build system | pnpm workspaces monorepo |
| CI/CD | GitHub Actions |

## Project Structure

```
yoinkit/
├── apps/
│   ├── desktop/              # Tauri desktop app
│   │   ├── src/              # React frontend (pages, components, hooks)
│   │   └── src-tauri/        # Rust backend (API, download manager, DB)
│   └── extension/            # Browser extension
│       ├── src/              # Popup, service worker, options page
│       └── manifests/        # Chrome, Firefox, Safari manifests
├── packages/
│   └── ui/                   # Shared React components & Tailwind preset
└── .github/workflows/        # CI: build .dmg + extension packages
```

## Development

### Prerequisites

- [Rust](https://rustup.rs/) (latest stable)
- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 9+
- Xcode Command Line Tools (`xcode-select --install`)

### Setup

```bash
git clone https://github.com/naw-bitbot/yoinkit.git
cd yoinkit
pnpm install
```

### Run the desktop app

```bash
cd apps/desktop
pnpm tauri dev
```

### Build the desktop app

```bash
cd apps/desktop
pnpm tauri build
```

The `.dmg` will be in `apps/desktop/src-tauri/target/release/bundle/dmg/`.

### Build the browser extension

```bash
pnpm build:extension
```

Extension files will be in `apps/extension/dist/`.

## Contributing

Pull requests welcome. For major changes, please open an issue first.

## License

MIT
