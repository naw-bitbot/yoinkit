import { useState } from "react";
import { Download } from "../lib/tauri";
import { ProgressBar, StatusBadge, Button } from "@yoinkit/ui";
import { Pause, Play, X, Trash2, Share2 } from "lucide-react";
import { YoinkReceipt } from "./YoinkReceipt";

interface DownloadItemProps {
  download: Download;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
}

function formatFileSize(bytes: number | null): string | undefined {
  if (bytes == null) return undefined;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return isoString;
  }
}

function inferFileType(savePath: string): string | undefined {
  const ext = savePath.split(".").pop()?.toLowerCase();
  if (!ext) return undefined;
  const imageExts = ["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "tiff"];
  const videoExts = ["mp4", "mov", "avi", "mkv", "webm", "flv", "m4v"];
  const audioExts = ["mp3", "wav", "flac", "aac", "ogg", "m4a", "opus"];
  const archiveExts = ["zip", "tar", "gz", "rar", "7z", "bz2", "xz"];
  const codeExts = ["html", "htm", "css", "js", "ts", "jsx", "tsx", "json", "xml", "yaml", "yml", "py", "rb", "go", "rs", "c", "cpp", "h"];
  const textExts = ["pdf", "doc", "docx", "txt", "md", "rtf", "odt"];
  if (imageExts.includes(ext)) return "image";
  if (videoExts.includes(ext)) return "video";
  if (audioExts.includes(ext)) return "audio";
  if (archiveExts.includes(ext)) return "archive";
  if (codeExts.includes(ext)) return "code";
  if (textExts.includes(ext)) return "text";
  return ext;
}

function getTitle(download: Download): string {
  // Try to derive a nice title from save_path filename
  const parts = download.save_path.replace(/\\/g, "/").split("/");
  const filename = parts[parts.length - 1];
  if (filename) return filename;
  // Fallback to URL
  try {
    const url = new URL(download.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    return pathParts[pathParts.length - 1] || url.hostname;
  } catch {
    return download.url;
  }
}

export function DownloadItem({ download, onPause, onResume, onCancel, onDelete }: DownloadItemProps) {
  const [showReceipt, setShowReceipt] = useState(false);

  const urlDisplay = (() => {
    try {
      const url = new URL(download.url);
      return url.hostname + url.pathname;
    } catch {
      return download.url;
    }
  })();

  const isActive = download.status === "downloading" || download.status === "paused";
  const isFinished = download.status === "completed" || download.status === "failed" || download.status === "cancelled";

  const receiptTitle = getTitle(download);
  const receiptFileSize = formatFileSize(download.file_size);
  const receiptDate = formatDate(download.completed_at ?? download.created_at);
  const receiptFileType = inferFileType(download.save_path);

  return (
    <>
      <div className="glass rounded-[10px] p-4 transition-all duration-200 hover:shadow-apple-md">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium truncate" style={{ color: 'var(--text)' }} title={download.url}>
              {urlDisplay}
            </p>
            <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--text-tertiary)' }}>
              {download.save_path}
            </p>
          </div>
          <StatusBadge status={download.status} />
        </div>

        {download.status === "downloading" && (
          <div className="mt-3">
            <ProgressBar
              progress={download.progress}
              speed={download.speed || undefined}
              eta={download.eta || undefined}
            />
          </div>
        )}

        {download.error && (
          <p className="mt-2 text-[11px]" style={{ color: 'var(--danger)' }}>{download.error}</p>
        )}

        <div className="flex gap-1 mt-3">
          {download.status === "downloading" && (
            <Button variant="tinted" size="sm" onClick={() => onPause(download.id)}>
              <Pause size={12} strokeWidth={1.5} />
              Pause
            </Button>
          )}
          {download.status === "paused" && (
            <Button variant="tinted" size="sm" onClick={() => onResume(download.id)}>
              <Play size={12} strokeWidth={1.5} />
              Resume
            </Button>
          )}
          {isActive && (
            <Button variant="ghost" size="sm" onClick={() => onCancel(download.id)} style={{ color: 'var(--danger)' }}>
              <X size={12} strokeWidth={1.5} />
              Cancel
            </Button>
          )}
          {isFinished && (
            <Button variant="ghost" size="sm" onClick={() => onDelete(download.id)}>
              <Trash2 size={12} strokeWidth={1.5} />
              Remove
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setShowReceipt(true)}>
            <Share2 size={12} strokeWidth={1.5} />
            Share
          </Button>
        </div>
      </div>

      {showReceipt && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0, 0, 0, 0.45)",
            backdropFilter: "blur(4px)",
          }}
          onClick={() => setShowReceipt(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}
          >
            <YoinkReceipt
              title={receiptTitle}
              fileSize={receiptFileSize}
              date={receiptDate}
              sourceUrl={download.url}
              fileType={receiptFileType}
            />
            <p
              style={{
                fontSize: "11px",
                color: "rgba(255,255,255,0.6)",
                margin: 0,
                textAlign: "center",
              }}
            >
              Screenshot this card to share your yoink · Click outside to dismiss
            </p>
          </div>
        </div>
      )}
    </>
  );
}
