import { useState } from "react";
import { useDownloads } from "../hooks/useDownloads";
import { usePro } from "../hooks/usePro";
import { Button, UrlField } from "@yoinkit/ui";
import { Search, Check, Loader2, Info } from "lucide-react";
import { ProBadge } from "../components/ProBadge";

interface ScrapedImage {
  url: string;
  alt: string | null;
  width: number | null;
  height: number | null;
  file_type: string | null;
}

type SizePreset = "favicon" | "thumbnail" | "small" | "medium" | "large" | "xlarge";

const SIZE_PRESETS: { id: SizePreset; label: string; minWidth: number; pro: boolean }[] = [
  { id: "favicon", label: "Favicon", minWidth: 0, pro: true },
  { id: "thumbnail", label: "Thumbnail", minWidth: 0, pro: true },
  { id: "small", label: "Small", minWidth: 100, pro: false },
  { id: "medium", label: "Medium", minWidth: 300, pro: false },
  { id: "large", label: "Large", minWidth: 600, pro: false },
  { id: "xlarge", label: "XL", minWidth: 1200, pro: true },
];

function getSizeFilter(preset: SizePreset): { minWidth: number; maxWidth: number | null } {
  switch (preset) {
    case "favicon": return { minWidth: 0, maxWidth: 32 };
    case "thumbnail": return { minWidth: 33, maxWidth: 99 };
    case "small": return { minWidth: 100, maxWidth: 299 };
    case "medium": return { minWidth: 300, maxWidth: 599 };
    case "large": return { minWidth: 600, maxWidth: 1199 };
    case "xlarge": return { minWidth: 1200, maxWidth: null };
  }
}

export function ImagesPage() {
  const { deleteDownload } = useDownloads();
  const { isPro } = usePro();
  const [url, setUrl] = useState("");
  const [images, setImages] = useState<ScrapedImage[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [scraping, setScraping] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sizePreset, setSizePreset] = useState<SizePreset>("medium");
  const [filterType, setFilterType] = useState<string>("all");

  const handleScrape = async () => {
    if (!url.trim()) return;
    setScraping(true); setError(null); setImages([]); setSelected(new Set());
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const result = await invoke<ScrapedImage[]>("scrape_images", { url: url.trim() });
      setImages(result);
      setSelected(new Set(result.map(img => img.url)));
    } catch (err: any) {
      setError(typeof err === "string" ? err : err.message || "Failed to scan images");
    } finally { setScraping(false); }
  };

  const handleDownload = async () => {
    if (selected.size === 0) return;
    setDownloading(true); setError(null);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("download_images", { imageUrls: Array.from(selected) });
      setImages([]); setSelected(new Set()); setUrl("");
    } catch (err: any) {
      setError(typeof err === "string" ? err : err.message || "Yoink failed");
    } finally { setDownloading(false); }
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

  const { minWidth, maxWidth } = getSizeFilter(sizePreset);

  const filteredImages = images.filter(img => {
    if (filterType !== "all" && img.file_type !== filterType) return false;
    if (img.width) {
      if (img.width < minWidth) return false;
      if (maxWidth !== null && img.width > maxWidth) return false;
    }
    return true;
  });

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h2 className="text-[20px] font-bold tracking-tight" style={{ color: 'var(--text)' }}>Images</h2>
        <p className="text-[13px] mt-1" style={{ color: 'var(--text-secondary)' }}>Scan and yoink images from any webpage.</p>
      </div>

      <div className="flex gap-2">
        <UrlField value={url} onChange={setUrl} onSubmit={handleScrape} placeholder="Paste a webpage URL to scan for images..." className="flex-1" />
        <Button onClick={handleScrape} loading={scraping}>
          <Search size={15} strokeWidth={1.5} />
          Scan
        </Button>
      </div>

      <p className="text-xs text-[var(--text-muted)] flex items-center gap-1">
        <Info className="w-3 h-3" />
        Ensure you have permission to index this content.
      </p>

      {/* Size preset — Apple segmented control */}
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Size</span>
        <div className="apple-pill flex">
          {SIZE_PRESETS.map(s => {
            const locked = s.pro && !isPro;
            return (
              <button
                key={s.id}
                onClick={() => !locked && setSizePreset(s.id)}
                disabled={locked}
                className={`apple-pill-item ${sizePreset === s.id ? 'active' : ''} ${locked ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                {s.label}{locked && <ProBadge />}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="rounded-[8px] px-4 py-3 text-[13px]" style={{ background: 'color-mix(in srgb, var(--danger) 10%, transparent)', color: 'var(--danger)' }}>{error}</div>
      )}

      {images.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>Type</span>
                <select value={filterType} onChange={e => setFilterType(e.target.value)} className="apple-input px-2.5 py-1.5 text-[11px]">
                  {imageTypes.map(t => <option key={t} value={t}>{t === "all" ? "All types" : t}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <button onClick={selectAll} style={{ color: 'var(--accent)' }}>Select all</button>
              <div className="w-px h-3" style={{ background: 'var(--separator)' }} />
              <button onClick={selectNone} style={{ color: 'var(--text-tertiary)' }}>None</button>
              <span className="tabular-nums" style={{ color: 'var(--text-tertiary)' }}>{selected.size}/{filteredImages.length}</span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 max-h-[400px] overflow-y-auto pr-1">
            {filteredImages.map((img, i) => (
              <button key={i} onClick={() => toggleSelect(img.url)}
                className="relative rounded-[10px] overflow-hidden transition-all duration-150"
                style={{
                  border: selected.has(img.url) ? '2px solid var(--accent)' : '2px solid transparent',
                  boxShadow: selected.has(img.url) ? '0 0 0 2px color-mix(in srgb, var(--accent) 20%, transparent)' : 'none',
                }}>
                <img src={img.url} alt={img.alt || ""} className="w-full h-28 object-cover" style={{ background: 'var(--fill)' }} loading="lazy" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                {selected.has(img.url) && (
                  <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'var(--accent)' }}>
                    <Check size={12} className="text-white" strokeWidth={2.5} />
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1">
                  <p className="text-[11px] text-white/80 truncate tabular-nums">{img.file_type || "IMG"} {img.width && img.height ? `${img.width}×${img.height}` : ""}</p>
                </div>
              </button>
            ))}
          </div>

          <Button onClick={handleDownload} loading={downloading} disabled={selected.size === 0} className="w-full" size="lg">
            Yoink {selected.size} image{selected.size !== 1 ? "s" : ""}
          </Button>
        </>
      )}

      {scraping && (
        <div className="flex flex-col items-center py-12">
          <Loader2 size={28} strokeWidth={1.5} className="animate-spin" style={{ color: 'var(--accent)' }} />
          <p className="text-[13px] mt-3" style={{ color: 'var(--text-tertiary)' }}>Scanning page for images...</p>
        </div>
      )}
    </div>
  );
}
