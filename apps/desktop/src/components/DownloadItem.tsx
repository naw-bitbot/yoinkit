import { Download } from "../lib/tauri";
import { ProgressBar, StatusBadge, Button } from "@yoinkit/ui";

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
    <div className="bg-yoinkit-surface rounded-lg p-4 border border-yoinkit-muted/10">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-yoinkit-text truncate font-medium" title={download.url}>
            {urlDisplay}
          </p>
          <p className="text-xs text-yoinkit-muted mt-0.5 truncate">
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
        <p className="mt-2 text-xs text-yoinkit-danger">{download.error}</p>
      )}

      <div className="flex gap-2 mt-3">
        {download.status === "downloading" && (
          <Button variant="secondary" size="sm" onClick={() => onPause(download.id)}>
            Pause
          </Button>
        )}
        {download.status === "paused" && (
          <Button variant="primary" size="sm" onClick={() => onResume(download.id)}>
            Resume
          </Button>
        )}
        {isActive && (
          <Button variant="danger" size="sm" onClick={() => onCancel(download.id)}>
            Cancel
          </Button>
        )}
        {isFinished && (
          <Button variant="ghost" size="sm" onClick={() => onDelete(download.id)}>
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}
