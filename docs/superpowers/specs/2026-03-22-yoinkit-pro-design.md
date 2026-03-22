# Yoinkit Pro — Feature Gating, Gallery, Legal & Payment Design

**Date:** 2026-03-22
**Status:** Approved
**Author:** Claude + naw

---

## 1. Overview

Yoinkit is a macOS desktop app (Tauri v2 + React/TypeScript) providing a GUI for wget/yt-dlp/ffmpeg. This spec defines the free/pro feature split, gallery feature, payment system, legal compliance framework, and upgrade UX.

**Pricing:** GBP 19 one-time purchase. No subscription.

**Positioning:** Personal web toolkit — not a "download manager" or "web scraper."

---

## 2. Free vs Pro Feature Split

### 2.1 Free Tier

All core features work. No crippling. Free users are genuinely happy.

| Feature | Free Limit |
|---|---|
| Yoinks (downloads) | Single URL, single thread |
| Video | Up to 720p, MP3 format only |
| Audio | MP3 128kbps only |
| Gallery | 50 items, chronological flat list, grid/list view |
| Clipper | Full functionality |
| Archive | Full functionality |
| Images | Full functionality |
| Search | Full history, basic text search |
| AI | Full (auto-tag, summarize, Ask My Yoinks, digest) |
| Yoink Receipt | Full (brand spreads virally) |

### 2.2 Pro Tier (GBP 19 one-time)

Power features and organisation. The upgrade trigger is frequency-based — the more you use the app, the more you want Pro.

| Feature | Pro Unlock |
|---|---|
| Video | 4K, 1080p, all formats (MP4, MKV, WebM) |
| Audio | 320kbps, FLAC, WAV, AAC, Opus, quality selector |
| Gallery | Unlimited items, collections, projects, tags, flags, smart folders, sort by kind/size/source, filter by kind/date/tag/collection/flag, hover preview, bulk actions |
| Batch operations | Batch download, batch clip, batch export |
| Multi-threaded downloads | Chunked parallel downloading via HTTP Range |
| Scheduling | Download scheduler, site change monitor |
| MCP server | Claude Desktop integration |
| Wget command builder | Visual flag builder + preset manager |
| Advanced search | Regex, filters, saved searches |

### 2.3 Design Principles

- Free users never feel punished — every page works, every core feature works
- Video/audio quality is the daily upgrade reminder (every download shows available higher quality)
- Gallery cap is the weekly reminder (hits 50 after a few weeks of regular use)
- Batch/scheduling/MCP are power-user magnets that justify the price alone
- Clipper, Archive, Images, AI, and Yoink Receipt stay fully free — these are the hooks that get people using and sharing the app

---

## 3. Gallery

### 3.1 Purpose

Central hub for everything you have yoinked. Makes the app feel like a personal library, not just a downloader. Retention feature that keeps people coming back daily.

### 3.2 Content

Everything appears in the gallery automatically when yoinked:
- Downloads (file type icon, video thumbnails where available)
- Clips (article preview with title + snippet)
- Archives (page snapshot with favicon + title)
- Scraped images (thumbnail grid)

### 3.3 Free Gallery

- 50 items max
- Flat chronological list (newest first)
- Grid or list view toggle
- Click to open file / view clip
- Basic info per item: title, type icon, date added, source URL
- Counter in header when > 30 items: "42/50"
- When full: non-blocking banner at top — "Gallery full. 50/50 items. Upgrade for unlimited + collections"

### 3.4 Pro Gallery

Everything in free, plus:

- **Unlimited items** — no cap
- **Collections** — user-created folders (e.g. "Kitchen Reno Research", "Music Production")
- **Smart folders** — auto-populated by rules (e.g. "all videos", "clips from this week", "items tagged work")
- **Tags** — user-applied + AI auto-tags
- **Flags** — star, pin, archive, custom colour flags
- **Sort by** — date, kind, size, source domain, title
- **Filter by** — kind (video/audio/clip/image/archive), date range, tag, collection, flag
- **Hover preview** — thumbnail expand, clip snippet, audio waveform
- **Bulk actions** — multi-select, move to collection, tag, flag, delete, export

### 3.5 Navigation

Gallery sits in the sidebar nav as the second item:

```
Yoinks > Gallery > Video > Audio > Images > Clipper > Archive > Search > Ask > Pro > Settings
```

- "Yoinks" replaces the current "Downloads" label — same page, renamed
- "Gallery" is new

---

## 4. Pro Page & Upgrade Experience

### 4.1 Pro Page (Free State) — the shop window

Not a wall of text. A visual sell.

