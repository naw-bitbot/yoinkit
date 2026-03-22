# Yoinkit Pro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Pro feature gating, Gallery, legal consent, license key validation, navigation rename, and upgrade UX as defined in the Pro design spec.

**Architecture:** Pro gating uses the existing `pro_unlocked` boolean in settings, extended with license key validation via LemonSqueezy API. Gallery is a virtual view unioning `downloads` and `clips` tables with a `gallery_meta` join table for Pro organisation features. Legal consent is tracked in a `legal_consent` table checked on app startup.

**Tech Stack:** Rust/Tauri backend, React/TypeScript frontend, SQLite, LemonSqueezy API (license validation)

**Spec:** `docs/superpowers/specs/2026-03-22-yoinkit-pro-design.md`

---

## File Structure

### Rust (apps/desktop/src-tauri/src/)

| File | Action | Responsibility |
|---|---|---|
| `db.rs` | Modify | Add `migrate_v4()` — collections, gallery_meta, smart_folders, legal_consent tables. Add gallery CRUD, legal consent CRUD. Add new settings defaults. |
| `settings.rs` | Modify | Add `license_key`, `pro_since`, `gallery_view` fields to `AppSettings` |
| `commands.rs` | Modify | Add gallery commands, license validation command, legal consent commands. Add Pro gating to video/audio quality, batch, scheduling, monitor, MCP commands. |
| `license.rs` | Create | LemonSqueezy license key validation logic |
| `lib.rs` | Modify | Register new commands, add `license` module |

### React (apps/desktop/src/)

| File | Action | Responsibility |
|---|---|---|
| `App.tsx` | Modify | Rename nav, add Gallery, add legal consent gate |
| `lib/tauri.ts` | Modify | Add new TypeScript interfaces and API methods |
| `hooks/usePro.ts` | Create | Pro status convenience hook |
| `hooks/useGallery.ts` | Create | Gallery data fetching, pagination, filtering |
| `pages/SimplePage.tsx` | Rename | Becomes conceptually "Yoinks" (label change only in App.tsx) |
| `pages/GalleryPage.tsx` | Create | Gallery grid/list view with free/pro split |
| `pages/VideoPage.tsx` | Modify | Add Pro gating to quality selector |
| `pages/AudioPage.tsx` | Modify | Add Pro gating to format/quality selector |
| `pages/ProPage.tsx` | Rewrite | New shop window (free) / dashboard (unlocked) |
| `pages/SettingsPage.tsx` | Modify | Add license key input, legal links |
| `components/ProBadge.tsx` | Create | Reusable "Pro" pill badge |
| `components/ProOverlay.tsx` | Create | Locked feature overlay |
| `components/GalleryItem.tsx` | Create | Single gallery item card (grid/list variants) |
| `components/GalleryToolbar.tsx` | Create | Sort, filter, view toggle, collection picker (Pro) |
| `components/LegalConsent.tsx` | Create | First-launch ToS agreement screen |
| `components/ConfettiCelebration.tsx` | Create | Pro unlock celebration animation |

---

## Phase 1: Backend Foundation (Tasks 1-4)

### Task 1: Database Migration v4

**Files:**
- Modify: `apps/desktop/src-tauri/src/db.rs`

- [ ] **Step 1: Add migrate_v4 function**

Add after the existing `migrate_v3` function (around line 230):

```rust
fn migrate_v4(conn: &Connection) -> Result<()> {
    conn.execute_batch("
        CREATE TABLE IF NOT EXISTS collections (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            color TEXT,
            position INTEGER DEFAULT 0,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS gallery_meta (
            item_id TEXT NOT NULL,
            item_type TEXT NOT NULL,
            collection_id TEXT,
            tags TEXT DEFAULT '',
            flag TEXT DEFAULT '',
            position INTEGER DEFAULT 0,
            added_at TEXT NOT NULL,
            PRIMARY KEY (item_id, item_type),
            FOREIGN KEY (collection_id) REFERENCES collections(id)
        );

        CREATE TABLE IF NOT EXISTS smart_folders (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            rules_json TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS legal_consent (
            id INTEGER PRIMARY KEY,
            tos_version TEXT NOT NULL,
            accepted_at TEXT NOT NULL
        );


        -- Backfill gallery_meta for existing downloads
        INSERT OR IGNORE INTO gallery_meta (item_id, item_type, added_at)
            SELECT id, 'download', created_at FROM downloads;

        -- Backfill gallery_meta for existing clips
        INSERT OR IGNORE INTO gallery_meta (item_id, item_type, added_at)
            SELECT id, 'clip', created_at FROM clips;
    ")?;
    conn.execute(
        "INSERT OR IGNORE INTO schema_version (version, applied_at) VALUES (4, datetime('now'))",
        [],
    )?;
    Ok(())
}
```

- [ ] **Step 2: Call migrate_v4 from Database::new() with version guard**

In the `new()` method, follow the existing pattern (see `migrate_v2`/`migrate_v3` guards around line 106-114). Add:

```rust
if current_version < 4 {
    migrate_v4(&conn)?;
}
```

Do the same in `new_with_path()`.

- [ ] **Step 2b: Add `hostname` dependency to Cargo.toml**

In `apps/desktop/src-tauri/Cargo.toml`, add to `[dependencies]`:

```toml
hostname = "0.4"
```

- [ ] **Step 3: Add new settings defaults**

In `init_default_settings()`, add these to the defaults vec:

