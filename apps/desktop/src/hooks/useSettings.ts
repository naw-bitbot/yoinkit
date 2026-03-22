import { useState, useEffect, useCallback } from "react";
import { api, AppSettings } from "../lib/tauri";

const DEFAULT_SETTINGS: AppSettings = {
  default_save_path: "~/Downloads/Yoinkit",
  one_click_mode: "current_page",
  max_concurrent: 3,
  pro_unlocked: false,
  bandwidth_limit: 0,
  license_key: "",
  pro_since: "",
  gallery_view: "grid",
} as AppSettings;

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const s = await api.getSettings();
      setSettings(s);
    } catch (err) {
      console.error("Failed to fetch settings:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateSettings = useCallback(async (newSettings: Partial<AppSettings>) => {
    const updated = { ...settings, ...newSettings };
    await api.updateSettings(updated);
    setSettings(updated);
  }, [settings]);

  return { settings, loading, updateSettings, refresh };
}
