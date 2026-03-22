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
