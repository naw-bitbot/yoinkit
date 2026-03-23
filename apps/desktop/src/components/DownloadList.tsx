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
      <div className="flex flex-col items-center justify-center py-12">
        <Inbox size={28} strokeWidth={1} style={{ color: 'var(--text-tertiary)' }} />
        <p className="mt-2 text-[13px] font-medium" style={{ color: 'var(--text-tertiary)' }}>No yoinks indexed yet</p>
        <p className="text-[11px] mt-1" style={{ color: 'var(--text-tertiary)', opacity: 0.6 }}>Paste a URL above to yoink it</p>
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
