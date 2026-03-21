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

export const api = {
  startDownload: (url: string, flags?: WgetFlags, savePath?: string) =>
    invoke<string>("start_download", { url, flags, savePath }),

  pauseDownload: (id: string) => invoke<void>("pause_download", { id }),
  resumeDownload: (id: string) => invoke<void>("resume_download", { id }),
  cancelDownload: (id: string) => invoke<void>("cancel_download", { id }),
  getDownload: (id: string) => invoke<Download | null>("get_download", { id }),
  listDownloads: () => invoke<Download[]>("list_downloads"),
  deleteDownload: (id: string) => invoke<void>("delete_download", { id }),

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
};
