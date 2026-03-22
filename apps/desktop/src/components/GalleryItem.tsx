import React from "react";
import { FileText, Download, Archive, Image, Film, Music, Star, Pin, ExternalLink } from "lucide-react";
import type { GalleryItem as GalleryItemType } from "../lib/tauri";

const TYPE_ICONS: Record<string, React.ComponentType<any>> = {
  download: Download,
  article: FileText,
  page: FileText,
  archive: Archive,
  image: Image,
  video: Film,
  audio: Music,
};

const FLAG_ICONS: Record<string, React.ComponentType<any>> = {
  star: Star,
  pin: Pin,
};

interface GalleryItemProps {
  item: GalleryItemType;
  view: "grid" | "list";
}

export function GalleryItemCard({ item, view }: GalleryItemProps) {
  const Icon = TYPE_ICONS[item.source_type] || Download;
  const FlagIcon = FLAG_ICONS[item.flag];
  const date = new Date(item.created_at).toLocaleDateString();

  if (view === "list") {
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer group">
        <div className="w-9 h-9 rounded-lg bg-[var(--bg)] flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-[var(--text-muted)]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{item.title}</p>
          <p className="text-xs text-[var(--text-muted)] truncate">{item.url}</p>
        </div>
        {FlagIcon && <FlagIcon className="w-3.5 h-3.5 text-[var(--brand)]" />}
        <span className="text-xs text-[var(--text-muted)] shrink-0">{date}</span>
        <ExternalLink className="w-3.5 h-3.5 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer p-4 space-y-2 group">
      <div className="w-10 h-10 rounded-lg bg-[var(--bg)] flex items-center justify-center">
        <Icon className="w-5 h-5 text-[var(--text-muted)]" />
      </div>
      <p className="text-sm font-medium line-clamp-2">{item.title}</p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--text-muted)]">{date}</span>
        {FlagIcon && <FlagIcon className="w-3 h-3 text-[var(--brand)]" />}
      </div>
    </div>
  );
}
