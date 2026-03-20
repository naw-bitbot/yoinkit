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
}

export interface Preset {
  id: string;
  name: string;
  flags_json: string;
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
};
