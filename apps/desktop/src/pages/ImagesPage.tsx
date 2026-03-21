import { useState } from "react";
import { useDownloads } from "../hooks/useDownloads";
import { Button, UrlField } from "@yoinkit/ui";

interface ScrapedImage {
  url: string;
  alt: string | null;
  width: number | null;
  height: number | null;
  file_type: string | null;
}

export function ImagesPage() {
  const { deleteDownload } = useDownloads();
  const [url, setUrl] = useState("");
  const [images, setImages] = useState<ScrapedImage[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [scraping, setScraping] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minWidth, setMinWidth] = useState(100);
  const [filterType, setFilterType] = useState<string>("all");

  const handleScrape = async () => {
    if (!url.trim()) return;
    setScraping(true);
    setError(null);
    setImages([]);
    setSelected(new Set());
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const result = await invoke<ScrapedImage[]>("scrape_images", { url: url.trim() });
      setImages(result);
      // Auto-select all
      setSelected(new Set(result.map(img => img.url)));
    } catch (err: any) {
      setError(typeof err === "string" ? err : err.message || "Failed to scrape images");
    } finally {
      setScraping(false);
    }
  };

  const handleDownload = async () => {
    if (selected.size === 0) return;
    setDownloading(true);
    setError(null);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("download_images", { imageUrls: Array.from(selected) });
      setImages([]);
      setSelected(new Set());
      setUrl("");
    } catch (err: any) {
      setError(typeof err === "string" ? err : err.message || "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  const toggleSelect = (imgUrl: string) => {
    const next = new Set(selected);
    if (next.has(imgUrl)) {
      next.delete(imgUrl);
    } else {
      next.add(imgUrl);
    }
    setSelected(next);
  };

  const selectAll = () => setSelected(new Set(filteredImages.map(img => img.url)));
  const selectNone = () => setSelected(new Set());

  const imageTypes = ["all", ...new Set(images.map(img => img.file_type).filter(Boolean))] as string[];

  const filteredImages = images.filter(img => {
    if (filterType !== "all" && img.file_type !== filterType) return false;
    if (minWidth > 0 && img.width && img.width < minWidth) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-yoinkit-text mb-1">Image Scraper</h2>
        <p className="text-sm text-yoinkit-muted">
          Extract and download all images from any webpage.
        </p>
      </div>

      {/* URL Input */}
      <div className="flex gap-2">
        <div className="flex-1">
          <UrlField
            value={url}
            onChange={setUrl}
            onSubmit={handleScrape}
            placeholder="Paste a webpage URL to find images..."
          />
        </div>
        <Button onClick={handleScrape} loading={scraping}>
          Scan
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Results */}
      {images.length > 0 && (
        <>
          {/* Filters & Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-yoinkit-muted">Type:</span>
                <select
                  value={filterType}
                  onChange={e => setFilterType(e.target.value)}
                  className="bg-yoinkit-surface text-yoinkit-text text-sm rounded px-2 py-1 border border-yoinkit-muted/20"
                >
                  {imageTypes.map(t => (
                    <option key={t} value={t}>{t === "all" ? "All Types" : t}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-yoinkit-muted">Min width:</span>
                <input
                  type="number"
                  value={minWidth}
                  onChange={e => setMinWidth(Number(e.target.value))}
                  className="bg-yoinkit-surface text-yoinkit-text text-sm rounded px-2 py-1 w-20 border border-yoinkit-muted/20"
                />
                <span className="text-xs text-yoinkit-muted">px</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={selectAll} className="text-xs text-yoinkit-primary hover:underline">Select all</button>
              <span className="text-yoinkit-muted">·</span>
              <button onClick={selectNone} className="text-xs text-yoinkit-muted hover:underline">None</button>
              <span className="text-sm text-yoinkit-muted ml-2">
                {selected.size} of {filteredImages.length} selected
              </span>
            </div>
          </div>

          {/* Image Grid */}
          <div className="grid grid-cols-4 gap-3 max-h-96 overflow-y-auto">
            {filteredImages.map((img, i) => (
              <button
                key={i}
                onClick={() => toggleSelect(img.url)}
                className={`relative rounded-lg overflow-hidden border-2 transition-colors ${
                  selected.has(img.url)
                    ? "border-yoinkit-primary"
                    : "border-transparent hover:border-yoinkit-muted/30"
                }`}
              >
                <img
                  src={img.url}
                  alt={img.alt || ""}
                  className="w-full h-28 object-cover bg-yoinkit-surface"
                  loading="lazy"
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
                {selected.has(img.url) && (
                  <div className="absolute top-1 right-1 w-5 h-5 bg-yoinkit-primary rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-0.5">
                  <p className="text-[10px] text-white/80 truncate">
                    {img.file_type || "IMG"} {img.width && img.height ? `${img.width}×${img.height}` : ""}
                  </p>
                </div>
              </button>
            ))}
          </div>

          {/* Download button */}
          <Button
            onClick={handleDownload}
            loading={downloading}
            disabled={selected.size === 0}
            className="w-full"
          >
            Yoink {selected.size} Image{selected.size !== 1 ? "s" : ""}!
          </Button>
        </>
      )}

      {scraping && (
        <div className="text-center py-8">
          <div className="animate-spin h-8 w-8 border-2 border-yoinkit-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-sm text-yoinkit-muted mt-3">Scanning page for images...</p>
        </div>
      )}
    </div>
  );
}
