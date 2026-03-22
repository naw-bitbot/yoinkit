import React from "react";
import { LayoutGrid, List } from "lucide-react";
import { usePro } from "../hooks/usePro";
import { ProBadge } from "./ProBadge";

interface GalleryToolbarProps {
  view: "grid" | "list";
  onViewChange: (v: "grid" | "list") => void;
  count: number;
  limit: number;
  onNavigatePro: () => void;
}

export function GalleryToolbar({ view, onViewChange, count, limit, onNavigatePro }: GalleryToolbarProps) {
  const { isPro } = usePro();

  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">Gallery</h1>
        {!isPro && count > Math.floor(limit * 0.6) && (
          <span className="text-sm text-[var(--text-muted)]">{count}/{limit}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {!isPro && (
          <button onClick={onNavigatePro} className="text-xs text-[var(--text-muted)] hover:text-[var(--brand)] transition-colors flex items-center gap-1">
            <ProBadge size="sm" /> Collections & filters
          </button>
        )}
        <div className="apple-pill flex">
          <button onClick={() => onViewChange("grid")} className={`apple-pill-item ${view === "grid" ? "active" : ""}`}>
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button onClick={() => onViewChange("list")} className={`apple-pill-item ${view === "list" ? "active" : ""}`}>
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