| Section | Content |
|---|---|
| Hero | "Unlock the full toolkit" with GBP 19 one-time, yours forever |
| Quality | Side-by-side: "720p MP3 to 4K FLAC" with format badges |
| Gallery | "50 items to Unlimited, organised your way" with mock collection/tag UI |
| Power | Icon grid: Batch, Multi-thread, Scheduling, MCP, Wget Builder, Advanced Search |
| Social proof | (Future) review quotes, download count |
| CTA | "Upgrade to Pro" button with "One-time purchase. No subscription. Ever." |

### 4.2 Pro Page (Unlocked State)

Transforms into a Pro dashboard:
- Quick links to Pro-only features (scheduler, wget builder, etc.)
- Gallery stats (total items, collections, storage used)
- "Pro since [date]" badge
- MCP server status / setup guide

### 4.3 Nudge System

Rule: inform, never interrupt. No modals, no popups, no blocking flows.

| Location | Nudge | When |
|---|---|---|
| Video quality selector | 1080p/4K visible but greyed, small "Pro" pill | Every use |
| Audio format selector | FLAC/WAV/AAC greyed, "Pro" pill | Every use |
| Gallery counter | "42/50" muted text in header | When > 30 items |
| Gallery full | Banner: "Gallery full. Upgrade for unlimited + collections" | At 50 items |
| Batch URL input | "Paste multiple URLs" with lock icon + "Pro" | When user tries |
| Scheduler | Visible but locked with "Pro" overlay | When user navigates |
| MCP settings | "Connect to Claude Desktop. Pro" | In settings |
| Wget builder | Visible but locked with "Pro" overlay | When user navigates |

### 4.4 Locked Feature Appearance

The feature is visible — you can see what it does, you just cannot use it yet.

- Greyed-out controls with a small "Pro" badge
- One-line explanation: "Upgrade to unlock 4K downloads. GBP 19 one-time"
- Tapping a locked control navigates to the Pro page, not a modal

### 4.5 Unlock Celebration

When Pro activates:
- Confetti animation (subtle, 2 seconds)
- "Welcome to Pro" toast notification
- Gallery limit removed immediately
- Quality selectors unlock immediately
- Nav "Pro" item gets a small checkmark or crown

---

## 5. Payment & Licensing

### 5.1 Payment Provider: LemonSqueezy

| Factor | Detail |
|---|---|
| Merchant of record | Handles VAT collection, tax remittance, invoicing, refunds across all jurisdictions |
| License key API | Built-in, no custom backend needed |
| Fee | Approximately 5% + 50p per sale (approximately GBP 1.45 on GBP 19) |
| Take-home | Approximately GBP 17.55 per sale |
| GDPR compliant | Yes |

### 5.2 License Key Flow

1. User clicks "Upgrade to Pro" anywhere in app
2. Opens yoinkit.app/pro in default browser (LemonSqueezy checkout page)
3. User pays GBP 19
4. LemonSqueezy generates license key
5. User copies key back into app (Settings > Pro > Enter License Key)
6. App validates key against LemonSqueezy API (single HTTPS POST)
7. `pro_unlocked = true` stored in local SQLite settings
8. All Pro features unlock immediately

### 5.3 Validation Rules

| Rule | Detail |
|---|---|
| Online validation | Once on activation only. Works offline forever after |
| Device limit | 3 activations per key (desktop, laptop, second Mac) |
| No subscription check | One-time validation, no recurring phone-home |
| Grace on failure | Initial activation only: if LemonSqueezy API is unreachable, store the key locally and retry on next app launch for up to 7 days. After successful validation, no further network calls are ever made. This is NOT a recurring check — once validated, Pro is permanent and fully offline. |
| Key storage | Stored locally in SQLite settings, never transmitted again |

### 5.4 Pricing Strategy

| Price | Context |
|---|---|
| GBP 19 | Standard price |
| GBP 14 | Launch discount (first 30 days or first 500 licenses) |
| GBP 9 | "Friend of Yoinkit" referral code (buyer gets GBP 10 off). Implemented as LemonSqueezy discount codes — no custom referral tracking system needed. Codes distributed manually via social media, community, or direct sharing. |
| Free Pro | Open source contributors who submit merged PRs. Manual process — generate a free license key via LemonSqueezy dashboard. |

---

## 6. Legal & Compliance Framework

### 6.1 First Launch Agreement

On first open, before any functionality is available:

- "Welcome to Yoinkit" screen
- Summary of key terms in plain English:
  - "Yoinkit is a personal web toolkit for saving content to your own device"
  - "You are responsible for ensuring you have the right to save content you download"
  - "Respect creators — credit original sources, do not redistribute copyrighted material"
- Checkbox: "I agree to the Terms of Use and Privacy Policy"
- Links to full Terms of Use and Privacy Policy
- Cannot proceed without agreeing
- Agreement timestamp stored in local DB

### 6.2 Terms of Use

