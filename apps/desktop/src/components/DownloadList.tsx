import { Download } from "../lib/tauri";
import { DownloadItem } from "./DownloadItem";
import { Inbox } from "lucide-react";

interface DownloadListProps {
  downloads: Download[];
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
}

export function DownloadList({ downloads, onPause, onResume, onCancel, onDelete }: DownloadListProps) {
  if (downloads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-yoinkit-text-muted">
        <Inbox size={32} strokeWidth={1.5} />
        <p className="mt-3 text-sm">No downloads yet</p>
        <p className="text-xs text-yoinkit-text-muted/60 mt-1">Paste a URL above to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {downloads.map((dl) => (
        <DownloadItem
          key={dl.id}
          download={dl}
          onPause={onPause}
          onResume={onResume}
          onCancel={onCancel}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
