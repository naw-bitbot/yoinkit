import { useSettings } from "../hooks/useSettings";
import { Button } from "@yoinkit/ui";
import { FolderOpen, MousePointer, Layers, Crown, Loader2 } from "lucide-react";

export function SettingsPage() {
  const { settings, loading, updateSettings } = useSettings();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-yoinkit-text-muted">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-xl">
      <div>
        <h2 className="text-lg font-semibold">Settings</h2>
        <p className="text-sm text-yoinkit-text-secondary mt-1">Configure Yoinkit to your liking.</p>
      </div>

      <div className="space-y-6">
        {/* Default Save Path */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium">
            <FolderOpen size={15} className="text-yoinkit-text-secondary" />
            Save location
          </label>
          <input
            type="text"
            value={settings.default_save_path}
            onChange={(e) => updateSettings({ default_save_path: e.target.value })}
            className="w-full px-3.5 h-10 bg-yoinkit-bg border border-yoinkit-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yoinkit-accent/40 focus:border-yoinkit-accent/40 transition-all"
          />
          <p className="text-xs text-yoinkit-text-muted">Default directory for downloaded files</p>
        </div>

        {/* One-Click Mode */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <MousePointer size={15} className="text-yoinkit-text-secondary" />
            Extension one-click behavior
          </label>
          <div className="space-y-2 pl-6">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="radio"
                name="one_click_mode"
                value="current_page"
                checked={settings.one_click_mode === "current_page"}
                onChange={() => updateSettings({ one_click_mode: "current_page" })}
              />
              <span className="text-sm">Download current page only</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="radio"
                name="one_click_mode"
                value="whole_site"
                checked={settings.one_click_mode === "whole_site"}
                onChange={() => updateSettings({ one_click_mode: "whole_site" })}
              />
              <span className="text-sm">Download whole site (recursive mirror)</span>
            </label>
          </div>
        </div>

        {/* Max Concurrent */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium">
            <Layers size={15} className="text-yoinkit-text-secondary" />
            Max concurrent downloads
          </label>
          <input
            type="number"
            min={1}
            max={10}
            value={settings.max_concurrent}
            onChange={(e) => updateSettings({ max_concurrent: parseInt(e.target.value) || 3 })}
            className="w-20 px-3.5 h-10 bg-yoinkit-bg border border-yoinkit-border rounded-lg text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-yoinkit-accent/40 focus:border-yoinkit-accent/40 transition-all"
          />
        </div>

        {/* Pro Status */}
        <div className="pt-6 border-t border-yoinkit-border">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
              <Crown size={16} className={settings.pro_unlocked ? "text-yoinkit-accent mt-0.5" : "text-yoinkit-text-muted mt-0.5"} />
              <div>
                <p className="text-sm font-medium">
                  {settings.pro_unlocked ? "Pro Unlocked" : "Free Plan"}
                </p>
                <p className="text-xs text-yoinkit-text-muted mt-0.5">
                  {settings.pro_unlocked
                    ? "You have access to all Pro features"
                    : "Upgrade for command builder, presets, and batch downloads"}
                </p>
              </div>
            </div>
            {!settings.pro_unlocked && (
              <Button size="sm">Upgrade</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
