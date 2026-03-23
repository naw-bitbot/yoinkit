import React, { useState } from "react";
import { LayoutGrid } from "lucide-react";
import { useGallery } from "../hooks/useGallery";
import { usePro } from "../hooks/usePro";
import { useSettings } from "../hooks/useSettings";
import { GalleryItemCard } from "../components/GalleryItem";
import { GalleryToolbar } from "../components/GalleryToolbar";

const FREE_LIMIT = 50;

interface GalleryPageProps {
  onNavigate?: (page: string) => void;
}

export function GalleryPage({ onNavigate }: GalleryPageProps) {
  const { items, count, loading, loadMore } = useGallery();
  const { isPro } = usePro();
  const { settings, updateSettings } = useSettings();
  const [view, setView] = useState<"grid" | "list">((settings?.gallery_view as "grid" | "list") || "grid");

  const handleViewChange = (v: "grid" | "list") => {
    setView(v);
    if (settings) {
      updateSettings({ ...settings, gallery_view: v });
    }
  };

  const displayItems = isPro ? items : items.slice(0, FREE_LIMIT);
  const isFull = !isPro && count >= FREE_LIMIT;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-[var(--brand)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <GalleryToolbar
        view={view}
        onViewChange={handleViewChange}
        count={count}
        limit={FREE_LIMIT}
        onNavigatePro={() => onNavigate?.("pro")}
      />

      {isFull && (
        <div className="mb-4 p-3 rounded-xl bg-[color-mix(in_srgb,var(--brand)_10%,transparent)] text-sm flex items-center justify-between">
          <span>Library full · {count}/{FREE_LIMIT} items · Upgrade for unlimited + collections</span>
          <button onClick={() => onNavigate?.("pro")} className="text-[var(--brand)] font-medium hover:underline">
            Upgrade
          </button>
        </div>
      )}

      {displayItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-3">
          <LayoutGrid className="w-12 h-12 text-[var(--text-muted)]" />
          <h2 className="text-lg font-semibold text-[var(--text-secondary)]">Your library is empty</h2>
          <p className="text-sm text-[var(--text-muted)]">Yoink something to see it indexed here</p>
        </div>
      ) : (
        <>
          <div className={view === "grid"
            ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3"
            : "space-y-2"
          }>
            {displayItems.map((item) => (
              <GalleryItemCard key={`${item.item_type}-${item.item_id}`} item={item} view={view} />
            ))}
          </div>
          {isPro && items.length < count && (
            <button onClick={loadMore} className="mt-4 w-full py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
              Load more
            </button>
          )}
        </>
      )}
    </div>
  );
}
