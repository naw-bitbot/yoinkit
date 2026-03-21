# Yoinkit v2 — "Yoink It. Search It. Ask It." Master Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Yoinkit from a download manager into the all-in-one "yoink anything from the web" toolkit — combining downloading, archiving, clipping, searching, and AI intelligence in a single macOS app + browser extension.

**Architecture:** Seven build phases, each delivering standalone value. Phase 1 lays database and content extraction foundations. Phases 2-3 add clipper and archiving. Phase 4 adds search. Phase 5 adds the AI intelligence layer. Phase 6 upgrades core download capabilities. Phase 7 adds viral/delight features. Each phase produces a taggable release.

**Tech Stack:**
- Rust backend: Tauri 2, rusqlite, tokio, axum, scraper (HTML parsing), monolith (page archiving)
- React frontend: React 18, TypeScript, Tailwind CSS, Lucide icons
- AI: Ollama (local) / Claude API / OpenAI API (user's key), MCP server
- Search: tantivy (Rust full-text search engine)
- Browser extension: Chrome Manifest V3 / Firefox / Safari

**Brand:** Tangerine Pop `#FF6B35` on logo + primary buttons + progress bars. Neutral macOS greys everywhere else. 3 type sizes: 20px/13px/11px.

---

## File Structure Overview

### New Rust modules (apps/desktop/src-tauri/src/)

| File | Responsibility |
|------|---------------|
| `clipper.rs` | HTML → readable content extraction (Readability algorithm) |
| `markdown.rs` | HTML → Markdown conversion with frontmatter |
| `archiver.rs` | Full-page archiving (inline all assets into single HTML) |
| `search.rs` | Tantivy full-text search index management |
| `ai.rs` | AI provider abstraction (Ollama / Claude / OpenAI) |
| `mcp_server.rs` | MCP protocol server exposing yoink library |
| `scheduler.rs` | Download scheduling and recurring jobs |
| `monitor.rs` | Site change detection |
| `notebooklm.rs` | NotebookLM export integration |

### New React pages/components (apps/desktop/src/)

| File | Responsibility |
|------|---------------|
| `pages/ClipperPage.tsx` | Web clipper UI with preview and export options |
| `pages/ArchivePage.tsx` | Archive browser with offline viewing |
| `pages/SearchPage.tsx` | Global search across all yoinked content |
| `pages/AIPage.tsx` | "Ask My Yoinks" chat interface |
| `components/MarkdownPreview.tsx` | Render clipped Markdown with syntax highlighting |
| `components/SearchResults.tsx` | Search result cards with highlights |
| `components/ChatMessage.tsx` | AI chat message bubble |
| `components/YoinkReceipt.tsx` | Shareable download receipt card |
| `components/TagEditor.tsx` | Tag display and editing |
| `hooks/useSearch.ts` | Search state management |
| `hooks/useAI.ts` | AI chat state management |
| `hooks/useClips.ts` | Clip CRUD operations |

### New browser extension files

| File | Responsibility |
|------|---------------|
| `src/popup/ClipButton.tsx` | "Clip to Obsidian" action in popup |
| `src/content/highlighter.ts` | Content script for text selection + clip |

### Database schema additions

New tables added to existing `db.rs`:

```sql
-- Clipped/archived content
CREATE TABLE clips (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT,
  markdown TEXT,           -- Extracted clean Markdown
  html TEXT,               -- Original HTML (for archive)
  summary TEXT,            -- AI-generated summary
  tags TEXT DEFAULT '[]',  -- JSON array of tags
  source_type TEXT,        -- 'clip', 'archive', 'transcript', 'download_note'
  vault_path TEXT,         -- Obsidian vault export path (if exported)
  created_at TEXT NOT NULL,
  updated_at TEXT
);

-- Full-text search index metadata
CREATE TABLE search_index (
  id TEXT PRIMARY KEY,
  content_type TEXT,       -- 'download', 'clip', 'transcript'
  content_id TEXT,         -- FK to downloads.id or clips.id
  indexed_at TEXT NOT NULL
);

-- AI chat history
CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL,       -- 'user' or 'assistant'
  content TEXT NOT NULL,
  sources TEXT DEFAULT '[]', -- JSON array of source clip/download IDs
  created_at TEXT NOT NULL
);

-- Scheduled jobs
CREATE TABLE schedules (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  job_type TEXT NOT NULL,   -- 'download', 'monitor', 'mirror'
  cron TEXT,                -- Cron expression
  flags TEXT DEFAULT '{}',
  last_run TEXT,
  next_run TEXT,
  enabled INTEGER DEFAULT 1,
  created_at TEXT NOT NULL
);

-- Site change monitors
CREATE TABLE monitors (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  last_hash TEXT,           -- SHA256 of last seen content
  last_checked TEXT,
  change_detected INTEGER DEFAULT 0,
  notify INTEGER DEFAULT 1,
  created_at TEXT NOT NULL
);
```

### New Cargo dependencies

```toml
# HTML parsing & content extraction
scraper = "0.21"          # CSS selector-based HTML parsing
# Full-text search
tantivy = "0.22"          # Rust search engine (like Lucene)
# AI & HTTP
reqwest = { version = "0.12", features = ["json", "native-tls-vendored"] }
# Hashing
sha2 = "0.10"             # SHA256 for change detection
# Scheduling
tokio-cron-scheduler = "0.13" # Cron scheduling integrated with tokio
# Page archiving
monolith = "2"            # Save complete web pages as single HTML files
```

### Cross-Cutting Concerns

**AppState evolution:** Each phase that adds a new subsystem must extend `AppState` in `lib.rs`. The existing pattern is `AppState { db: Database, download_manager: DownloadManager, auth_token: String }`. New fields to add per phase:
- Phase 1: no AppState changes (clipper/markdown are stateless functions)
- Phase 4: `search_engine: Arc<Mutex<SearchEngine>>`
- Phase 5: `ai_provider: Arc<AiProvider>` (constructed from settings on app start, refreshed on settings change)
- Phase 6: `scheduler: Arc<Scheduler>`

**Database CRUD pattern:** All new DB functions must follow the existing `impl Database` pattern using `self.conn.lock().unwrap()`. Do NOT use bare `Connection` references.

**API key security:** AI API keys must be stored in the macOS Keychain via `tauri-plugin-keychain` or `security` CLI, NOT in plain SQLite. The `ai_api_key` setting in DB stores only a flag indicating whether a key is configured.

**Error handling:** All `fetch_page` calls must use 30s timeout and 2 retries with exponential backoff. AI API calls must handle rate limit headers (429) with retry-after.

**Tantivy index location:** `~/Library/Application Support/Yoinkit/search_index/`. On corruption (failed to open), delete index dir and rebuild from DB content. IndexWriter behind `Mutex<IndexWriter>` for thread safety.

**MCP transport:** Use stdio transport (not HTTP) for Claude Desktop compatibility. The MCP server runs as a separate binary or spawned subprocess that communicates via stdin/stdout JSON-RPC.

---

## Phase 1: Foundation — Database & Content Extraction Engine

**Delivers:** Schema upgrades, HTML→readable content extraction, HTML→Markdown conversion. No UI yet — backend only. Every subsequent phase depends on this.

---

### Task 1.0: Schema Version & Migration System

**Files:**
- Modify: `apps/desktop/src-tauri/src/db.rs`

- [ ] **Step 1: Add schema_version table and migration runner**

```rust
// Add to Database::new() before any CREATE TABLE calls:
conn.execute_batch("
    CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
    );
")?;

let current_version: i64 = conn.query_row(
    "SELECT COALESCE(MAX(version), 0) FROM schema_version", [], |row| row.get(0)
).unwrap_or(0);

// Run migrations sequentially
if current_version < 1 {
    // Original tables (downloads, presets, settings) — already exist for v0.2.x users
    Self::migrate_v1(&conn)?;
}
if current_version < 2 {
    // New v2 tables (clips, chat_messages, schedules, monitors)
    Self::migrate_v2(&conn)?;
}
if current_version < 3 {
    // Add file_hash column to downloads (Phase 6)
    Self::migrate_v3(&conn)?;
}
```

- [ ] **Step 2: Implement migrate_v2 with ALTER TABLE safety**

```rust
fn migrate_v2(conn: &Connection) -> Result<()> {
    conn.execute_batch("
        CREATE TABLE IF NOT EXISTS clips ( ... );
        CREATE TABLE IF NOT EXISTS chat_messages ( ... );
        CREATE TABLE IF NOT EXISTS schedules ( ... );
        CREATE TABLE IF NOT EXISTS monitors ( ... );
        INSERT INTO schema_version (version, applied_at) VALUES (2, datetime('now'));
    ")?;
    Ok(())
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src-tauri/src/db.rs
git commit -m "feat(db): add schema versioning and migration system"
```

---

### Task 1.1: Database Schema Migration (v2 Tables)

**Files:**
- Modify: `apps/desktop/src-tauri/src/db.rs`

- [ ] **Step 1: Add clips table creation in migrate_v2()**

```rust
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
```

- [ ] **Step 2: Add Clip struct and CRUD functions**

```rust
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

// All as impl Database methods (matching existing pattern):
impl Database {
    pub fn insert_clip(&self, clip: &Clip) -> Result<()> { let conn = self.conn.lock().unwrap(); ... }
    pub fn get_clip(&self, id: &str) -> Result<Option<Clip>> { ... }
    pub fn list_clips(&self) -> Result<Vec<Clip>> { ... }
    pub fn update_clip(&self, clip: &Clip) -> Result<()> { ... }
    pub fn delete_clip(&self, id: &str) -> Result<()> { ... }
}
```

- [ ] **Step 3: Add ChatMessage struct and CRUD**

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub id: String,
    pub role: String,
    pub content: String,
    pub sources: String,
    pub created_at: String,
}

