import { useState, useEffect, useCallback } from "react";
import { api, Download, WgetFlags } from "../lib/tauri";

export function useDownloads() {
  const [downloads, setDownloads] = useState<Download[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const list = await api.listDownloads();
      setDownloads(list);
    } catch (err) {
      console.error("Failed to fetch downloads:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 1000); // Poll every second for progress
    return () => clearInterval(interval);
  }, [refresh]);

  const startDownload = useCallback(async (url: string, flags?: WgetFlags, savePath?: string) => {
    const id = await api.startDownload(url, flags, savePath);
    await refresh();
    return id;
  }, [refresh]);

  const pauseDownload = useCallback(async (id: string) => {
    await api.pauseDownload(id);
    await refresh();
  }, [refresh]);

  const resumeDownload = useCallback(async (id: string) => {
    await api.resumeDownload(id);
    await refresh();
  }, [refresh]);

  const cancelDownload = useCallback(async (id: string) => {
    await api.cancelDownload(id);
    await refresh();
  }, [refresh]);

  const deleteDownload = useCallback(async (id: string) => {
    await api.deleteDownload(id);
    await refresh();
  }, [refresh]);

  const startVideoDownload = useCallback(async (url: string, format?: string, quality?: string, audioOnly?: boolean) => {
    await api.startVideoDownload(url, format, quality, audioOnly);
    await refresh();
  }, [refresh]);

  return {
    downloads,
    loading,
    refresh,
    startDownload,
    startVideoDownload,
    pauseDownload,
    resumeDownload,
    cancelDownload,
    deleteDownload,
  };
}
