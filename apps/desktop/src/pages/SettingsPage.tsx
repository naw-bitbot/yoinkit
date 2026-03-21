import { useSettings } from "../hooks/useSettings";
import { Button } from "@yoinkit/ui";
import { FolderOpen, MousePointer, Layers, Crown, Loader2, Sun, Moon, Monitor } from "lucide-react";
import { useThemeContext } from "../App";

export function SettingsPage() {
  const { settings, loading, updateSettings } = useSettings();
  const { theme, setTheme } = useThemeContext();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={20} strokeWidth={1.5} className="animate-spin" style={{ color: 'var(--text-tertiary)' }} />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-xl">
      <div>
        <h2 className="text-[20px] font-bold tracking-tight" style={{ color: 'var(--text)' }}>Settings</h2>
        <p className="text-[13px] mt-1" style={{ color: 'var(--text-secondary)' }}>Configure Yoinkit to your liking.</p>
      </div>

      <div className="space-y-6">
        {/* Appearance */}
        <div>
          <h3 className="text-[11px] font-medium uppercase tracking-wide mb-2 px-1" style={{ color: 'var(--text-tertiary)' }}>Appearance</h3>
          <div className="glass rounded-[10px] p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[13px]" style={{ color: 'var(--text)' }}>Theme</span>
            <div className="apple-pill flex">
              {[
                { value: "light" as const, icon: Sun, label: "Light" },
                { value: "system" as const, icon: Monitor, label: "Auto" },
                { value: "dark" as const, icon: Moon, label: "Dark" },
              ].map(({ value, icon: TIcon, label }) => (
                <button key={value} onClick={() => setTheme(value)} className={`apple-pill-item flex items-center gap-1.5 ${theme === value ? 'active' : ''}`}>
                  <TIcon size={13} strokeWidth={1.5} />
                  {label}
                </button>
              ))}
            </div>
          </div>
          </div>
        </div>

        {/* General */}
        <div>
          <h3 className="text-[11px] font-medium uppercase tracking-wide mb-2 px-1" style={{ color: 'var(--text-tertiary)' }}>General</h3>
          <div className="glass rounded-[10px] p-4 space-y-3">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-[13px] font-medium" style={{ color: 'var(--text)' }}>
              <FolderOpen size={15} strokeWidth={1.5} style={{ color: 'var(--text-secondary)' }} />
              Save location
            </label>
            <input
              type="text"
              value={settings.default_save_path}
              onChange={(e) => updateSettings({ default_save_path: e.target.value })}
              className="apple-input w-full px-3.5 h-[30px] text-[13px]"
            />
            <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>Default directory for downloaded files</p>
          </div>

          <div className="pt-2" style={{ borderTop: '0.5px solid var(--separator)' }}>
            <label className="flex items-center gap-2 text-[13px] font-medium mb-3" style={{ color: 'var(--text)' }}>
              <MousePointer size={15} strokeWidth={1.5} style={{ color: 'var(--text-secondary)' }} />
              Extension one-click behavior
            </label>
            <div className="space-y-2 pl-6">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="radio" name="one_click_mode" value="current_page" checked={settings.one_click_mode === "current_page"} onChange={() => updateSettings({ one_click_mode: "current_page" })} />
                <span className="text-[13px]" style={{ color: 'var(--text)' }}>Download current page only</span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="radio" name="one_click_mode" value="whole_site" checked={settings.one_click_mode === "whole_site"} onChange={() => updateSettings({ one_click_mode: "whole_site" })} />
                <span className="text-[13px]" style={{ color: 'var(--text)' }}>Download whole site (recursive mirror)</span>
              </label>
            </div>
          </div>

          <div className="pt-2" style={{ borderTop: '0.5px solid var(--separator)' }}>
            <label className="flex items-center gap-2 text-[13px] font-medium" style={{ color: 'var(--text)' }}>
              <Layers size={15} strokeWidth={1.5} style={{ color: 'var(--text-secondary)' }} />
              Max concurrent downloads
            </label>
            <input
              type="number" min={1} max={10}
              value={settings.max_concurrent}
              onChange={(e) => updateSettings({ max_concurrent: parseInt(e.target.value) || 3 })}
              className="apple-input w-20 px-3 h-[30px] text-[13px] tabular-nums mt-2"
            />
          </div>
          </div>
        </div>

        {/* Pro */}
        <div>
          <h3 className="text-[11px] font-medium uppercase tracking-wide mb-2 px-1" style={{ color: 'var(--text-tertiary)' }}>Plan</h3>
          <div className="glass rounded-[10px] p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
              <Crown size={18} strokeWidth={1.5} className="mt-0.5" style={{ color: settings.pro_unlocked ? 'var(--accent)' : 'var(--text-tertiary)' }} />
              <div>
                <p className="text-[13px] font-medium" style={{ color: 'var(--text)' }}>
                  {settings.pro_unlocked ? "Pro Unlocked" : "Free Plan"}
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                  {settings.pro_unlocked ? "You have access to all Pro features" : "Upgrade for command builder, presets, and batch downloads"}
                </p>
              </div>
            </div>
            {!settings.pro_unlocked && <Button size="sm">Upgrade</Button>}
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