Modelled on 4K Video Downloader (the most legally comprehensive tool in the category).

| Provision | Detail |
|---|---|
| User responsibility | "All legal disputes arising from content you download or save are your sole responsibility" |
| Permitted use | Personal, non-commercial use. Research, education, archiving, fair dealing |
| Prohibited use | Do not use Yoinkit to infringe copyright, redistribute protected content, or violate any platform's terms of service |
| Content-neutral | Never name YouTube, Spotify, or any specific platform in terms or marketing |
| No warranty | Software provided "AS IS" without warranties of any kind |
| Liability cap | Maximum liability capped at purchase price (GBP 19 for Pro, GBP 0 for free) |
| Governing law | England and Wales |

### 6.3 DMCA Safe Harbor

| Requirement | Implementation |
|---|---|
| Designated agent | Register at copyright.gov (USD 6 filing fee) |
| Contact info | copyright@yoinkit.app published on website and in app |
| Repeat infringer policy | Documented policy (required for safe harbor eligibility) |
| Takedown response | Documented process for responding to DMCA notices |

### 6.4 Privacy Policy (UK GDPR Compliant)

| Principle | Implementation |
|---|---|
| Local-first | All data stored on user's Mac. No server, no telemetry, no analytics |
| No data collection | App collects zero personal data. No accounts, no tracking |
| AI provider disclosure | "If you enable AI features, your content is sent to your chosen provider (Ollama local / Claude / OpenAI). Review their privacy policies." |
| License key | Only data transmitted: license key validation (one-time HTTPS call to LemonSqueezy) |
| Data minimisation | Nothing leaves the device except user-initiated AI queries and the one-time license check |

### 6.5 In-App Legal Touchpoints

Subtle, helpful guidance woven into the UI. Not legal walls.

| Location | Message |
|---|---|
| Video page | Info icon: "Ensure you have permission to download this content. Learn more" |
| Clipper page | "Clips are saved locally for personal reference. Credit original creators when sharing." |
| Archive page | "Archives are for personal offline access. Fair dealing applies to research and private study." |
| Yoink Receipt | Auto-includes source URL — built-in creator attribution |
| Gallery export | "Exported content may be protected by copyright. Do not redistribute without permission." |
| Settings > Legal | Links to full ToS, Privacy Policy, DMCA info, fair use guide |

### 6.6 Content-Neutral Marketing

For website, App Store listing, README, and all public materials.

| Do | Do Not |
|---|---|
| "Download files from the web" | "Download from YouTube" |
| "Extract audio from media" | "Rip music from Spotify" |
| "Save web pages for offline reading" | "Archive paywalled articles" |
| "Personal web toolkit" | "Download manager" |
| "Clip articles for research" | "Bypass paywalls" |

---

## 7. Competitor Analysis Summary

Yoinkit is the only tool that combines download manager + media extractor + web clipper + archiver + AI knowledge base in one GUI app.

| Competitor Category | Examples | What Yoinkit adds |
|---|---|---|
| CLI download tools | wget, cURL, Aria2 | GUI, video/audio, clipping, AI, search |
| GUI download managers | uGet, FlareGet | Also clips, archives, AI, search |
| Website archivers | ArchiveBox, WebCopy | Also downloads, clips to Markdown, Obsidian export |
| Video downloaders | Allavsoft | Also downloads files, clips, archives, AI |
| Enterprise scraping | PageFreezer ($99/mo), WebScrapingAPI ($49/mo) | Local-first, GBP 19 one-time, privacy-respecting |

Legal positioning relative to competitors:
- More comprehensive than yt-dlp, Aria2 (which have zero disclaimers)
- On par with 4K Video Downloader (gold standard for commercial tools)
- Better user education than FlareGet or Allavsoft
- Local-first architecture provides privacy-by-design protection (similar to Cobalt.tools)

---

## 8. Technical Notes

### 8.1 Pro Gating Implementation

- `pro_unlocked: bool` already exists in AppSettings / SQLite settings
- Add `license_key: Option<String>` and `pro_since: Option<String>` to settings
- Pro gate check: utility function `is_pro(&settings) -> bool` used in Tauri commands and frontend
- Frontend: `usePro()` hook — convenience wrapper around `useSettings()`:
  - Returns `{ isPro: bool, proSince: Option<String>, loading: bool }`
  - Reads `settings.pro_unlocked` as the source of truth
  - No grace period logic — see Section 5.3 clarification

### 8.2 Gallery Data Model

Gallery items are a unified view across existing tables. Note: there is no separate `archives` table — archives are stored as clips with `source_type = 'archive'` in the `clips` table. Similarly, scraped images that are downloaded go through the download manager and are stored in the `downloads` table.

