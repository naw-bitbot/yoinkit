import { useSettings } from "../hooks/useSettings";
import { Button } from "@yoinkit/ui";

export function SettingsPage() {
  const { settings, loading, updateSettings } = useSettings();

  if (loading) {
    return <div className="text-yoinkit-muted">Loading settings...</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-semibold text-yoinkit-text mb-1">Settings</h2>
        <p className="text-sm text-yoinkit-muted">Configure Yoinkit to your liking.</p>
      </div>

      <div className="space-y-5">
        {/* Default Save Path */}
        <div>
          <label className="block text-sm font-medium text-yoinkit-text mb-1">
            Default save location
          </label>
          <input
            type="text"
            value={settings.default_save_path}
            onChange={(e) => updateSettings({ default_save_path: e.target.value })}
            className="w-full px-3 py-2 bg-yoinkit-bg border border-yoinkit-muted/30 rounded-lg text-sm text-yoinkit-text focus:outline-none focus:ring-2 focus:ring-yoinkit-primary/50"
          />
          <p className="text-xs text-yoinkit-muted mt-1">Where files are saved by default</p>
        </div>

        {/* One-Click Mode */}
        <div>
          <label className="block text-sm font-medium text-yoinkit-text mb-2">
            Browser extension one-click behavior
          </label>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="one_click_mode"
                value="current_page"
                checked={settings.one_click_mode === "current_page"}
                onChange={() => updateSettings({ one_click_mode: "current_page" })}
                className="text-yoinkit-primary focus:ring-yoinkit-primary/50"
              />
              <span className="text-sm text-yoinkit-text">Download current page only</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="one_click_mode"
                value="whole_site"
                checked={settings.one_click_mode === "whole_site"}
                onChange={() => updateSettings({ one_click_mode: "whole_site" })}
                className="text-yoinkit-primary focus:ring-yoinkit-primary/50"
              />
              <span className="text-sm text-yoinkit-text">Download whole site (recursive mirror)</span>
            </label>
          </div>
        </div>

        {/* Max Concurrent */}
        <div>
          <label className="block text-sm font-medium text-yoinkit-text mb-1">
            Max concurrent downloads
          </label>
          <input
            type="number"
            min={1}
            max={10}
            value={settings.max_concurrent}
            onChange={(e) => updateSettings({ max_concurrent: parseInt(e.target.value) || 3 })}
            className="w-24 px-3 py-2 bg-yoinkit-bg border border-yoinkit-muted/30 rounded-lg text-sm text-yoinkit-text focus:outline-none focus:ring-2 focus:ring-yoinkit-primary/50"
          />
        </div>

        {/* Pro Status */}
        <div className="pt-4 border-t border-yoinkit-muted/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-yoinkit-text">
                {settings.pro_unlocked ? "Pro Unlocked ✓" : "Free Plan"}
              </p>
              <p className="text-xs text-yoinkit-muted mt-0.5">
                {settings.pro_unlocked
                  ? "You have access to all Pro features"
                  : "Upgrade for command builder, presets, and batch downloads"}
              </p>
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
