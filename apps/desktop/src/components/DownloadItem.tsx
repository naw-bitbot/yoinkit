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
    <div className="group bg-yoinkit-surface rounded-xl p-4 border border-yoinkit-border hover:border-yoinkit-border/80 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-yoinkit-text truncate" title={download.url}>
            {urlDisplay}
          </p>
          <p className="text-xs text-yoinkit-text-muted mt-1 truncate">
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
        <p className="mt-2 text-xs text-yoinkit-danger/80">{download.error}</p>
      )}

      <div className="flex gap-1.5 mt-3">
        {download.status === "downloading" && (
          <Button variant="ghost" size="sm" onClick={() => onPause(download.id)}>
            <Pause size={13} />
            <span>Pause</span>
          </Button>
        )}
        {download.status === "paused" && (
          <Button variant="ghost" size="sm" onClick={() => onResume(download.id)}>
            <Play size={13} />
            <span>Resume</span>
          </Button>
        )}
        {isActive && (
          <Button variant="danger" size="sm" onClick={() => onCancel(download.id)}>
            <X size={13} />
            <span>Cancel</span>
          </Button>
        )}
        {isFinished && (
          <Button variant="ghost" size="sm" onClick={() => onDelete(download.id)}>
            <Trash2 size={13} />
            <span>Remove</span>
          </Button>
        )}
      </div>
    </div>
  );
}
