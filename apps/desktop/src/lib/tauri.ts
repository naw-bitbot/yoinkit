import { invoke } from "@tauri-apps/api/core";

export interface Download {
  id: string;
  url: string;
  status: "queued" | "downloading" | "paused" | "completed" | "failed" | "cancelled";
  progress: number;
  save_path: string;
  flags: string;
  file_size: number | null;
  speed: string | null;
  eta: string | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
  file_hash: string | null;
}

export interface WgetFlags {
  recursive?: boolean;
  depth?: number;
  convert_links?: boolean;
  page_requisites?: boolean;
  no_parent?: boolean;
  accept?: string;
  reject?: string;
  limit_rate?: string;
  wait?: number;
  random_wait?: boolean;
  user?: string;
  password?: string;
  header?: string[];
  continue_download?: boolean;
  mirror?: boolean;
  timestamping?: boolean;
  output_document?: string;
  directory_prefix?: string;
  user_agent?: string;
  no_check_certificate?: boolean;
  timeout?: number;
  tries?: number;
  quiet?: boolean;
}

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
  ai_api_key_configured: boolean;
  ai_model: string;
  clip_on_download: boolean;
  bandwidth_limit: number;
  license_key: string;
  pro_since: string;
  gallery_view: string;
}

export interface Preset {
  id: string;
  name: string;
  flags_json: string;
  created_at: string;
}

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

export interface SearchResult {
  id: string;
  content_type: string;
  title: string;
  snippet: string;
  url: string;
  score: number;
  created_at: string;
}

export interface ChatResponse {
  answer: string;
  source_ids: string[];
}

export interface ChatMessage {
  id: string;
  role: string;
  content: string;
  sources: string;
  created_at: string;
}

export interface Schedule {
  id: string;
  url: string;
  job_type: string;
  cron: string | null;
  flags: string;
  enabled: number;
  last_run: string | null;
  next_run: string | null;
  created_at: string;
}

export interface Monitor {
  id: string;
  url: string;
  last_hash: string | null;
  last_checked: string | null;
  change_detected: number;
  notify: number;
  created_at: string;
}

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