```rust
("license_key", ""),
("pro_since", ""),
("gallery_view", "grid"),
```

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src-tauri/src/db.rs
git commit -m "feat(db): add migrate_v4 — gallery, collections, legal consent tables"
```

---

### Task 2: Gallery CRUD in Database

**Files:**
- Modify: `apps/desktop/src-tauri/src/db.rs`

- [ ] **Step 1: Add GalleryItem and Collection structs**

Add after the existing struct definitions:

```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GalleryItem {
    pub item_id: String,
    pub item_type: String,       // "download" or "clip"
    pub title: String,
    pub url: String,
    pub source_type: String,     // "download", "article", "archive", etc.
    pub collection_id: Option<String>,
    pub tags: String,
    pub flag: String,
    pub added_at: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Collection {
    pub id: String,
    pub name: String,
    pub color: Option<String>,
    pub position: i32,
    pub created_at: String,
}
```

- [ ] **Step 2: Add gallery_meta auto-insert to existing insert methods**

In `insert_download()`, after the existing INSERT, add:

```rust
conn.execute(
    "INSERT OR IGNORE INTO gallery_meta (item_id, item_type, added_at) VALUES (?1, 'download', ?2)",
    params![download.id, download.created_at],
)?;
```

In `insert_clip()`, after the existing INSERT, add:

```rust
conn.execute(
    "INSERT OR IGNORE INTO gallery_meta (item_id, item_type, added_at) VALUES (?1, 'clip', ?2)",
    params![clip.id, clip.created_at],
)?;
```

- [ ] **Step 3: Add list_gallery_items method**

```rust
pub fn list_gallery_items(&self, limit: usize, offset: usize) -> Result<Vec<GalleryItem>> {
    let conn = self.conn.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT g.item_id, g.item_type,
                COALESCE(d.url, c.url) as url,
                CASE g.item_type
                    WHEN 'download' THEN COALESCE(
                        REPLACE(REPLACE(d.save_path, RTRIM(d.save_path, REPLACE(d.save_path, '/', '')), ''), '/', ''),
                        d.url)
                    WHEN 'clip' THEN COALESCE(c.title, c.url)
                END as title,
                CASE g.item_type
                    WHEN 'download' THEN 'download'
                    WHEN 'clip' THEN COALESCE(c.source_type, 'clip')
                END as source_type,
                g.collection_id, g.tags, g.flag, g.added_at,
                COALESCE(d.created_at, c.created_at) as created_at
         FROM gallery_meta g
         LEFT JOIN downloads d ON g.item_type = 'download' AND g.item_id = d.id
         LEFT JOIN clips c ON g.item_type = 'clip' AND g.item_id = c.id
         ORDER BY g.added_at DESC
         LIMIT ?1 OFFSET ?2"
    )?;
    let rows = stmt.query_map(params![limit as i64, offset as i64], |row| {
        Ok(GalleryItem {
            item_id: row.get(0)?,
            item_type: row.get(1)?,
            url: row.get(2)?,
            title: row.get(3)?,
            source_type: row.get(4)?,
            collection_id: row.get(5)?,
            tags: row.get(6)?,
            flag: row.get(7)?,
            added_at: row.get(8)?,
            created_at: row.get(9)?,
        })
    })?;
    rows.collect()
}

pub fn count_gallery_items(&self) -> Result<i64> {
    let conn = self.conn.lock().unwrap();
    conn.query_row("SELECT COUNT(*) FROM gallery_meta", [], |row| row.get(0))
}
```

- [ ] **Step 4: Add gallery_meta update and delete methods**

```rust
pub fn update_gallery_meta(&self, item_id: &str, item_type: &str, collection_id: Option<&str>, tags: &str, flag: &str) -> Result<()> {
    let conn = self.conn.lock().unwrap();
    conn.execute(
        "UPDATE gallery_meta SET collection_id = ?1, tags = ?2, flag = ?3 WHERE item_id = ?4 AND item_type = ?5",
        params![collection_id, tags, flag, item_id, item_type],
    )?;
    Ok(())
}

pub fn delete_gallery_meta(&self, item_id: &str, item_type: &str) -> Result<()> {
    let conn = self.conn.lock().unwrap();
    conn.execute(
        "DELETE FROM gallery_meta WHERE item_id = ?1 AND item_type = ?2",
        params![item_id, item_type],
    )?;
    Ok(())
}
```

- [ ] **Step 5: Add collection CRUD methods**

```rust
pub fn insert_collection(&self, collection: &Collection) -> Result<()> {
    let conn = self.conn.lock().unwrap();
    conn.execute(
        "INSERT INTO collections (id, name, color, position, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![collection.id, collection.name, collection.color, collection.position, collection.created_at],
    )?;
    Ok(())
}

pub fn list_collections(&self) -> Result<Vec<Collection>> {
    let conn = self.conn.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT id, name, color, position, created_at FROM collections ORDER BY position ASC"
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(Collection {
            id: row.get(0)?,
            name: row.get(1)?,
            color: row.get(2)?,
            position: row.get(3)?,
            created_at: row.get(4)?,
        })
    })?;
    rows.collect()
}

pub fn delete_collection(&self, id: &str) -> Result<()> {
    let conn = self.conn.lock().unwrap();
    conn.execute("UPDATE gallery_meta SET collection_id = NULL WHERE collection_id = ?1", params![id])?;
    conn.execute("DELETE FROM collections WHERE id = ?1", params![id])?;
    Ok(())
}
```

- [ ] **Step 6: Add legal consent methods**

```rust
pub fn record_consent(&self, tos_version: &str) -> Result<()> {
    let conn = self.conn.lock().unwrap();
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO legal_consent (tos_version, accepted_at) VALUES (?1, ?2)",
        params![tos_version, now],
    )?;
    Ok(())
}

pub fn has_valid_consent(&self, current_tos_version: &str) -> Result<bool> {
    let conn = self.conn.lock().unwrap();
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM legal_consent WHERE tos_version = ?1",
        params![current_tos_version],
        |row| row.get(0),
    )?;
    Ok(count > 0)
}
```

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src-tauri/src/db.rs
git commit -m "feat(db): add gallery CRUD, collection CRUD, and legal consent methods"
```

---

### Task 3: Settings Extension & License Module

**Files:**
- Modify: `apps/desktop/src-tauri/src/settings.rs`
- Create: `apps/desktop/src-tauri/src/license.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Extend AppSettings struct**

In `settings.rs`, add these fields to `AppSettings`:

```rust
pub license_key: String,
pub pro_since: String,
pub gallery_view: String,
```

Update `get_settings()` to read these from DB (following the existing pattern of `get_or_default`). Update `update_settings()` to write them.

- [ ] **Step 2: Create license.rs**

```rust
use serde::{Deserialize, Serialize};

const LEMONSQUEEZY_API_URL: &str = "https://api.lemonsqueezy.com/v1/licenses/activate";

#[derive(Debug, Serialize)]
struct ActivateRequest {
    license_key: String,
    instance_name: String,
}

#[derive(Debug, Deserialize)]
struct LemonSqueezyResponse {
    activated: bool,
    error: Option<String>,
    license_key: Option<LicenseKeyInfo>,
}

