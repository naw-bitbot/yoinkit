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

  const updateTags = async (id: string, tags: string[]) => {
    await api.updateClipTags(id, tags);
    setClips(prev => prev.map(c => c.id === id ? { ...c, tags: JSON.stringify(tags) } : c));
  };

  const exportToVault = async (id: string, vaultPath: string, attachmentsFolder: string) => {
    return api.exportClipToVault(id, vaultPath, attachmentsFolder);
  };

  return { clips, loading, clipUrl, deleteClip, updateTags, exportToVault, refresh: fetchClips };
}
