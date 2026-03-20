import { Download } from "../lib/tauri";
import { DownloadItem } from "./DownloadItem";

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
      <div className="text-center py-12">
        <p className="text-yoinkit-muted text-lg">No downloads yet</p>
        <p className="text-yoinkit-muted/60 text-sm mt-1">Paste a URL above to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
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
