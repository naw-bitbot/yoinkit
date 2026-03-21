import { Download } from "../lib/tauri";
import { ProgressBar, StatusBadge, Button } from "@yoinkit/ui";
import { Pause, Play, X, Trash2 } from "lucide-react";

interface DownloadItemProps {
  download: Download;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
}

export function DownloadItem({ download, onPause, onResume, onCancel, onDelete }: DownloadItemProps) {
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

  return (
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
      </div>
    </div>
  );
}