export const api = {
  startDownload: (url: string, flags?: WgetFlags, savePath?: string) =>
    invoke<string>("start_download", { url, flags, savePath }),

  pauseDownload: (id: string) => invoke<void>("pause_download", { id }),
  resumeDownload: (id: string) => invoke<void>("resume_download", { id }),
  cancelDownload: (id: string) => invoke<void>("cancel_download", { id }),
  getDownload: (id: string) => invoke<Download | null>("get_download", { id }),
  listDownloads: () => invoke<Download[]>("list_downloads"),
  deleteDownload: (id: string) => invoke<void>("delete_download", { id }),

  checkDuplicate: (url: string) => invoke<{ id: string; content_type: string; title: string; created_at: string } | null>("check_duplicate", { url }),
  computeFileHash: (filePath: string) => invoke<string>("compute_file_hash", { filePath }),

  getSettings: () => invoke<AppSettings>("get_settings"),
  updateSettings: (newSettings: AppSettings) => invoke<void>("update_settings", { newSettings }),

  savePreset: (name: string, flagsJson: string) => invoke<string>("save_preset", { name, flagsJson }),
  listPresets: () => invoke<Preset[]>("list_presets"),
  deletePreset: (id: string) => invoke<void>("delete_preset", { id }),

  getVideoInfo: (url: string) => invoke<any>("get_video_info", { url }),
  startVideoDownload: (url: string, format?: string, quality?: string, audioOnly?: boolean, savePath?: string, writeSubs?: boolean, subLang?: string, subFormat?: string) =>
    invoke<string>("start_video_download", { url, format, quality, audioOnly: audioOnly || false, savePath, writeSubs, subLang, subFormat }),
  startAudioDownload: (url: string, format?: string, quality?: string, savePath?: string, writeSubs?: boolean, subLang?: string, subFormat?: string) =>
    invoke<string>("start_audio_download", { url, format, quality, savePath, writeSubs, subLang, subFormat }),
  downloadSubtitles: (url: string, subLang?: string, subFormat?: string, autoSubs?: boolean, savePath?: string) =>
    invoke<string>("download_subtitles", { url, subLang, subFormat, autoSubs, savePath }),
  scrapeImages: (url: string) => invoke<any[]>("scrape_images", { url }),
  downloadImages: (imageUrls: string[], savePath?: string) =>
    invoke<string>("download_images", { imageUrls, savePath }),

  clipUrl: (url: string) => invoke<Clip>("clip_url", { url }),
  clipHtml: (html: string, url: string) => invoke<Clip>("clip_html", { html, url }),
  listClips: () => invoke<Clip[]>("list_clips"),
  getClip: (id: string) => invoke<Clip | null>("get_clip", { id }),
  deleteClip: (id: string) => invoke<void>("delete_clip", { id }),
  updateClipTags: (id: string, tags: string[]) => invoke<void>("update_clip_tags", { id, tags }),
  exportClipToVault: (id: string, vaultPath: string, attachmentsFolder: string) =>
    invoke<string>("export_clip_to_vault", { id, vaultPath, attachmentsFolder }),

  archiveUrl: (url: string) => invoke<Clip>("archive_url", { url }),

  checkLinkStatus: (url: string) => invoke<{ url: string; status: number; alive: boolean }>("check_link_status", { url }),
  checkAllArchivedLinks: () => invoke<Array<{ url: string; status: number; alive: boolean }>>("check_all_archived_links"),

  searchYoinks: (query: string, limit?: number) => invoke<SearchResult[]>("search_yoinks", { query, limit }),
  rebuildSearchIndex: () => invoke<void>("rebuild_search_index"),

  aiTagClip: (id: string) => invoke<string[]>("ai_tag_clip", { id }),
  aiSummarizeClip: (id: string) => invoke<string>("ai_summarize_clip", { id }),

  chatAsk: (question: string) => invoke<ChatResponse>("chat_ask", { question }),
  chatHistory: (limit?: number) => invoke<ChatMessage[]>("chat_history", { limit }),
  chatClear: () => invoke<void>("chat_clear"),

  structureTranscript: (transcript: string) => invoke<Clip>("structure_transcript_cmd", { transcript }),

  exportClipNotebooklm: (id: string, exportDir: string) => invoke<string>("export_clip_notebooklm", { id, exportDir }),
  exportBatchNotebooklm: (ids: string[], exportDir: string, batchName: string) => invoke<string>("export_batch_notebooklm", { ids, exportDir, batchName }),

  createSchedule: (url: string, jobType: string, cron: string, flags?: string) => invoke<string>("create_schedule", { url, jobType, cron, flags }),
  listSchedules: () => invoke<Schedule[]>("list_schedules"),
  deleteSchedule: (id: string) => invoke<void>("delete_schedule", { id }),
  toggleSchedule: (id: string, enabled: boolean) => invoke<void>("toggle_schedule", { id, enabled }),

  createMonitor: (url: string) => invoke<string>("create_monitor", { url }),
  listMonitors: () => invoke<Monitor[]>("list_monitors"),
  deleteMonitor: (id: string) => invoke<void>("delete_monitor", { id }),
  checkMonitor: (id: string) => invoke<boolean>("check_monitor", { id }),
  generateDigest: () => invoke<Clip>("generate_digest"),

  // Gallery
  listGallery: (limit?: number, offset?: number) => invoke<GalleryItem[]>("list_gallery", { limit, offset }),
  galleryCount: () => invoke<number>("gallery_count"),
  updateGalleryItem: (itemId: string, itemType: string, collectionId: string | null, tags: string, flag: string) =>
    invoke<void>("update_gallery_item", { itemId, itemType, collectionId, tags, flag }),

  // Collections
  createCollection: (name: string, color?: string) => invoke<Collection>("create_collection", { name, color }),
  listCollections: () => invoke<Collection[]>("list_collections_cmd"),
  deleteCollection: (id: string) => invoke<void>("delete_collection_cmd", { id }),

  // License
  activateLicense: (licenseKey: string) => invoke<ActivationResult>("activate_license", { licenseKey }),

  // Links / bookmarks
  saveLink: (url: string, notes?: string) => invoke<Clip>("save_link", { url, notes }),

  // Legal
  checkConsent: () => invoke<boolean>("check_consent"),
  acceptConsent: () => invoke<void>("accept_consent"),
};