// As impl Database methods:
impl Database {
    pub fn insert_chat_message(&self, msg: &ChatMessage) -> Result<()> { ... }
    pub fn list_chat_messages(&self, limit: usize) -> Result<Vec<ChatMessage>> { ... }
    pub fn clear_chat_history(&self) -> Result<()> { ... }
}
```

- [ ] **Step 4: Add Schedule and Monitor structs and CRUD**

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src-tauri/src/db.rs
git commit -m "feat(db): add clips, chat, schedules, monitors tables"
```

---

### Task 1.2: HTML Content Extraction (Readability)

**Files:**
- Create: `apps/desktop/src-tauri/src/clipper.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs` (register module)
- Modify: `apps/desktop/src-tauri/Cargo.toml` (add scraper, reqwest)

- [ ] **Step 1: Add dependencies to Cargo.toml**

```toml
scraper = "0.21"
reqwest = { version = "0.12", features = ["json", "native-tls-vendored"] }
sha2 = "0.10"
```

- [ ] **Step 2: Create clipper.rs with fetch and extract functions**

The clipper fetches a URL, parses the HTML, and extracts the "readable" content by:
1. Removing script, style, nav, footer, aside, header elements
2. Finding the main content container (article, main, or largest text block)
3. Preserving headings, paragraphs, lists, images, links, code blocks
4. Extracting metadata: title (from og:title, <title>, h1), description, author, date

```rust
use scraper::{Html, Selector};
use reqwest;

pub struct ExtractedContent {
    pub title: String,
    pub content_html: String,     // Clean HTML (readable content only)
    pub author: Option<String>,
    pub date: Option<String>,
    pub description: Option<String>,
    pub site_name: Option<String>,
    pub image: Option<String>,     // og:image
}

pub async fn fetch_page(url: &str) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
        .timeout(std::time::Duration::from_secs(30))
        .build().map_err(|e| e.to_string())?;

    // Retry up to 2 times with exponential backoff
    let mut last_err = String::new();
    for attempt in 0..3 {
        if attempt > 0 {
            tokio::time::sleep(std::time::Duration::from_millis(500 * 2u64.pow(attempt))).await;
        }
        match client.get(url).send().await {
            Ok(resp) => return resp.text().await.map_err(|e| e.to_string()),
            Err(e) => last_err = e.to_string(),
        }
    }
    Err(last_err)
}

pub fn extract_readable(html: &str, url: &str) -> Result<ExtractedContent, String> {
    // Implementation: parse with scraper, extract meta tags, find main content,
    // strip non-content elements, return clean HTML + metadata
}
```