The gallery therefore unions two tables:
- `downloads` — all file downloads (including scraped images)
- `clips` — all clips (including archives where `source_type = 'archive'`)

**Implementation (recommended):** Gallery is a virtual view — queries `downloads` UNION `clips`, applies gallery-specific metadata (collections, tags, flags) via a `gallery_meta` join table. The `item_type` in `gallery_meta` maps to the source: `'download'` or `'clip'`.

The gallery page renders items differently based on type:
- `download` items: file type icon, video thumbnail where available
- `clip` with `source_type = 'article'|'page'`: article preview with title + snippet
- `clip` with `source_type = 'archive'`: page snapshot with favicon + title

### 8.3 Navigation Rename

The internal page ID changes from `"simple"` to `"yoinks"` in the `Page` type union and `NAV_ITEMS` array. The label changes from "Downloads" to "Yoinks". A new `"gallery"` page ID is added. No deep linking or persisted page preferences exist currently, so this is a clean rename with no migration concerns.

```typescript
type Page = "yoinks" | "gallery" | "video" | "audio" | "images" | "clipper" | "archive" | "search" | "ai" | "pro" | "settings"
```

### 8.4 Database Migration (v4)

All new tables and settings are added in `migrate_v4()`, called from `Database::new()` after `migrate_v3()`.

```sql
-- Gallery organisation (Pro)
CREATE TABLE IF NOT EXISTS collections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT,
    position INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS gallery_meta (
    item_id TEXT NOT NULL,
    item_type TEXT NOT NULL,  -- 'download' or 'clip'
    collection_id TEXT,
    tags TEXT DEFAULT '',
    flag TEXT DEFAULT '',     -- 'star', 'pin', 'archive', or color hex
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

-- Legal consent (source of truth for ToS acceptance)
CREATE TABLE IF NOT EXISTS legal_consent (
    id INTEGER PRIMARY KEY,
    tos_version TEXT NOT NULL,
    accepted_at TEXT NOT NULL
);
```

Smart folder `rules_json` schema:

```json
{
  "match": "all",
  "rules": [
    { "field": "item_type", "op": "eq", "value": "clip" },
    { "field": "created_at", "op": "within", "value": "7d" },
    { "field": "tags", "op": "contains", "value": "work" },
    { "field": "flag", "op": "eq", "value": "star" }
  ]
}
```

Fields: `item_type`, `tags`, `flag`, `collection_id`, `created_at`, `source_type` (for clips).
Operators: `eq`, `neq`, `contains`, `within` (time period: `7d`, `30d`, `90d`).
Match: `all` (AND) or `any` (OR).

### 8.5 New Settings Fields

```
license_key: Option<String>
pro_since: Option<String>
gallery_view: String  -- 'grid' or 'list'
```

Note: ToS acceptance is tracked in the `legal_consent` table (not in settings) because it needs to store the version agreed to and support re-consent if the ToS version changes. The app checks `legal_consent` on startup — if no row exists or the latest `tos_version` is older than the current version, the welcome/consent screen is shown.

### 8.6 Multi-Threaded Downloads

Multi-threaded downloads are already partially implemented in `wget.rs`:
- `check_range_support(url)` — HEAD request checking `Accept-Ranges` header and `Content-Length`
- `download_chunk(url, start, end, output_path)` — wget with `--header "Range: bytes=start-end"`
- `concatenate_chunks(chunk_paths, output_path)` — merges chunks and cleans up temp files

For Pro gating: the `download_file` command checks `is_pro(&settings)`. If Pro, it calls `check_range_support()` first — if the server supports ranges, it splits into N chunks (default 4, configurable) and downloads in parallel via `tokio::spawn`. If not Pro or server does not support ranges, it falls back to single-thread wget.

This is a Rust-orchestrated approach using wget as the download backend for each chunk. No dependency on aria2 or other external tools.

### 8.7 Existing Features — Gating Decisions

Features already implemented that are not explicitly in the free/pro tables:

| Feature | Tier | Rationale |
|---|---|---|
| Obsidian vault export | Free | Part of the clipper hook — keeps users engaged |
| NotebookLM export (single) | Free | Single export is a taste of the feature |
| NotebookLM export (batch) | Pro | Batch operations are Pro |
| Transcript structuring | Free | AI features stay free to hook users |
| Link status checking | Free | Utility feature, low upgrade value |
| Weekly digest generation | Free | AI feature, keeps users coming back |

### 8.8 Scheduling — Status Note

Download scheduling and site change monitoring are already implemented in the codebase (`scheduler.rs`, `monitor.rs`, `schedules` and `monitors` tables). The original v1 design spec deferred these to v2 — they were built during the v2 features phase. This Pro spec gates them behind Pro, which is their shipping state. The original spec should be considered superseded for scheduling-related sections.