#[derive(Debug, Deserialize)]
struct LicenseKeyInfo {
    status: String,
    activation_limit: Option<i32>,
    activation_usage: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct ActivationResult {
    pub success: bool,
    pub error: Option<String>,
    pub activations_used: Option<i32>,
    pub activations_limit: Option<i32>,
}

pub async fn activate_license(license_key: &str) -> Result<ActivationResult, String> {
    let instance_name = hostname::get()
        .map(|h| h.to_string_lossy().to_string())
        .unwrap_or_else(|_| "unknown".to_string());

    let client = reqwest::Client::new();
    let resp = client
        .post(LEMONSQUEEZY_API_URL)
        .header("Accept", "application/json")
        .form(&[
            ("license_key", license_key),
            ("instance_name", &instance_name),
        ])
        .send()
        .await
        .map_err(|e| format!("Network error: {}. Your key has been saved and will be validated on next launch.", e))?;

    let body: LemonSqueezyResponse = resp.json().await.map_err(|e| e.to_string())?;

    if body.activated {
        Ok(ActivationResult {
            success: true,
            error: None,
            activations_used: body.license_key.as_ref().and_then(|k| k.activation_usage),
            activations_limit: body.license_key.as_ref().and_then(|k| k.activation_limit),
        })
    } else {
        Ok(ActivationResult {
            success: false,
            error: body.error.or(Some("Activation failed".to_string())),
            activations_used: None,
            activations_limit: None,
        })
    }
}
```

- [ ] **Step 3: Add license module to lib.rs**

Add `mod license;` to the module list in `lib.rs`.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src-tauri/src/settings.rs apps/desktop/src-tauri/src/license.rs apps/desktop/src-tauri/src/lib.rs
git commit -m "feat: add license key validation module and extend settings"
```

---

### Task 4: Backend Commands — Gallery, License, Legal, Pro Gating

**Files:**
- Modify: `apps/desktop/src-tauri/src/commands.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Add gallery commands**

```rust
#[tauri::command]
pub fn list_gallery(limit: Option<usize>, offset: Option<usize>, state: State<'_, AppState>) -> Result<Vec<crate::db::GalleryItem>, String> {
    state.db.list_gallery_items(limit.unwrap_or(50), offset.unwrap_or(0))
        .map_err(|e| format!("DB error: {}", e))
}

#[tauri::command]
pub fn gallery_count(state: State<'_, AppState>) -> Result<i64, String> {
    state.db.count_gallery_items().map_err(|e| format!("DB error: {}", e))
}

#[tauri::command]
pub fn update_gallery_item(item_id: String, item_type: String, collection_id: Option<String>, tags: String, flag: String, state: State<'_, AppState>) -> Result<(), String> {
    state.db.update_gallery_meta(&item_id, &item_type, collection_id.as_deref(), &tags, &flag)
        .map_err(|e| format!("DB error: {}", e))
}

#[tauri::command]
pub fn create_collection(name: String, color: Option<String>, state: State<'_, AppState>) -> Result<crate::db::Collection, String> {
    let collection = crate::db::Collection {
        id: uuid::Uuid::new_v4().to_string(),
        name,
        color,
        position: 0,
        created_at: chrono::Utc::now().to_rfc3339(),
    };
    state.db.insert_collection(&collection).map_err(|e| format!("DB error: {}", e))?;
    Ok(collection)
}

#[tauri::command]
pub fn list_collections(state: State<'_, AppState>) -> Result<Vec<crate::db::Collection>, String> {
    state.db.list_collections().map_err(|e| format!("DB error: {}", e))
}

#[tauri::command]
pub fn delete_collection_cmd(id: String, state: State<'_, AppState>) -> Result<(), String> {
    state.db.delete_collection(&id).map_err(|e| format!("DB error: {}", e))
}
```

- [ ] **Step 2: Add license activation command**

```rust
#[tauri::command]
pub async fn activate_license(license_key: String, state: State<'_, AppState>) -> Result<crate::license::ActivationResult, String> {
    let result = crate::license::activate_license(&license_key).await?;
    if result.success {
        let mut settings = crate::settings::get_settings(&state.db)?;
        settings.pro_unlocked = true;
        settings.license_key = license_key;
        settings.pro_since = chrono::Utc::now().to_rfc3339();
        crate::settings::update_settings(&state.db, &settings)?;
    }
    Ok(result)
}
```

- [ ] **Step 3: Add legal consent commands**

```rust
const TOS_VERSION: &str = "1.0";

#[tauri::command]
pub fn check_consent(state: State<'_, AppState>) -> Result<bool, String> {
    state.db.has_valid_consent(TOS_VERSION).map_err(|e| format!("DB error: {}", e))
}

#[tauri::command]
pub fn accept_consent(state: State<'_, AppState>) -> Result<(), String> {
    state.db.record_consent(TOS_VERSION).map_err(|e| format!("DB error: {}", e))
}
```

- [ ] **Step 4: Add Pro gating to video/audio quality commands**

In `start_video_download`, add at the top of the function. Check the actual function signature first — parameters may be `Option<String>` or `String` depending on the existing code. Add:

```rust
let app_settings = crate::settings::get_settings(&state.db)?;
if !app_settings.pro_unlocked {
    // Enforce free tier: max 720p
    if let Some(ref q) = quality {
        if q == "4k" || q == "1080p" {
            return Err("Pro required for 1080p and 4K quality".to_string());
        }
    }
}
```

In `start_audio_download`, add similar gating. Check the actual parameter types (`format` and `quality` may be `Option<String>` or `String`):

```rust
let app_settings = crate::settings::get_settings(&state.db)?;
if !app_settings.pro_unlocked {
    // Enforce free tier: MP3 only, max 192kbps
    if let Some(ref f) = format {
        if f != "mp3" {
            return Err("Pro required for FLAC, WAV, AAC, and Opus formats".to_string());
        }
    }
    if let Some(ref q) = quality {
        if q == "0" { // yt-dlp quality 0 = best = 320kbps
            return Err("Pro required for 320kbps quality".to_string());
        }
    }
}
```

- [ ] **Step 5: Add Pro gating to batch, scheduling, and monitor commands**

Add to the top of `create_schedule`, `create_monitor`, and any batch operation commands:

```rust
let app_settings = crate::settings::get_settings(&state.db)?;
if !app_settings.pro_unlocked {
    return Err("Pro required for this feature".to_string());
}
```

- [ ] **Step 5b: Wire gallery_meta cleanup into existing delete commands**

In `delete_download` command, add after the existing delete call:

```rust
let _ = state.db.delete_gallery_meta(&id, "download");
```

In `delete_clip` command, add after the existing delete call:

```rust
let _ = state.db.delete_gallery_meta(&id, "clip");
```

- [ ] **Step 6: Register all new commands in lib.rs**

Add to the `invoke_handler` macro:

```rust
commands::list_gallery,
commands::gallery_count,
commands::update_gallery_item,
commands::create_collection,
commands::list_collections,
commands::delete_collection_cmd,
commands::activate_license,
commands::check_consent,
commands::accept_consent,
```

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src-tauri/src/commands.rs apps/desktop/src-tauri/src/lib.rs
git commit -m "feat: add gallery, license, legal consent commands and Pro gating"
```

---

## Phase 2: Frontend Foundation (Tasks 5-8)

### Task 5: TypeScript API Bindings & Hooks

**Files:**
- Modify: `apps/desktop/src/lib/tauri.ts`
- Create: `apps/desktop/src/hooks/usePro.ts`
- Create: `apps/desktop/src/hooks/useGallery.ts`

- [ ] **Step 1: Add new interfaces to tauri.ts**

```typescript
export interface GalleryItem {
  item_id: string;
  item_type: "download" | "clip";
  title: string;
  url: string;
  source_type: string;
  collection_id: string | null;
  tags: string;
  flag: string;
  added_at: string;
  created_at: string;
}

export interface Collection {
  id: string;
  name: string;
  color: string | null;
  position: number;
  created_at: string;
}

export interface ActivationResult {
  success: boolean;
  error: string | null;
  activations_used: number | null;
  activations_limit: number | null;
}
```

- [ ] **Step 2: Add new API methods to tauri.ts**

```typescript
// Gallery
listGallery: (limit?: number, offset?: number) => invoke<GalleryItem[]>("list_gallery", { limit, offset }),
galleryCount: () => invoke<number>("gallery_count"),
updateGalleryItem: (itemId: string, itemType: string, collectionId: string | null, tags: string, flag: string) =>
  invoke<void>("update_gallery_item", { itemId, itemType, collectionId, tags, flag }),

// Collections
createCollection: (name: string, color?: string) => invoke<Collection>("create_collection", { name, color }),
listCollections: () => invoke<Collection[]>("list_collections"),
deleteCollection: (id: string) => invoke<void>("delete_collection_cmd", { id }),

// License
activateLicense: (licenseKey: string) => invoke<ActivationResult>("activate_license", { licenseKey }),

// Legal
checkConsent: () => invoke<boolean>("check_consent"),
acceptConsent: () => invoke<void>("accept_consent"),
```

- [ ] **Step 3: Add license_key, pro_since, gallery_view to AppSettings interface**

In `apps/desktop/src/lib/tauri.ts`, add to `AppSettings`:

```typescript
export interface AppSettings {
  // ... existing fields ...
  license_key: string;
  pro_since: string;
  gallery_view: string;
}
```

Also update `DEFAULT_SETTINGS` in `apps/desktop/src/hooks/useSettings.ts` to include the new fields with defaults:

```typescript
license_key: "",
pro_since: "",
gallery_view: "grid",
```

This prevents partial settings updates from overwriting these fields with undefined.

- [ ] **Step 4: Create usePro.ts hook**

```typescript
import { useSettings } from "./useSettings";

export function usePro() {
  const { settings, loading } = useSettings();
  return {
    isPro: settings?.pro_unlocked ?? false,
    proSince: settings?.pro_since || null,
    loading,
  };
}
```

- [ ] **Step 5: Create useGallery.ts hook**

```typescript
import { useState, useEffect, useCallback } from "react";
import { api, GalleryItem, Collection } from "../lib/tauri";

export function useGallery() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [galleryItems, galleryCount, cols] = await Promise.all([
        api.listGallery(50, 0),
        api.galleryCount(),
        api.listCollections(),
      ]);
      setItems(galleryItems);
      setCount(galleryCount);
      setCollections(cols);
    } catch (e) {
      console.error("Gallery error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const loadMore = useCallback(async () => {
    const more = await api.listGallery(50, items.length);
    setItems(prev => [...prev, ...more]);
  }, [items.length]);

  return { items, collections, count, loading, refresh, loadMore };
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/lib/tauri.ts apps/desktop/src/hooks/usePro.ts apps/desktop/src/hooks/useGallery.ts
git commit -m "feat: add gallery/license/consent API bindings and usePro/useGallery hooks"
```

---

### Task 6: Shared Pro Components

**Files:**
- Create: `apps/desktop/src/components/ProBadge.tsx`
- Create: `apps/desktop/src/components/ProOverlay.tsx`
- Create: `apps/desktop/src/components/LegalConsent.tsx`
- Create: `apps/desktop/src/components/ConfettiCelebration.tsx`

- [ ] **Step 1: Create ProBadge.tsx**

Small "Pro" pill used next to locked features.

```tsx
import React from "react";
import { Crown } from "lucide-react";

interface ProBadgeProps {
  onClick?: () => void;
  size?: "sm" | "md";
}

export function ProBadge({ onClick, size = "sm" }: ProBadgeProps) {
  const cls = size === "sm"
    ? "text-[10px] px-1.5 py-0.5 gap-0.5"
    : "text-xs px-2 py-1 gap-1";
  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center rounded-full bg-[color-mix(in_srgb,var(--brand)_20%,transparent)] text-[var(--brand)] font-medium cursor-pointer hover:bg-[color-mix(in_srgb,var(--brand)_30%,transparent)] transition-colors ${cls}`}
    >
      <Crown className={size === "sm" ? "w-2.5 h-2.5" : "w-3 h-3"} />
      Pro
    </span>
  );
}
```

- [ ] **Step 2: Create ProOverlay.tsx**

Overlay for Pro-locked pages (scheduler, wget builder).

```tsx
import React from "react";
import { Lock } from "lucide-react";
import { ProBadge } from "./ProBadge";