- [ ] **Step 3: Register module in lib.rs**

Add `mod clipper;` to `lib.rs`.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src-tauri/src/clipper.rs apps/desktop/src-tauri/src/lib.rs apps/desktop/src-tauri/Cargo.toml
git commit -m "feat(clipper): add HTML content extraction engine"
```

---

### Task 1.3: HTML → Markdown Conversion

**Files:**
- Create: `apps/desktop/src-tauri/src/markdown.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Create markdown.rs with HTML-to-Markdown converter**

Converts clean HTML (from clipper) to Markdown. Handles:
- Headings → `#`, `##`, etc.
- Paragraphs → double newline
- Links → `[text](url)`
- Images → `![alt](src)`
- Lists → `-` / `1.`
- Code blocks → triple backticks
- Bold/italic → `**` / `*`
- Blockquotes → `>`
- Tables → Markdown tables

```rust
use scraper::{Html, Node, ElementRef};

pub struct MarkdownOptions {
    pub include_frontmatter: bool,
    pub include_images: bool,
    pub image_download_path: Option<String>,  // Download images locally
}

pub struct MarkdownOutput {
    pub frontmatter: String,   // YAML frontmatter
    pub body: String,          // Markdown body
    pub images: Vec<String>,   // Image URLs found (for optional download)
}

pub fn html_to_markdown(content: &ExtractedContent, url: &str, options: &MarkdownOptions) -> MarkdownOutput {
    let mut frontmatter = format!(
        "---\ntitle: \"{}\"\nsource: \"{}\"\ndate: \"{}\"\n",
        content.title, url, chrono::Utc::now().format("%Y-%m-%d")
    );
    if let Some(author) = &content.author {
        frontmatter.push_str(&format!("author: \"{}\"\n", author));
    }
    frontmatter.push_str("tags: []\n---\n\n");

    // Walk the HTML tree and convert each node to Markdown
    let body = convert_node_to_markdown(&content.content_html);

    MarkdownOutput { frontmatter, body, images }
}

fn convert_node_to_markdown(html: &str) -> String {
    // Recursive HTML node → Markdown string conversion
}
```

- [ ] **Step 2: Register module in lib.rs**

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src-tauri/src/markdown.rs apps/desktop/src-tauri/src/lib.rs
git commit -m "feat(markdown): add HTML to Markdown converter with frontmatter"
```

---

### Task 1.4: Clipper IPC Commands

**Files:**
- Modify: `apps/desktop/src-tauri/src/commands.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs` (register commands)
- Modify: `apps/desktop/src/lib/tauri.ts` (add TypeScript bindings)

- [ ] **Step 1: Add clip commands to commands.rs**

```rust
#[tauri::command]
pub async fn clip_url(url: String, state: State<'_, AppState>) -> Result<Clip, String> {
    // 1. Fetch page HTML
    // 2. Extract readable content
    // 3. Convert to Markdown
    // 4. Save to clips table
    // 5. Return Clip struct
}

#[tauri::command]
pub async fn clip_html(html: String, url: String, state: State<'_, AppState>) -> Result<Clip, String> {
    // For browser extension: receives raw HTML, skips fetch
}

