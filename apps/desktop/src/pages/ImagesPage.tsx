import { useState } from "react";
import { useDownloads } from "../hooks/useDownloads";
import { Button, UrlField } from "@yoinkit/ui";
import { Search, Check, Loader2 } from "lucide-react";

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
    if (next.has(imgUrl)) next.delete(imgUrl);
    else next.add(imgUrl);
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
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">Images</h2>
        <p className="text-sm text-yoinkit-text-secondary mt-1">
          Extract and download all images from any webpage.
        </p>
      </div>

      {/* URL Input */}
      <div className="flex gap-2">
        <UrlField
          value={url}
          onChange={setUrl}
          onSubmit={handleScrape}
          placeholder="Paste a webpage URL to find images..."
          className="flex-1"
        />
        <Button onClick={handleScrape} loading={scraping}>
          <Search size={14} />
          Scan
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-yoinkit-danger/5 border border-yoinkit-danger/20 text-yoinkit-danger px-4 py-3 rounded-xl text-sm">
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
                <span className="text-xs text-yoinkit-text-muted">Type</span>
                <select
                  value={filterType}
                  onChange={e => setFilterType(e.target.value)}
                  className="bg-yoinkit-bg text-yoinkit-text text-xs rounded-md px-2.5 py-1.5 border border-yoinkit-border focus:outline-none focus:ring-1 focus:ring-yoinkit-accent/40"
                >
                  {imageTypes.map(t => (
                    <option key={t} value={t}>{t === "all" ? "All types" : t}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-yoinkit-text-muted">Min width</span>
                <input
                  type="number"
                  value={minWidth}
                  onChange={e => setMinWidth(Number(e.target.value))}
                  className="bg-yoinkit-bg text-yoinkit-text text-xs rounded-md px-2.5 py-1.5 w-20 border border-yoinkit-border focus:outline-none focus:ring-1 focus:ring-yoinkit-accent/40"
                />
                <span className="text-xs text-yoinkit-text-muted">px</span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <button onClick={selectAll} className="text-yoinkit-accent hover:underline">Select all</button>
              <div className="w-px h-3 bg-yoinkit-border" />
              <button onClick={selectNone} className="text-yoinkit-text-muted hover:underline">None</button>
              <span className="text-yoinkit-text-muted ml-1 tabular-nums">
                {selected.size}/{filteredImages.length}
              </span>
            </div>
          </div>

          {/* Image Grid */}
          <div className="grid grid-cols-4 gap-2 max-h-[400px] overflow-y-auto pr-1">
            {filteredImages.map((img, i) => (
              <button
                key={i}
                onClick={() => toggleSelect(img.url)}
                className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                  selected.has(img.url)
                    ? "border-yoinkit-accent ring-1 ring-yoinkit-accent/30"
                    : "border-transparent hover:border-yoinkit-border"
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
                  <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-yoinkit-accent rounded-full flex items-center justify-center">
                    <Check size={12} className="text-white" />
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1">
                  <p className="text-[10px] text-white/80 truncate tabular-nums">
                    {img.file_type || "IMG"} {img.width && img.height ? `${img.width}x${img.height}` : ""}
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
            Yoink {selected.size} image{selected.size !== 1 ? "s" : ""}
          </Button>
        </>
      )}

      {scraping && (
        <div className="flex flex-col items-center py-12 text-yoinkit-text-muted">
          <Loader2 size={28} className="animate-spin" />
          <p className="text-sm mt-3">Scanning page for images...</p>
        </div>
      )}
    </div>
  );
}
