import { useState, useEffect } from "react";
import { Info, FileText, Globe, Archive, Video, Music, ImageIcon, File, Link2, Loader2 } from "lucide-react";
import { useDownloads } from "../hooks/useDownloads";
import { usePro } from "../hooks/usePro";
import { UrlInput } from "../components/UrlInput";
import { DownloadList } from "../components/DownloadList";
import { Button } from "@yoinkit/ui";
import { UrlField } from "@yoinkit/ui";
import { api } from "../lib/tauri";

type YoinkType = "page" | "archive" | "video" | "audio" | "images" | "file" | "link";

const YOINK_TYPES: { id: YoinkType; label: string; icon: React.ComponentType<any>; description: string }[] = [
  { id: "page", label: "Page", icon: FileText, description: "Clip webpage to markdown" },
  { id: "archive", label: "Archive", icon: Archive, description: "Full offline copy" },
  { id: "video", label: "Video", icon: Video, description: "Download video" },
  { id: "audio", label: "Audio", icon: Music, description: "Extract audio" },
  { id: "images", label: "Images", icon: ImageIcon, description: "Scrape images" },
  { id: "file", label: "File", icon: File, description: "Download any file" },
  { id: "link", label: "Link", icon: Link2, description: "Save reference only" },
];

function detectType(url: string): YoinkType {
  const lower = url.toLowerCase();
  // Video platforms
  if (lower.includes("youtube.com") || lower.includes("youtu.be") || lower.includes("vimeo.com") || lower.includes("dailymotion.com") || lower.includes("twitch.tv")) return "video";
  // Audio platforms
  if (lower.includes("spotify.com") || lower.includes("soundcloud.com") || lower.includes("bandcamp.com")) return "audio";
  // Academic/DOI
  if (lower.includes("doi.org") || lower.includes("arxiv.org") || lower.includes("scholar.google")) return "link";
  // File extensions
  if (lower.match(/\.(pdf|docx?|xlsx?|pptx?|zip|tar|gz|rar|7z|csv|json|xml)(\?|$)/)) return "file";
  // Image URLs
  if (lower.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)(\?|$)/)) return "images";
  return "page";
}

export function YoinkPage() {
  const { downloads, startDownload, startVideoDownload, pauseDownload, resumeDownload, cancelDownload, deleteDownload } = useDownloads();
  const { isPro } = usePro();
  const [url, setUrl] = useState("");
  const [type, setType] = useState<YoinkType>("page");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoDetected, setAutoDetected] = useState(false);

  // Auto-detect type when URL changes
  useEffect(() => {
    if (url.trim().length > 5 && url.includes(".")) {
      const detected = detectType(url);
      setType(detected);
      setAutoDetected(true);
    }
  }, [url]);

  const handleYoink = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      switch (type) {
        case "page":
          await api.clipUrl(trimmed);
          break;
        case "archive":
          await api.archiveUrl(trimmed);
          break;
        case "video":
          await startVideoDownload(trimmed, undefined, undefined, false);
          break;
        case "audio":
          await startVideoDownload(trimmed, "mp3", "5", true);
          break;
        case "images":
          // For images, we just start a download (user can go to library to see them)
          await startDownload(trimmed);
          break;
        case "file":
          await startDownload(trimmed);
          break;
        case "link":
          await api.saveLink(trimmed);
          break;
      }
      setUrl("");
      setAutoDetected(false);
    } catch (err: any) {
      setError(typeof err === "string" ? err : err.message || "Yoink failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-[20px] font-bold tracking-tight" style={{ color: 'var(--text)' }}>Yoink it</h2>
        <p className="text-[13px] mt-1" style={{ color: 'var(--text-secondary)' }}>Paste a website URL and Yoink it.</p>
      </div>

      {/* URL input + Yoink button */}
      <div className="flex gap-2">
        <UrlField
          value={url}
          onChange={(v) => { setUrl(v); setError(null); }}
          onSubmit={handleYoink}
          placeholder="Paste a URL..."
          className="flex-1"
        />
        <Button onClick={handleYoink} loading={loading} disabled={!url.trim()}>
          Yoink!
        </Button>
      </div>

      {/* Legal line */}
      <p className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
        <Info className="w-3 h-3 shrink-0" />
        Ensure you have permission to index this content.
      </p>

      {/* Type selector */}
      <div>
        <span className="text-[11px] font-medium uppercase tracking-wide block mb-2" style={{ color: 'var(--text-tertiary)' }}>
          Type {autoDetected && <span className="normal-case font-normal">(auto-detected)</span>}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {YOINK_TYPES.map(({ id, label, icon: Icon }) => {
            const active = type === id;
            return (
              <button
                key={id}
                onClick={() => { setType(id); setAutoDetected(false); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] transition-all duration-150"
                style={{
                  background: active ? 'color-mix(in srgb, var(--brand) 15%, transparent)' : 'var(--fill)',
                  color: active ? 'var(--brand)' : 'var(--text-secondary)',
                  border: active ? '0.5px solid color-mix(in srgb, var(--brand) 40%, transparent)' : '0.5px solid var(--border)',
                  fontWeight: active ? 500 : 400,
                }}
              >
                <Icon size={13} strokeWidth={1.5} />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Type description */}
      <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
        {YOINK_TYPES.find(t => t.id === type)?.description}
        {type === "link" && " — no file downloaded, just saves the reference."}
      </p>

      {/* Error */}
      {error && (
        <div className="rounded-[8px] px-4 py-3 text-[13px]" style={{
          background: 'color-mix(in srgb, var(--danger) 10%, transparent)',
          color: 'var(--danger)',
          border: '0.5px solid color-mix(in srgb, var(--danger) 20%, transparent)'
        }}>
          {error}
        </div>
      )}

      {/* Active yoinks */}
      {downloads.length > 0 && (
        <div>
          <h3 className="text-[11px] font-medium uppercase tracking-wide mb-3" style={{ color: 'var(--text-tertiary)' }}>
            Active Yoinks
          </h3>
          <DownloadList
            downloads={downloads}
            onPause={pauseDownload}
            onResume={resumeDownload}
            onCancel={cancelDownload}
            onDelete={deleteDownload}
          />
        </div>
      )}
    </div>
  );
}