#[tauri::command]
pub fn list_clips(state: State<'_, AppState>) -> Result<Vec<Clip>, String> { ... }

#[tauri::command]
pub fn get_clip(id: String, state: State<'_, AppState>) -> Result<Option<Clip>, String> { ... }

#[tauri::command]
pub fn delete_clip(id: String, state: State<'_, AppState>) -> Result<(), String> { ... }

#[tauri::command]
pub fn update_clip_tags(id: String, tags: Vec<String>, state: State<'_, AppState>) -> Result<(), String> { ... }

#[tauri::command]
pub async fn export_clip_to_vault(
    id: String,
    vault_path: String,
    attachments_folder: String,
    state: State<'_, AppState>
) -> Result<String, String> {
    // 1. Get clip from DB
    // 2. Download images to vault_path/attachments_folder/
    // 3. Rewrite image paths in Markdown to relative vault paths
    // 4. Write .md file to vault_path/
    // 5. Update clip.vault_path in DB
    // 6. Return file path
}
```

- [ ] **Step 2: Register commands in lib.rs invoke_handler**

- [ ] **Step 3: Add TypeScript bindings in tauri.ts**

```typescript
export interface Clip {
  id: string;
  url: string;
  title: string | null;
  markdown: string | null;
  html: string | null;
  summary: string | null;
  tags: string;
  source_type: string;
  vault_path: string | null;
  created_at: string;
  updated_at: string | null;
}

export const api = {
  // ... existing methods ...
  clipUrl: (url: string) => invoke<Clip>("clip_url", { url }),
  clipHtml: (html: string, url: string) => invoke<Clip>("clip_html", { html, url }),
  listClips: () => invoke<Clip[]>("list_clips"),
  getClip: (id: string) => invoke<Clip | null>("get_clip", { id }),
  deleteClip: (id: string) => invoke("delete_clip", { id }),
  updateClipTags: (id: string, tags: string[]) => invoke("update_clip_tags", { id, tags }),
  exportClipToVault: (id: string, vaultPath: string, attachmentsFolder: string) =>
    invoke<string>("export_clip_to_vault", { id, vaultPath, attachmentsFolder }),
};
```

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src-tauri/src/commands.rs apps/desktop/src-tauri/src/lib.rs apps/desktop/src/lib/tauri.ts
git commit -m "feat(clipper): add IPC commands for clip, export, and vault integration"
```

---

### Task 1.5: Settings Additions

**Files:**
- Modify: `apps/desktop/src-tauri/src/db.rs` (default settings)
- Modify: `apps/desktop/src/lib/tauri.ts` (AppSettings type)

- [ ] **Step 1: Add new default settings**

```rust
// In db.rs init_settings():
("obsidian_vault_path", ""),
("obsidian_attachments_folder", "assets/yoinkit"),
("obsidian_frontmatter_template", ""),
("auto_tag", "false"),
("auto_summarize", "false"),
("ai_provider", "none"),        // "none", "ollama", "claude", "openai"
("ai_api_key_configured", "false"),  // Actual key stored in macOS Keychain
("ai_model", ""),
("clip_on_download", "false"),  // Auto-generate note for every download
```

- [ ] **Step 2: Update AppSettings TypeScript type**

```typescript
export interface AppSettings {
  default_save_path: string;
  one_click_mode: string;
  max_concurrent: number;
  pro_unlocked: boolean;
  obsidian_vault_path: string;
  obsidian_attachments_folder: string;
  auto_tag: boolean;
  auto_summarize: boolean;
  ai_provider: string;
  ai_api_key_configured: boolean;  // Key stored in macOS Keychain, not here
  ai_model: string;
  clip_on_download: boolean;
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src-tauri/src/db.rs apps/desktop/src/lib/tauri.ts
git commit -m "feat(settings): add obsidian, AI, and clipper settings"
```

---

## Phase 2: Web Clipper UI + Obsidian Export

**Delivers:** Clipper page in desktop app. Paste URL → extract → preview Markdown → edit tags → export to Obsidian vault. Browser extension "Clip" button.

---

### Task 2.1: useClips Hook

**Files:**
- Create: `apps/desktop/src/hooks/useClips.ts`

- [ ] **Step 1: Create useClips hook**

```typescript
import { useState, useEffect, useCallback } from "react";
import { api, Clip } from "../lib/tauri";

export function useClips() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClips = useCallback(async () => {
    try {
      const result = await api.listClips();
      setClips(result);
    } catch (err) {
      console.error("Failed to fetch clips:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchClips(); }, [fetchClips]);

  const clipUrl = async (url: string) => {
    const clip = await api.clipUrl(url);
    setClips(prev => [clip, ...prev]);
    return clip;
  };

  const deleteClip = async (id: string) => {
    await api.deleteClip(id);
    setClips(prev => prev.filter(c => c.id !== id));
  };

  const exportToVault = async (id: string, vaultPath: string, attachmentsFolder: string) => {
    return api.exportClipToVault(id, vaultPath, attachmentsFolder);
  };

  return { clips, loading, clipUrl, deleteClip, exportToVault, refresh: fetchClips };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/hooks/useClips.ts
git commit -m "feat(ui): add useClips hook for clip state management"
```

---

### Task 2.2: MarkdownPreview Component

**Files:**
- Create: `apps/desktop/src/components/MarkdownPreview.tsx`

- [ ] **Step 1: Create MarkdownPreview component**

Simple Markdown renderer using regex-based conversion (no heavy dependency). Renders headings, paragraphs, bold, italic, links, images, code blocks, lists, blockquotes. Uses CSS variables for theming.

- [ ] **Step 2: Commit**

---

### Task 2.3: TagEditor Component

**Files:**
- Create: `apps/desktop/src/components/TagEditor.tsx`

- [ ] **Step 1: Create TagEditor**

Inline tag pills with add/remove. Input field for new tags with Enter to add. Uses `var(--brand)` for tag background tint. 11px text size.

- [ ] **Step 2: Commit**

---

### Task 2.4: ClipperPage

**Files:**
- Create: `apps/desktop/src/pages/ClipperPage.tsx`
- Modify: `apps/desktop/src/App.tsx` (add nav item + route)

- [ ] **Step 1: Create ClipperPage**

Layout:
- Title: "Clipper" (20px bold)
- Subtitle: "Clip any webpage to Markdown. Export to Obsidian." (13px)
- URL input + "Clip" button (tangerine primary)
- Below: two-panel view
  - Left: Markdown preview of clipped content
  - Right: Metadata panel (title, tags, export options)
- Below: Clip history list (most recent first)
- Each clip card: title, URL, date, tags, actions (Export to Vault, Copy Markdown, Delete)

- [ ] **Step 2: Add "Clipper" to NAV_ITEMS in App.tsx**

```typescript
import { Scissors } from "lucide-react";
// Add to NAV_ITEMS:
{ id: "clipper", label: "Clipper", icon: Scissors },
```

Update `Page` type to include `"clipper"`. Add `{page === "clipper" && <ClipperPage />}`.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/pages/ClipperPage.tsx apps/desktop/src/App.tsx
git commit -m "feat(clipper): add Clipper page with Markdown preview and vault export"
```

---

### Task 2.5: Settings Page — Obsidian Section

**Files:**
- Modify: `apps/desktop/src/pages/SettingsPage.tsx`

- [ ] **Step 1: Add Obsidian settings section**

New section between "General" and "Plan" with:
- Vault path input (with folder picker via Tauri dialog)
- Attachments subfolder input
- "Auto-clip on download" toggle
- Obsidian icon from Lucide (use `BookOpen` or `NotebookPen`)

- [ ] **Step 2: Commit**

---

### Task 2.6: Browser Extension — Clip Button

**Files:**
- Modify: `apps/extension/src/popup/Popup.tsx` (add Clip action)
- Modify: `apps/extension/src/lib/api.ts` (add clip endpoint)
- Modify: `apps/desktop/src-tauri/src/api.rs` (add clip REST endpoint)

- [ ] **Step 1: Add POST /clip endpoint to Axum REST API**

```rust
async fn clip_page(Json(body): Json<ClipRequest>) -> impl IntoResponse {
    // body: { url: String, html: Option<String> }
    // Calls clipper::fetch_page + clipper::extract_readable + markdown::html_to_markdown
    // Saves to DB, returns Clip
}
```

- [ ] **Step 2: Add clipPage() to extension API client**

```typescript
export async function clipPage(url: string, html?: string): Promise<Clip> {
  return request("/clip", "POST", { url, html });
}
```

- [ ] **Step 3: Add "Clip" button to Popup.tsx**

Add a secondary button next to "Yoink!" labeled "Clip" with Scissors icon. On click, calls `clipPage(currentTabUrl)`. Shows success toast with clip title.

- [ ] **Step 4: Commit**

```bash
git add apps/extension/src/popup/Popup.tsx apps/extension/src/lib/api.ts apps/desktop/src-tauri/src/api.rs
git commit -m "feat(extension): add Clip button to browser extension popup"
```

---

### Task 2.7: Browser Extension — Highlight & Clip (Content Script)

**Files:**
- Create: `apps/extension/src/content/highlighter.ts`
- Modify: `apps/extension/manifests/chrome-manifest.json` (add content script)
- Modify: `apps/extension/manifests/firefox-manifest.json` (add content script)

- [ ] **Step 1: Create content script**

Listens for text selection. When user right-clicks selected text, sends message to service worker. Service worker calls desktop app REST API with selected HTML + page URL. Desktop app clips the selection to Markdown.

- [ ] **Step 2: Add context menu item "Clip Selection to Yoinkit"**

In `service-worker.ts`, add context menu item that triggers on text selection.

- [ ] **Step 3: Update manifests with content_scripts entry**

- [ ] **Step 4: Commit**

---

## Phase 3: Full-Page Archive + Link Rot Protection

**Delivers:** Archive any page as a self-contained offline HTML file. Browse archived pages locally. Detect when saved pages go offline.

---

### Task 3.1: Page Archiver (Rust)

**Files:**
- Create: `apps/desktop/src-tauri/src/archiver.rs`
- Modify: `apps/desktop/src-tauri/Cargo.toml` (add base64)
- Modify: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Create archiver.rs — shell out to monolith binary**

Use the `monolith` CLI tool (bundled alongside wget/yt-dlp) to create self-contained HTML archives. This avoids rebuilding SingleFile from scratch — monolith handles CSS `url()`, `@import`, `srcset`, fonts, and JS-rendered content.

```rust
use std::process::Command;

pub async fn archive_page(url: &str, save_dir: &str) -> Result<String, String> {
    let filename = sanitize_filename(url);
    let output_path = format!("{}/{}.html", save_dir, filename);

    let output = Command::new(monolith_binary_path())
        .args([url, "-o", &output_path, "-I", "-j", "-t", "30"])
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok(output_path)
}
```

Bundle the `monolith` binary in CI (same pattern as wget/yt-dlp) — download from GitHub releases, codesign, include in `src-tauri/bin/`.

- [ ] **Step 2: Add archive IPC commands**

```rust
#[tauri::command]
pub async fn archive_url(url: String, state: State<'_, AppState>) -> Result<Clip, String> {
    // Archive page, save to clips table with source_type = "archive"
}
```

- [ ] **Step 3: Commit**

---

### Task 3.2: Archive Page UI

**Files:**
- Create: `apps/desktop/src/pages/ArchivePage.tsx`
- Modify: `apps/desktop/src/App.tsx`

- [ ] **Step 1: Create ArchivePage**

- URL input + "Archive" button
- Grid of archived pages (thumbnail, title, date, size)
- Click to open archived HTML in a webview or new window
- Filter by date, search by title

- [ ] **Step 2: Add to nav**

```typescript
import { Archive } from "lucide-react";
{ id: "archive", label: "Archive", icon: Archive },
```

- [ ] **Step 3: Commit**

---

### Task 3.3: Link Rot Detection

**Files:**
- Modify: `apps/desktop/src-tauri/src/archiver.rs`

- [ ] **Step 1: Add periodic link check**

Background task that periodically (daily) checks if archived URLs still resolve (HEAD request). If a URL returns 404/410/timeout, mark the clip as "link_dead" and surface a notification. The local archive becomes the only surviving copy — highlight this in the UI.

- [ ] **Step 2: Commit**

---

## Phase 4: Full-Text Search

**Delivers:** Search across all downloads, clips, transcripts, and archives. Instant results with highlighted matches.

---

### Task 4.1: Tantivy Search Index (Rust)

**Files:**
- Create: `apps/desktop/src-tauri/src/search.rs`
- Modify: `apps/desktop/src-tauri/Cargo.toml` (add tantivy)
- Modify: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Add tantivy dependency**

```toml
tantivy = "0.22"
```

- [ ] **Step 2: Create search.rs**

```rust
use tantivy::{Index, schema::*, collector::TopDocs, query::QueryParser};

pub struct SearchEngine {
    index: Index,
    reader: IndexReader,
}

impl SearchEngine {
    pub fn new(index_path: &str) -> Result<Self, String> { ... }

    pub fn index_clip(&self, clip: &Clip) -> Result<(), String> {
        // Index: id, title, url, markdown content, tags, source_type, created_at
    }

    pub fn index_download(&self, download: &Download) -> Result<(), String> {
        // Index: id, url, save_path, created_at
    }

    pub fn search(&self, query: &str, limit: usize) -> Result<Vec<SearchResult>, String> {
        // Full-text search across all indexed content
        // Return results with highlighted snippets
    }

    pub fn rebuild_index(&self, clips: &[Clip], downloads: &[Download]) -> Result<(), String> {
        // Full re-index of all content
    }
}

#[derive(Serialize)]
pub struct SearchResult {
    pub id: String,
    pub content_type: String,  // "clip", "download", "transcript"
    pub title: String,
    pub snippet: String,       // Highlighted match context
    pub url: String,
    pub score: f32,
    pub created_at: String,
}
```

- [ ] **Step 3: Add search IPC commands**

```rust
#[tauri::command]
pub fn search_yoinks(query: String, limit: Option<usize>, state: State<'_, AppState>) -> Result<Vec<SearchResult>, String> { ... }

#[tauri::command]
pub fn rebuild_search_index(state: State<'_, AppState>) -> Result<(), String> { ... }
```

- [ ] **Step 4: Auto-index on clip/download creation**

Hook into existing `clip_url`, `archive_url`, and download completion paths to automatically add content to the search index.

- [ ] **Step 5: Commit**

---

### Task 4.2: SearchPage UI

**Files:**
- Create: `apps/desktop/src/pages/SearchPage.tsx`
- Create: `apps/desktop/src/components/SearchResults.tsx`
- Create: `apps/desktop/src/hooks/useSearch.ts`
- Modify: `apps/desktop/src/App.tsx`

- [ ] **Step 1: Create useSearch hook**

Debounced search (300ms) that calls `search_yoinks` IPC command. Returns results + loading state.

- [ ] **Step 2: Create SearchResults component**

Result cards showing: icon (by type), title (13px medium), snippet with highlighted match (13px), URL + date (11px tertiary). Click to navigate to the clip/download.

- [ ] **Step 3: Create SearchPage**

- Search input at top (large, prominent, apple-input style)
- Results below with type filter pills (All, Clips, Downloads, Transcripts)
- Empty state: "Search everything you've ever yoinked"

- [ ] **Step 4: Add to nav with Search icon**

```typescript
import { Search } from "lucide-react";
{ id: "search", label: "Search", icon: Search },
```

- [ ] **Step 5: Commit**

---

## Phase 5: AI Intelligence Layer

**Delivers:** AI auto-tagging, summarization, "Ask My Yoinks" RAG chat, MCP server, NotebookLM export.

---

### Task 5.1: AI Provider Abstraction (Rust)

**Files:**
- Create: `apps/desktop/src-tauri/src/ai.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Create ai.rs**

```rust
pub enum AiProvider {
    None,
    Ollama { base_url: String, model: String },
    Claude { api_key: String, model: String },
    OpenAI { api_key: String, model: String },
}

impl AiProvider {
    pub async fn complete(&self, system: &str, user: &str) -> Result<String, String> {
        match self {
            AiProvider::None => Err("No AI provider configured".into()),
            AiProvider::Ollama { base_url, model } => {
                // POST to {base_url}/api/generate
            },
            AiProvider::Claude { api_key, model } => {
                // POST to https://api.anthropic.com/v1/messages
            },
            AiProvider::OpenAI { api_key, model } => {
                // POST to https://api.openai.com/v1/chat/completions
            },
        }
    }

    pub fn from_settings(settings: &AppSettings) -> Self {
        // Build provider from user settings
    }
}
```

- [ ] **Step 2: Commit**

---

### Task 5.2: AI Auto-Tag & Summarize

**Files:**
- Modify: `apps/desktop/src-tauri/src/commands.rs`
- Modify: `apps/desktop/src-tauri/src/ai.rs`

- [ ] **Step 1: Add auto_tag and auto_summarize functions**

```rust
pub async fn auto_tag(content: &str, provider: &AiProvider) -> Result<Vec<String>, String> {
    let prompt = format!(
        "Extract 3-5 concise tags from this content. Return as JSON array of strings only.\n\n{}",
        &content[..content.len().min(2000)]
    );
    let response = provider.complete("You are a content tagger. Return only a JSON array.", &prompt).await?;
    // Parse JSON array from response
}

pub async fn auto_summarize(content: &str, provider: &AiProvider) -> Result<String, String> {
    let prompt = format!(
        "Summarize this content in 2-3 sentences:\n\n{}",
        &content[..content.len().min(3000)]
    );
    provider.complete("You are a concise summarizer.", &prompt).await
}
```

- [ ] **Step 2: Hook into clip_url command**

After clipping, if `auto_tag` or `auto_summarize` settings are enabled, run AI processing and update the clip record.

- [ ] **Step 3: Add manual trigger IPC commands**

```rust
#[tauri::command]
pub async fn ai_tag_clip(id: String, state: State<'_, AppState>) -> Result<Vec<String>, String> { ... }

#[tauri::command]
pub async fn ai_summarize_clip(id: String, state: State<'_, AppState>) -> Result<String, String> { ... }
```

- [ ] **Step 4: Commit**

---

### Task 5.3: "Ask My Yoinks" — RAG Chat

**Files:**
- Modify: `apps/desktop/src-tauri/src/ai.rs`
- Modify: `apps/desktop/src-tauri/src/commands.rs`

- [ ] **Step 1: Add RAG chat function**

```rust
pub async fn ask_yoinks(
    question: &str,
    search_engine: &SearchEngine,
    provider: &AiProvider,
    db: &Connection,
) -> Result<(String, Vec<String>), String> {
    // 1. Search index for relevant content (top 5 results)
    let results = search_engine.search(question, 5)?;

    // 2. Fetch full content for each result
    let context = results.iter().map(|r| {
        // Get clip/download content from DB
        format!("Source: {}\nTitle: {}\n{}\n---", r.url, r.title, r.snippet)
    }).collect::<Vec<_>>().join("\n\n");

    // 3. Build prompt with context
    let system = "You are a helpful assistant answering questions based on the user's saved content. \
                   Cite sources by title when referencing specific content. \
                   If the saved content doesn't contain relevant information, say so.";
    let user_prompt = format!(
        "Based on my saved content:\n\n{}\n\nQuestion: {}",
        context, question
    );

    // 4. Get AI response
    let answer = provider.complete(system, &user_prompt).await?;
    let source_ids = results.iter().map(|r| r.id.clone()).collect();

    Ok((answer, source_ids))
}
```

- [ ] **Step 2: Add IPC command**

```rust
#[tauri::command]
pub async fn chat_ask(question: String, state: State<'_, AppState>) -> Result<ChatResponse, String> {
    // Call ask_yoinks, save to chat_messages table, return response
}

#[tauri::command]
pub fn chat_history(limit: Option<usize>, state: State<'_, AppState>) -> Result<Vec<ChatMessage>, String> { ... }

#[tauri::command]
pub fn chat_clear(state: State<'_, AppState>) -> Result<(), String> { ... }
```

- [ ] **Step 3: Commit**

---

### Task 5.4: AI Chat UI

**Files:**
- Create: `apps/desktop/src/pages/AIPage.tsx`
- Create: `apps/desktop/src/components/ChatMessage.tsx`
- Create: `apps/desktop/src/hooks/useAI.ts`
- Modify: `apps/desktop/src/App.tsx`

- [ ] **Step 1: Create useAI hook**

Manages chat state, sends questions, receives responses with source citations.

- [ ] **Step 2: Create ChatMessage component**

User messages: right-aligned, brand tint background. Assistant messages: left-aligned, glass surface. Source citations as clickable pills below assistant messages.

- [ ] **Step 3: Create AIPage**

- Title: "Ask My Yoinks" (20px bold)
- Chat message list (scrollable)
- Input bar at bottom with send button
- Empty state: "Ask anything about your saved content"
- Sidebar: recent sources used in answers

- [ ] **Step 4: Add to nav**

```typescript
import { Brain } from "lucide-react";
{ id: "ai", label: "Ask", icon: Brain },
```

- [ ] **Step 5: Commit**

---

### Task 5.5: Settings Page — AI Section

**Files:**
- Modify: `apps/desktop/src/pages/SettingsPage.tsx`

- [ ] **Step 1: Add AI settings section**

- Provider selector (segmented control: None / Ollama / Claude / OpenAI)
- API key input (password field, only shown for Claude/OpenAI)
- Model selector (text input or dropdown)
- Ollama base URL (default: http://localhost:11434)
- Toggles: Auto-tag on clip, Auto-summarize on clip

- [ ] **Step 2: Commit**

---

### Task 5.6: MCP Server

**Files:**
- Create: `apps/desktop/src-tauri/src/mcp_server.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Create MCP server**

Exposes Yoinkit's search and clip library via MCP protocol so Claude Desktop / Claude Code can access it as a tool. Uses **stdio transport** (JSON-RPC over stdin/stdout) for Claude Desktop compatibility. Built as a separate binary (`yoinkit-mcp`) that Tauri can spawn, or users configure in Claude Desktop's MCP settings.

**Tools exposed:**
- `search_yoinks(query, limit)` → Search results
- `get_clip(id)` → Full clip content
- `list_recent_clips(limit)` → Recent clips
- `clip_url(url)` → Clip a new URL

**Resources exposed:**
- `yoinkit://clips` → List of all clips
- `yoinkit://clips/{id}` → Individual clip content

This makes Yoinkit a context provider for any MCP-compatible AI tool.

- [ ] **Step 2: Add MCP server toggle to Settings**

- [ ] **Step 3: Commit**

---

### Task 5.7: Transcript → Structured Notes

**Files:**
- Modify: `apps/desktop/src-tauri/src/ai.rs`
- Modify: `apps/desktop/src-tauri/src/commands.rs`
- Modify: `apps/desktop/src/pages/VideoPage.tsx`
- Modify: `apps/desktop/src/pages/AudioPage.tsx`

- [ ] **Step 1: Add transcript processing function**

```rust
pub async fn structure_transcript(transcript: &str, provider: &AiProvider) -> Result<String, String> {
    let prompt = format!(
        "Convert this raw transcript into structured Markdown notes with:\n\
         - A brief summary (2-3 sentences)\n\
         - Key points as bullet points with timestamps if available\n\
         - Notable quotes\n\
         - Action items / takeaways\n\n\
         Transcript:\n{}",
        &transcript[..transcript.len().min(8000)]
    );
    provider.complete("You format transcripts into structured study notes in Markdown.", &prompt).await
}
```

- [ ] **Step 2: Add "Structure Notes" button to Video/Audio pages**

After downloading a transcript, show a "Structure Notes" button that runs AI processing and saves as a clip with `source_type = "transcript"`.

- [ ] **Step 3: Commit**

---

### Task 5.8: NotebookLM Export

**Files:**
- Create: `apps/desktop/src-tauri/src/notebooklm.rs`
- Modify: `apps/desktop/src-tauri/src/commands.rs`

- [ ] **Step 1: Create NotebookLM export module**

Uses the unofficial NotebookLM API (or prepares content for manual import) to export clips as NotebookLM sources. Initially: export as a well-formatted text file ready for drag-and-drop into NotebookLM. When API stabilizes, add direct upload.

- [ ] **Step 2: Add export command and UI button**

- [ ] **Step 3: Commit**

---

## Phase 6: Download Manager Upgrades

**Delivers:** Multi-threaded downloads, scheduling, bandwidth control, duplicate detection.

---

### Task 6.1: Multi-Threaded Downloads

**Files:**
- Modify: `apps/desktop/src-tauri/src/download_manager.rs`
- Modify: `apps/desktop/src-tauri/src/wget.rs`

- [ ] **Step 1: Add chunked download support**

For large files, split into N segments (default 4), download each chunk with wget's `--header="Range: bytes=X-Y"`, then concatenate. Falls back to single-threaded if server doesn't support Range headers.

- [ ] **Step 2: Update progress tracking**

Aggregate progress across chunks. Show combined speed.

- [ ] **Step 3: Commit**

---

### Task 6.2: Download Scheduling

**Files:**
- Create: `apps/desktop/src-tauri/src/scheduler.rs`
- Modify: `apps/desktop/src-tauri/src/commands.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Create scheduler with cron support**

```rust
pub struct Scheduler {
    // Runs a tokio background task that checks schedules table every minute
    // When a schedule's next_run <= now, execute the job (download, mirror, etc.)
    // Update last_run and compute next_run from cron expression
}
```

- [ ] **Step 2: Add schedule IPC commands**

```rust
#[tauri::command]
pub fn create_schedule(url: String, job_type: String, cron: String, flags: Option<String>) -> Result<String, String> { ... }
#[tauri::command]
pub fn list_schedules() -> Result<Vec<Schedule>, String> { ... }
#[tauri::command]
pub fn delete_schedule(id: String) -> Result<(), String> { ... }
#[tauri::command]
pub fn toggle_schedule(id: String, enabled: bool) -> Result<(), String> { ... }
```

- [ ] **Step 3: Add scheduling UI to Settings or Pro page**

- [ ] **Step 4: Commit**

---

### Task 6.3: Duplicate Detection

**Files:**
- Modify: `apps/desktop/src-tauri/src/commands.rs`
- Modify: `apps/desktop/src-tauri/src/db.rs`

- [ ] **Step 1: Check URL against download/clip history before starting**

Before `startDownload` or `clipUrl`, query DB for existing entries with the same URL. If found, return a warning to the frontend. Let user choose: skip, re-download, or view existing.

- [ ] **Step 2: Add file hash column to downloads table**

After download completes, compute SHA256 of the file. Store in DB. Use for content-based dedup even when URLs differ.

- [ ] **Step 3: Commit**

---

### Task 6.4: Bandwidth Throttling

**Files:**
- Modify: `apps/desktop/src-tauri/src/wget.rs`
- Modify: `apps/desktop/src/pages/SettingsPage.tsx`

- [ ] **Step 1: Add global bandwidth limit setting**

Map to wget's `--limit-rate` flag. Add to Settings page as a number input with unit selector (KB/s, MB/s).

- [ ] **Step 2: Commit**

---

## Phase 7: Viral & Delight Features

**Delivers:** Yoink Receipt (shareable card), Yoink Digest (weekly summary), Site Change Monitor.

---

### Task 7.1: Yoink Receipt

**Files:**
- Create: `apps/desktop/src/components/YoinkReceipt.tsx`
- Modify: `apps/desktop/src/components/DownloadItem.tsx`

- [ ] **Step 1: Create YoinkReceipt component**

A shareable card (rendered as a styled div, exportable as PNG via html-to-image):
- Yoinkit logo + "Yoinked!" text
- Thumbnail (if available) or file type icon
- Title / filename
- File size, download date
- Source URL (truncated)
- Tangerine Pop accent bar at bottom
- "yoinkit.app" watermark (subtle)

- [ ] **Step 2: Add "Share" button to DownloadItem**

On click, renders YoinkReceipt and copies PNG to clipboard or saves to Downloads.

- [ ] **Step 3: Commit**

---

### Task 7.2: Yoink Digest

**Files:**
- Modify: `apps/desktop/src-tauri/src/ai.rs`
- Modify: `apps/desktop/src-tauri/src/scheduler.rs`

- [ ] **Step 1: Add digest generation function**

```rust
pub async fn generate_digest(
    clips: &[Clip],
    downloads: &[Download],
    provider: &AiProvider,
) -> Result<String, String> {
    // Summarize recent activity into a Markdown digest
    // "This week you yoinked 23 items across 5 topics..."
    // Group by AI-detected themes
    // Highlight most-accessed content
}
```

- [ ] **Step 2: Schedule weekly digest generation**

Runs every Sunday. Saves as a clip with `source_type = "digest"`. Optionally exports to Obsidian vault.

- [ ] **Step 3: Commit**

---

### Task 7.3: Site Change Monitor

**Files:**
- Create: `apps/desktop/src-tauri/src/monitor.rs`
- Modify: `apps/desktop/src-tauri/src/commands.rs`

- [ ] **Step 1: Create monitor module**

```rust
pub async fn check_for_changes(monitor: &Monitor) -> Result<bool, String> {
    // 1. Fetch page
    // 2. Extract readable content
    // 3. SHA256 hash
    // 4. Compare to monitor.last_hash
    // 5. If different, update DB, return true
}
```

- [ ] **Step 2: Add monitor IPC commands**

```rust
#[tauri::command]
pub fn create_monitor(url: String) -> Result<String, String> { ... }
#[tauri::command]
pub fn list_monitors() -> Result<Vec<Monitor>, String> { ... }
#[tauri::command]
pub fn delete_monitor(id: String) -> Result<(), String> { ... }
```

- [ ] **Step 3: Add monitoring UI**

Simple list in Settings or its own section: URL, last checked, status (changed/unchanged), "Check Now" button.

- [ ] **Step 4: Commit**

---

## Nav Structure (Final)

After all phases, the sidebar nav items:

```typescript
const NAV_ITEMS = [
  { id: "simple",  label: "Downloads", icon: Download },
  { id: "video",   label: "Video",     icon: Video },
  { id: "audio",   label: "Audio",     icon: Music },
  { id: "images",  label: "Images",    icon: ImageIcon },
  { id: "clipper", label: "Clipper",   icon: Scissors },
  { id: "archive", label: "Archive",   icon: Archive },
  { id: "search",  label: "Search",    icon: Search },
  { id: "ai",      label: "Ask",       icon: Brain },
  { id: "pro",     label: "Pro",       icon: Zap },
  { id: "settings",label: "Settings",  icon: Settings },
];
```

---

## Release Tags

| Phase | Tag | Headline |
|-------|-----|----------|
| Phase 1 | v0.3.0 | Content extraction engine |
| Phase 2 | v0.4.0 | Web Clipper + Obsidian export |
| Phase 3 | v0.5.0 | Full-page archive + link rot protection |
| Phase 4 | v0.6.0 | Smart search across everything |
| Phase 5 | v0.7.0 | AI intelligence layer |
| Phase 6 | v0.8.0 | Download manager upgrades |
| Phase 7 | v1.0.0 | "Yoink It. Search It. Ask It." |

---

## Design Constraints (All Phases)

- **3 type sizes only:** 20px (titles), 13px (body), 11px (captions)
- **Brand color:** Tangerine Pop `#FF6B35` on logo, primary buttons, progress bars only
- **Everything else:** Neutral macOS greys via CSS variables
- **Icons:** Lucide-React, `strokeWidth={1.5}`
- **Glass effects:** `backdrop-filter: blur(40px) saturate(180%)` on surfaces
- **macOS HIG:** Source list sidebar, segmented controls, 6px border radius on inputs
- **Accessibility:** All interactive elements keyboard-navigable, focus rings on inputs
- **Privacy-first:** All data stored locally. AI features use user's own API key or local Ollama. No telemetry.