interface ProOverlayProps {
  feature: string;
  description: string;
  onUpgrade: () => void;
}

export function ProOverlay({ feature, description, onUpgrade }: ProOverlayProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 space-y-4">
      <div className="w-16 h-16 rounded-2xl bg-[var(--surface)] flex items-center justify-center">
        <Lock className="w-8 h-8 text-[var(--text-muted)]" />
      </div>
      <h2 className="text-xl font-semibold">{feature}</h2>
      <p className="text-[var(--text-secondary)] text-center max-w-sm">{description}</p>
      <button
        onClick={onUpgrade}
        className="mt-4 px-6 py-2.5 rounded-xl bg-[var(--brand)] text-white font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
      >
        <ProBadge size="md" /> Upgrade to Pro · £19
      </button>
      <p className="text-xs text-[var(--text-muted)]">One-time purchase. No subscription. Ever.</p>
    </div>
  );
}
```

- [ ] **Step 3: Create LegalConsent.tsx**

First-launch agreement screen.

```tsx
import React, { useState } from "react";
import { Shield } from "lucide-react";

interface LegalConsentProps {
  onAccept: () => void;
}

export function LegalConsent({ onAccept }: LegalConsentProps) {
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="fixed inset-0 bg-[var(--bg)] z-50 flex items-center justify-center">
      <div className="max-w-md w-full mx-4 space-y-6">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-[color-mix(in_srgb,var(--brand)_10%,transparent)] flex items-center justify-center">
            <Shield className="w-8 h-8 text-[var(--brand)]" />
          </div>
          <h1 className="text-2xl font-bold">Welcome to Yoinkit</h1>
          <p className="text-[var(--text-secondary)] text-center">Your personal web toolkit</p>
        </div>

        <div className="bg-[var(--surface)] rounded-xl p-5 space-y-3 text-sm text-[var(--text-secondary)]">
          <p>Yoinkit is a personal web toolkit for saving content to your own device.</p>
          <p>You are responsible for ensuring you have the right to save content you download.</p>
          <p>Respect creators — credit original sources, do not redistribute copyrighted material.</p>
        </div>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1 rounded border-[var(--border)] accent-[var(--brand)]"
          />
          <span className="text-sm">
            I agree to the{" "}
            <a href="https://yoinkit.app/terms" target="_blank" className="text-[var(--brand)] underline">
              Terms of Use
            </a>{" "}
            and{" "}
            <a href="https://yoinkit.app/privacy" target="_blank" className="text-[var(--brand)] underline">
              Privacy Policy
            </a>
          </span>
        </label>

        <button
          onClick={onAccept}
          disabled={!agreed}
          className="w-full py-3 rounded-xl bg-[var(--brand)] text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
        >
          Get Started
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create ConfettiCelebration.tsx**

Minimal confetti using CSS animations (no dependencies).

```tsx
import React, { useEffect, useState } from "react";

export function ConfettiCelebration() {
  const [particles, setParticles] = useState<{ id: number; left: number; color: string; delay: number }[]>([]);

  useEffect(() => {
    const colors = ["#E8913A", "#FFD700", "#FF6B6B", "#4ECDC4", "#45B7D1"];
    const p = Array.from({ length: 40 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 0.5,
    }));
    setParticles(p);
    const timer = setTimeout(() => setParticles([]), 2500);
    return () => clearTimeout(timer);
  }, []);

  if (particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute w-2 h-2 rounded-full animate-confetti"
          style={{
            left: `${p.left}%`,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            top: "-10px",
          }}
        />
      ))}
      <style>{`
        @keyframes confetti {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        .animate-confetti { animation: confetti 2s ease-out forwards; }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/components/ProBadge.tsx apps/desktop/src/components/ProOverlay.tsx apps/desktop/src/components/LegalConsent.tsx apps/desktop/src/components/ConfettiCelebration.tsx
git commit -m "feat: add ProBadge, ProOverlay, LegalConsent, and ConfettiCelebration components"
```

---

### Task 7: Navigation Rename & Legal Consent Gate

**Files:**
- Modify: `apps/desktop/src/App.tsx`

- [ ] **Step 1: Update Page type and NAV_ITEMS**

Change the `Page` type:

```typescript
type Page = "yoinks" | "gallery" | "video" | "audio" | "images" | "clipper" | "archive" | "search" | "ai" | "pro" | "settings";
```

Update `NAV_ITEMS` — rename "Downloads" to "Yoinks", add Gallery between Yoinks and Video:

```typescript
import { Download, LayoutGrid, Video, Music, ImageIcon, Scissors, Archive, Search, Brain, Zap, Settings } from "lucide-react";

const NAV_ITEMS: { id: Page; label: string; icon: React.ComponentType<LucideProps> }[] = [
  { id: "yoinks", label: "Yoinks", icon: Download },
  { id: "gallery", label: "Gallery", icon: LayoutGrid },
  { id: "video", label: "Video", icon: Video },
  { id: "audio", label: "Audio", icon: Music },
  { id: "images", label: "Images", icon: ImageIcon },
  { id: "clipper", label: "Clipper", icon: Scissors },
  { id: "archive", label: "Archive", icon: Archive },
  { id: "search", label: "Search", icon: Search },
  { id: "ai", label: "Ask", icon: Brain },
  { id: "pro", label: "Pro", icon: Zap },
  { id: "settings", label: "Settings", icon: Settings },
];
```

- [ ] **Step 2: Update default page and page routing**

Change initial state: `useState<Page>("yoinks")`.

Update the page rendering switch to use `"yoinks"` instead of `"simple"`:

```typescript
{activePage === "yoinks" && <SimplePage />}
{activePage === "gallery" && <GalleryPage />}
```

- [ ] **Step 3: Add legal consent gate**

Add `useEffect` to the React import if not already present. Import LegalConsent and api. Add consent state and check:

```typescript
import { LegalConsent } from "./components/LegalConsent";
import { api } from "./lib/tauri";

// Inside App component:
const [consentChecked, setConsentChecked] = useState(false);
const [hasConsent, setHasConsent] = useState(true); // default true to avoid flash

useEffect(() => {
  api.checkConsent().then(ok => {
    setHasConsent(ok);
    setConsentChecked(true);
  }).catch(() => setConsentChecked(true));
}, []);

const handleAcceptConsent = async () => {
  await api.acceptConsent();
  setHasConsent(true);
};

// In render, before the main layout:
if (consentChecked && !hasConsent) {
  return <LegalConsent onAccept={handleAcceptConsent} />;
}
```

- [ ] **Step 4: Update version in sidebar**

Change `v0.2.2` to `v0.3.0` in the sidebar footer.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/App.tsx
git commit -m "feat: rename Downloads to Yoinks, add Gallery nav, add legal consent gate"
```

---

### Task 8: Gallery Page

**Files:**
- Create: `apps/desktop/src/pages/GalleryPage.tsx`
- Create: `apps/desktop/src/components/GalleryItem.tsx`
- Create: `apps/desktop/src/components/GalleryToolbar.tsx`

- [ ] **Step 1: Create GalleryItem.tsx**

```tsx
import React from "react";
import { FileText, Download, Archive, Image, Film, Music, Star, Pin, ExternalLink } from "lucide-react";
import type { GalleryItem as GalleryItemType } from "../lib/tauri";

const TYPE_ICONS: Record<string, React.ComponentType<any>> = {
  download: Download,
  article: FileText,
  page: FileText,
  archive: Archive,
  image: Image,
  video: Film,
  audio: Music,
};

const FLAG_ICONS: Record<string, React.ComponentType<any>> = {
  star: Star,
  pin: Pin,
};

interface GalleryItemProps {
  item: GalleryItemType;
  view: "grid" | "list";
}

export function GalleryItemCard({ item, view }: GalleryItemProps) {
  const Icon = TYPE_ICONS[item.source_type] || Download;
  const FlagIcon = FLAG_ICONS[item.flag];
  const date = new Date(item.created_at).toLocaleDateString();

  if (view === "list") {
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer group">
        <div className="w-9 h-9 rounded-lg bg-[var(--bg)] flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-[var(--text-muted)]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{item.title}</p>
          <p className="text-xs text-[var(--text-muted)] truncate">{item.url}</p>
        </div>
        {FlagIcon && <FlagIcon className="w-3.5 h-3.5 text-[var(--brand)]" />}
        <span className="text-xs text-[var(--text-muted)] shrink-0">{date}</span>
        <ExternalLink className="w-3.5 h-3.5 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer p-4 space-y-2 group">
      <div className="w-10 h-10 rounded-lg bg-[var(--bg)] flex items-center justify-center">
        <Icon className="w-5 h-5 text-[var(--text-muted)]" />
      </div>
      <p className="text-sm font-medium line-clamp-2">{item.title}</p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--text-muted)]">{date}</span>
        {FlagIcon && <FlagIcon className="w-3 h-3 text-[var(--brand)]" />}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create GalleryToolbar.tsx**

```tsx
import React from "react";
import { LayoutGrid, List } from "lucide-react";
import { usePro } from "../hooks/usePro";
import { ProBadge } from "./ProBadge";

interface GalleryToolbarProps {
  view: "grid" | "list";
  onViewChange: (v: "grid" | "list") => void;
  count: number;
  limit: number;
  onNavigatePro: () => void;
}

export function GalleryToolbar({ view, onViewChange, count, limit, onNavigatePro }: GalleryToolbarProps) {
  const { isPro } = usePro();

  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">Gallery</h1>
        {!isPro && count > 30 && (
          <span className="text-sm text-[var(--text-muted)]">{count}/{limit}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {!isPro && (
          <button onClick={onNavigatePro} className="text-xs text-[var(--text-muted)] hover:text-[var(--brand)] transition-colors flex items-center gap-1">
            <ProBadge size="sm" /> Collections & filters
          </button>
        )}
        <div className="apple-pill flex">
          <button onClick={() => onViewChange("grid")} className={`apple-pill-item ${view === "grid" ? "active" : ""}`}>
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button onClick={() => onViewChange("list")} className={`apple-pill-item ${view === "list" ? "active" : ""}`}>
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create GalleryPage.tsx**

```tsx
import React, { useState } from "react";
import { LayoutGrid } from "lucide-react";
import { useGallery } from "../hooks/useGallery";
import { usePro } from "../hooks/usePro";
import { useSettings } from "../hooks/useSettings";
import { GalleryItemCard } from "../components/GalleryItem";
import { GalleryToolbar } from "../components/GalleryToolbar";
import { api } from "../lib/tauri";

const FREE_LIMIT = 50;

interface GalleryPageProps {
  onNavigate?: (page: string) => void;
}

export function GalleryPage({ onNavigate }: GalleryPageProps) {
  const { items, count, loading, loadMore } = useGallery();
  const { isPro } = usePro();
  const { settings, updateSettings } = useSettings();
  const [view, setView] = useState<"grid" | "list">((settings?.gallery_view as "grid" | "list") || "grid");

  const handleViewChange = (v: "grid" | "list") => {
    setView(v);
    if (settings) {
      updateSettings({ ...settings, gallery_view: v });
    }
  };

  const displayItems = isPro ? items : items.slice(0, FREE_LIMIT);
  const isFull = !isPro && count >= FREE_LIMIT;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-[var(--brand)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <GalleryToolbar
        view={view}
        onViewChange={handleViewChange}
        count={count}
        limit={FREE_LIMIT}
        onNavigatePro={() => onNavigate?.("pro")}
      />

      {isFull && (
        <div className="mb-4 p-3 rounded-xl bg-[color-mix(in_srgb,var(--brand)_10%,transparent)] text-sm flex items-center justify-between">
          <span>Gallery full · {count}/{FREE_LIMIT} items · Upgrade for unlimited + collections</span>
          <button onClick={() => onNavigate?.("pro")} className="text-[var(--brand)] font-medium hover:underline">
            Upgrade
          </button>
        </div>
      )}

      {displayItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-3">
          <LayoutGrid className="w-12 h-12 text-[var(--text-muted)]" />
          <h2 className="text-lg font-semibold text-[var(--text-secondary)]">No yoinks yet</h2>
          <p className="text-sm text-[var(--text-muted)]">Download, clip, or archive something to see it here</p>
        </div>
      ) : (
        <>
          <div className={view === "grid"
            ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3"
            : "space-y-2"
          }>
            {displayItems.map((item) => (
              <GalleryItemCard key={`${item.item_type}-${item.item_id}`} item={item} view={view} />
            ))}
          </div>
          {isPro && items.length < count && (
            <button onClick={loadMore} className="mt-4 w-full py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
              Load more
            </button>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Import GalleryPage in App.tsx**

Add `import GalleryPage from "./pages/GalleryPage";` and render it for the `"gallery"` page case. Pass `onNavigate={setActivePage}`.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/pages/GalleryPage.tsx apps/desktop/src/components/GalleryItem.tsx apps/desktop/src/components/GalleryToolbar.tsx apps/desktop/src/App.tsx
git commit -m "feat: add Gallery page with grid/list view and free tier limit"
```

---

## Phase 3: Pro Gating & Upgrade UX (Tasks 9-12)

### Task 9: Video & Audio Page Pro Gating

**Files:**
- Modify: `apps/desktop/src/pages/VideoPage.tsx`
- Modify: `apps/desktop/src/pages/AudioPage.tsx`

- [ ] **Step 1: Add Pro gating to VideoPage quality selector**

Import `usePro` and `ProBadge`. Wrap quality buttons:

```tsx
const { isPro } = usePro();
const freeQualities = ["720p", "480p", "360p"];
const proQualities = ["4k", "1080p"];

// In the quality selector:
{["4k", "1080p", "720p", "480p", "360p"].map(q => {
  const isLocked = !isPro && proQualities.includes(q);
  return (
    <button
      key={q}
      onClick={() => !isLocked && setQuality(q)}
      className={`apple-pill-item ${quality === q ? 'active' : ''} ${isLocked ? 'opacity-40 cursor-not-allowed' : ''}`}
      disabled={isLocked}
    >
      {q} {isLocked && <ProBadge size="sm" />}
    </button>
  );
})}
```

- [ ] **Step 2: Add legal info icon to VideoPage**

Below the URL input, add:

```tsx
import { Info } from "lucide-react";

<p className="text-xs text-[var(--text-muted)] flex items-center gap-1">
  <Info className="w-3 h-3" />
  Ensure you have permission to download this content.
</p>
```

- [ ] **Step 3: Add Pro gating to AudioPage format and quality selectors**

Import `usePro` and `ProBadge`. Gate formats:

```tsx
const { isPro } = usePro();
const freeFormats = ["mp3"];
const proFormats = ["aac", "flac", "wav", "opus"];

// Format selector:
{formats.map(f => {
  const isLocked = !isPro && proFormats.includes(f);
  return (
    <button
      key={f}
      onClick={() => !isLocked && setFormat(f)}
      className={`apple-pill-item ${format === f ? 'active' : ''} ${isLocked ? 'opacity-40 cursor-not-allowed' : ''}`}
      disabled={isLocked}
    >
      {f} {isLocked && <ProBadge size="sm" />}
    </button>
  );
})}
```

Gate quality — only allow 192kbps and 128kbps for free (not 320kbps):

```tsx
{qualities.map(q => {
  const isLocked = !isPro && q.value === "0"; // 320kbps
  return (
    <button
      key={q.value}
      onClick={() => !isLocked && setQuality(q.value)}
      className={`apple-pill-item ${quality === q.value ? 'active' : ''} ${isLocked ? 'opacity-40 cursor-not-allowed' : ''}`}
      disabled={isLocked}
    >
      {q.label} {isLocked && <ProBadge size="sm" />}
    </button>
  );
})}
```

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/pages/VideoPage.tsx apps/desktop/src/pages/AudioPage.tsx
git commit -m "feat: add Pro gating to video quality and audio format/quality selectors"
```

---

### Task 10: Pro Page Rewrite

**Files:**
- Modify: `apps/desktop/src/pages/ProPage.tsx`

- [ ] **Step 1: Rewrite ProPage — free state (shop window)**

Replace the current locked view with the marketing page from the spec:

```tsx
import React, { useState } from "react";
import { Crown, Zap, Video, Music, LayoutGrid, Layers, Gauge, Calendar, Bot, Terminal, Search, CheckCircle2 } from "lucide-react";
import { usePro } from "../hooks/usePro";
import { useSettings } from "../hooks/useSettings";
import { api } from "../lib/tauri";
import { ConfettiCelebration } from "../components/ConfettiCelebration";

export function ProPage() {
  const { isPro, proSince } = usePro();
  const { settings } = useSettings();
  const [licenseKey, setLicenseKey] = useState("");
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);

  const handleActivate = async () => {
    if (!licenseKey.trim()) return;
    setActivating(true);
    setError("");
    try {
      const result = await api.activateLicense(licenseKey.trim());
      if (result.success) {
        setShowConfetti(true);
      } else {
        setError(result.error || "Activation failed");
      }
    } catch (e: any) {
      setError(e.toString());
    } finally {
      setActivating(false);
    }
  };

  if (isPro) {
    // Pro dashboard
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[color-mix(in_srgb,var(--brand)_10%,transparent)] flex items-center justify-center">
            <Crown className="w-5 h-5 text-[var(--brand)]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Pro</h1>
            {proSince && <p className="text-sm text-[var(--text-muted)]">Member since {new Date(proSince).toLocaleDateString()}</p>}
          </div>
        </div>
        <p className="text-[var(--text-secondary)]">All Pro features are unlocked. Enjoy the full toolkit.</p>
        {/* Pro feature quick links could go here */}
      </div>
    );
  }

  // Free state — shop window
  const features = [
    { icon: Video, title: "4K & 1080p Video", desc: "Download in full quality, any format" },
    { icon: Music, title: "Lossless Audio", desc: "FLAC, WAV, AAC, Opus, 320kbps" },
    { icon: LayoutGrid, title: "Unlimited Gallery", desc: "Collections, tags, flags, smart folders" },
    { icon: Layers, title: "Batch Operations", desc: "Download, clip, and export in bulk" },
    { icon: Gauge, title: "Multi-Thread Downloads", desc: "Parallel chunked downloading" },
    { icon: Calendar, title: "Scheduling", desc: "Download scheduler & site monitoring" },
    { icon: Bot, title: "MCP Server", desc: "Claude Desktop integration" },
    { icon: Terminal, title: "Wget Builder", desc: "Visual command builder & presets" },
    { icon: Search, title: "Advanced Search", desc: "Regex, filters, saved searches" },
  ];

  return (
    <div className="space-y-8">
      {showConfetti && <ConfettiCelebration />}

      {/* Hero */}
      <div className="text-center space-y-3 py-8">
        <div className="w-16 h-16 rounded-2xl bg-[color-mix(in_srgb,var(--brand)_10%,transparent)] flex items-center justify-center mx-auto">
          <Zap className="w-8 h-8 text-[var(--brand)]" />
        </div>
        <h1 className="text-3xl font-bold">Unlock the full toolkit</h1>
        <p className="text-[var(--text-secondary)]">£19 one-time purchase · Yours forever</p>
      </div>

      {/* Feature grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {features.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="p-4 rounded-xl bg-[var(--surface)] space-y-2">
            <Icon className="w-5 h-5 text-[var(--brand)]" />
            <p className="font-medium text-sm">{title}</p>
            <p className="text-xs text-[var(--text-muted)]">{desc}</p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="text-center space-y-4 py-4">
        <a
          href="https://yoinkit.app/pro"
          target="_blank"
          className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-[var(--brand)] text-white font-medium hover:opacity-90 transition-opacity"
        >
          <Crown className="w-4 h-4" /> Upgrade to Pro · £19
        </a>
        <p className="text-xs text-[var(--text-muted)]">One-time purchase. No subscription. Ever.</p>
      </div>

      {/* License key input */}
      <div className="bg-[var(--surface)] rounded-xl p-5 space-y-3">
        <p className="text-sm font-medium">Already have a license key?</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={licenseKey}
            onChange={(e) => setLicenseKey(e.target.value)}
            placeholder="Paste your license key"
            className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-sm"
          />
          <button
            onClick={handleActivate}
            disabled={activating || !licenseKey.trim()}
            className="px-4 py-2 rounded-lg bg-[var(--brand)] text-white text-sm font-medium disabled:opacity-40"
          >
            {activating ? "Activating..." : "Activate"}
          </button>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/pages/ProPage.tsx
git commit -m "feat: rewrite Pro page — shop window for free, dashboard for Pro"
```

---

### Task 11: Settings Page — License Key & Legal Links

**Files:**
- Modify: `apps/desktop/src/pages/SettingsPage.tsx`

- [ ] **Step 1: Add license key section to Settings**

In the settings page, replace the current Pro status display with a license key management section:

```tsx
{/* Pro & License */}
<div className="glass-card p-5 space-y-4">
  <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Pro License</h3>
  {settings.pro_unlocked ? (
    <div className="flex items-center gap-2">
      <CheckCircle2 className="w-4 h-4 text-green-400" />
      <span className="text-sm">Pro Unlocked</span>
      {settings.pro_since && <span className="text-xs text-[var(--text-muted)]">since {new Date(settings.pro_since).toLocaleDateString()}</span>}
    </div>
  ) : (
    <div className="flex items-center gap-2">
      <span className="text-sm text-[var(--text-muted)]">Free Plan</span>
      <button onClick={() => onNavigate?.("pro")} className="text-xs text-[var(--brand)] hover:underline">Upgrade</button>
    </div>
  )}
</div>
```

- [ ] **Step 2: Add Legal section to Settings**

```tsx
{/* Legal */}
<div className="glass-card p-5 space-y-3">
  <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Legal</h3>
  <div className="space-y-2">
    <a href="https://yoinkit.app/terms" target="_blank" className="block text-sm text-[var(--brand)] hover:underline">Terms of Use</a>
    <a href="https://yoinkit.app/privacy" target="_blank" className="block text-sm text-[var(--brand)] hover:underline">Privacy Policy</a>
    <a href="https://yoinkit.app/dmca" target="_blank" className="block text-sm text-[var(--brand)] hover:underline">DMCA Policy</a>
    <p className="text-xs text-[var(--text-muted)]">copyright@yoinkit.app</p>
  </div>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/pages/SettingsPage.tsx
git commit -m "feat: add license key management and legal links to Settings"
```

---

### Task 12: In-App Legal Touchpoints

**Files:**
- Modify: `apps/desktop/src/pages/ClipperPage.tsx`
- Modify: `apps/desktop/src/pages/ArchivePage.tsx`

- [ ] **Step 1: Add legal info to ClipperPage**

Add below the URL input area:

```tsx
import { Info } from "lucide-react";

<p className="text-xs text-[var(--text-muted)] flex items-center gap-1">
  <Info className="w-3 h-3" />
  Clips are saved locally for personal reference. Credit original creators when sharing.
</p>
```

- [ ] **Step 2: Add legal info to ArchivePage**

Add below the URL input area:

```tsx
<p className="text-xs text-[var(--text-muted)] flex items-center gap-1">
  <Info className="w-3 h-3" />
  Archives are for personal offline access. Fair dealing applies to research and private study.
</p>
```

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/pages/ClipperPage.tsx apps/desktop/src/pages/ArchivePage.tsx
git commit -m "feat: add legal info touchpoints to Clipper and Archive pages"
```

---

## Phase 4: Final Integration (Tasks 13-14)

### Task 13: Pro Gating for Existing Pro-Only Pages

**Files:**
- Modify: `apps/desktop/src/pages/ProPage.tsx` (wget builder section)

The current ProPage already gates the wget builder behind `pro_unlocked`. Since we rewrote it in Task 10, the wget builder, batch input, and preset manager now need to be accessible from the Pro dashboard when unlocked. The shop window replaces the locked view.

- [ ] **Step 1: Add wget builder, batch, and presets to Pro dashboard**

In the Pro dashboard (unlocked state) section of ProPage.tsx, add tabs for the existing functionality:

```tsx
if (isPro) {
  return (
    <div className="space-y-6">
      {/* Header from Task 10 */}

      {/* Tab bar */}
      <div className="apple-pill flex">
        <button onClick={() => setTab("single")} className={`apple-pill-item ${tab === "single" ? "active" : ""}`}>Single</button>
        <button onClick={() => setTab("batch")} className={`apple-pill-item ${tab === "batch" ? "active" : ""}`}>Batch</button>
      </div>

      {/* Existing components */}
      {tab === "single" ? (
        <>
          <CommandBuilder flags={flags} onChange={setFlags} />
          <CommandPreview flags={flags} url={url} />
        </>
      ) : (
        <BatchInput onSubmit={handleBatchDownload} />
      )}

      <PresetManager
        currentFlags={flags}
        onLoad={setFlags}
      />

      <DownloadList downloads={downloads} ... />
    </div>
  );
}
```

Import the existing components: `CommandBuilder`, `CommandPreview`, `BatchInput`, `PresetManager`, `DownloadList`. Preserve the existing state and handlers from the current ProPage.

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/pages/ProPage.tsx
git commit -m "feat: integrate wget builder, batch, presets into Pro dashboard"
```

---

### Task 14: Version Bump & Push

**Files:**
- Modify: `apps/desktop/src-tauri/tauri.conf.json`

- [ ] **Step 1: Update version in tauri.conf.json**

Change `"version": "0.1.0"` to `"version": "0.3.0"`.

- [ ] **Step 2: Merge to main and tag**

```bash
git checkout main
git merge --ff-only v2-features
git tag -d v0.3.0
git push origin :refs/tags/v0.3.0
git tag v0.3.0 -m "v0.3.0: Pro tier, Gallery, legal compliance, license validation"
git push origin main --tags
git checkout v2-features
```

- [ ] **Step 3: Monitor CI build**

```bash
gh run list --limit 4
# Wait for Build Yoinkit to complete
gh run view <run-id> --log-failed  # If it fails
```

- [ ] **Step 4: Verify release**

```bash
gh release view v0.3.0
# Should show Yoinkit_0.3.0_aarch64.dmg and Yoinkit_0.3.0_x64.dmg
```

---

## Task Dependency Graph

```
Phase 1 (Backend):     Task 1 → Task 2 → Task 3 → Task 4
Phase 2 (Frontend):    Task 5 → Task 6 → Task 7 → Task 8
Phase 3 (Pro UX):      Task 9, Task 10, Task 11, Task 12 (parallel after Phase 2)
Phase 4 (Integration): Task 13 → Task 14

Phase 1 and Phase 2 can run in parallel (backend vs frontend).
Phase 3 depends on both Phase 1 and Phase 2.
Phase 4 depends on Phase 3.
```

## Parallel Execution Opportunities

| Batch | Tasks | Reason |
|---|---|---|
| Batch A | Task 1 + Task 6 | Backend DB migration + Frontend components (no dependencies) |
| Batch B | Task 2 + Task 3 | Gallery CRUD + Settings/license module (different sections of db.rs — may need sequential if conflict) |
| Batch C | Task 9 + Task 10 + Task 11 + Task 12 | All modify different page files |

Note: Tasks 5 and 7 depend on Task 3 (AppSettings fields must exist in Rust before TypeScript interfaces are updated). Phase 2 tasks are sequential: 5 → 6 → 7 → 8.

---

## Deferred to Future Plan

The following Pro Gallery features from the spec are **intentionally deferred** to keep this plan focused on the core Pro gating, gallery foundation, and legal framework. They will be implemented in a follow-up plan:

- **Smart folders** — CRUD, rules engine, UI (tables created in migrate_v4 but no logic yet)
- **Sort by** — date, kind, size, source domain, title (gallery query currently hardcoded to date DESC)
- **Filter by** — kind, date range, tag, collection, flag
- **Hover preview** — thumbnail expand, clip snippet, audio waveform
- **Bulk actions** — multi-select, move to collection, tag, flag, delete, export
- **Tags management UI** — adding/editing tags on gallery items from gallery page
- **Pro dashboard** — quick links, gallery stats, MCP status (placeholder in this plan)
- **Scheduler/MCP/Wget builder ProOverlay usage** — created in this plan but not wired to specific pages yet
