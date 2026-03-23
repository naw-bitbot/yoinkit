import { useState } from "react";
import { useSettings } from "../hooks/useSettings";
import { Button } from "@yoinkit/ui";
import { FolderOpen, MousePointer, Layers, Crown, Loader2, Sun, Moon, Monitor, NotebookPen, Brain, KeyRound, Link, Gauge, CheckCircle2 } from "lucide-react";
import { useThemeContext } from "../App";

const AI_PROVIDER_DEFAULTS: Record<string, string> = {
  claude: "claude-sonnet-4-6",
  openai: "gpt-4o",
  ollama: "llama3.2",
  none: "",
};

export function SettingsPage() {
  const { settings, loading, updateSettings } = useSettings();
  const { theme, setTheme } = useThemeContext();
  const [apiKeyInput, setApiKeyInput] = useState("");

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
              Max concurrent yoinks
            </label>
            <input
              type="number" min={1} max={10}
              value={settings.max_concurrent}
              onChange={(e) => updateSettings({ max_concurrent: parseInt(e.target.value) || 3 })}
              className="apple-input w-20 px-3 h-[30px] text-[13px] tabular-nums mt-2"
            />
          </div>

          <div className="pt-2" style={{ borderTop: '0.5px solid var(--separator)' }}>
            <label className="flex items-center gap-2 text-[13px] font-medium" style={{ color: 'var(--text)' }}>
              <Gauge size={15} strokeWidth={1.5} style={{ color: 'var(--text-secondary)' }} />
              Bandwidth limit
            </label>
            <div className="flex items-center gap-2 mt-2">
              <input
                type="number"
                min={0}
                value={settings.bandwidth_limit || 0}
                onChange={(e) => updateSettings({ bandwidth_limit: parseInt(e.target.value) || 0 })}
                className="apple-input w-24 px-3 h-[30px] text-[13px] tabular-nums"
              />
              <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>KB/s (0 = unlimited)</span>
            </div>
          </div>
          </div>
        </div>

        {/* Video */}
        <div>
          <h3 className="text-[11px] font-medium uppercase tracking-wide mb-2 px-1" style={{ color: 'var(--text-tertiary)' }}>Video</h3>
          <div className="glass rounded-[10px] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px]" style={{ color: 'var(--text)' }}>Default quality</span>
              <div className="apple-pill flex">
                {["4k", "1080p", "720p", "480p", "360p"].map(q => {
                  const locked = !settings.pro_unlocked && (q === "4k" || q === "1080p");
                  return (
                    <button key={q} onClick={() => !locked && updateSettings({ ...settings, video_quality: q } as any)} disabled={locked} className={`apple-pill-item ${(settings as any).video_quality === q || (!(settings as any).video_quality && q === "720p") ? 'active' : ''} ${locked ? 'opacity-40 cursor-not-allowed' : ''}`}>
                      {q}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Audio */}
        <div>
          <h3 className="text-[11px] font-medium uppercase tracking-wide mb-2 px-1" style={{ color: 'var(--text-tertiary)' }}>Audio</h3>
          <div className="glass rounded-[10px] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px]" style={{ color: 'var(--text)' }}>Default format</span>
              <div className="apple-pill flex">
                {["mp3", "aac", "flac", "wav", "opus"].map(f => {
                  const locked = !settings.pro_unlocked && f !== "mp3";
                  return (
                    <button key={f} onClick={() => !locked && updateSettings({ ...settings, audio_format: f } as any)} disabled={locked} className={`apple-pill-item uppercase ${(settings as any).audio_format === f || (!(settings as any).audio_format && f === "mp3") ? 'active' : ''} ${locked ? 'opacity-40 cursor-not-allowed' : ''}`}>
                      {f}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center justify-between pt-2" style={{ borderTop: '0.5px solid var(--separator)' }}>
              <span className="text-[13px]" style={{ color: 'var(--text)' }}>Default quality</span>
              <div className="apple-pill flex">
                {[{ label: "320k", value: "0" }, { label: "192k", value: "5" }, { label: "128k", value: "8" }].map(q => {
                  const locked = !settings.pro_unlocked && q.value === "0";
                  return (
                    <button key={q.value} onClick={() => !locked && updateSettings({ ...settings, audio_quality: q.value } as any)} disabled={locked} className={`apple-pill-item ${(settings as any).audio_quality === q.value || (!(settings as any).audio_quality && q.value === "5") ? 'active' : ''} ${locked ? 'opacity-40 cursor-not-allowed' : ''}`}>
                      {q.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Obsidian & Clipper */}
        <div>
          <h3 className="text-[11px] font-medium uppercase tracking-wide mb-2 px-1" style={{ color: 'var(--text-tertiary)' }}>Obsidian &amp; Clipper</h3>
          <div className="glass rounded-[10px] p-4 space-y-3">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[13px] font-medium" style={{ color: 'var(--text)' }}>
                <NotebookPen size={15} strokeWidth={1.5} style={{ color: 'var(--text-secondary)' }} />
                Obsidian vault path
              </label>
              <input
                type="text"
                value={settings.obsidian_vault_path}
                onChange={(e) => updateSettings({ obsidian_vault_path: e.target.value })}
                className="apple-input w-full px-3.5 h-[30px] text-[13px]"
              />
              <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>Path to your Obsidian vault folder</p>
            </div>

            <div className="space-y-2 pt-2" style={{ borderTop: '0.5px solid var(--separator)' }}>
              <label className="flex items-center gap-2 text-[13px] font-medium" style={{ color: 'var(--text)' }}>
                <FolderOpen size={15} strokeWidth={1.5} style={{ color: 'var(--text-secondary)' }} />
                Attachments subfolder
              </label>
              <input
                type="text"
                value={settings.obsidian_attachments_folder}
                onChange={(e) => updateSettings({ obsidian_attachments_folder: e.target.value })}
                placeholder="assets/yoinkit"
                className="apple-input w-full px-3.5 h-[30px] text-[13px]"
              />
              <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>Where images and attachments are stored within the vault</p>
            </div>

            <div className="pt-2" style={{ borderTop: '0.5px solid var(--separator)' }}>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.clip_on_download}
                  onChange={(e) => updateSettings({ clip_on_download: e.target.checked })}
                />
                <span className="text-[13px]" style={{ color: 'var(--text)' }}>Auto-clip on download</span>
              </label>
              <p className="text-[11px] mt-1 pl-6" style={{ color: 'var(--text-tertiary)' }}>Automatically create a clip note when a download completes</p>
            </div>

            <div className="space-y-2 pt-2" style={{ borderTop: '0.5px solid var(--separator)' }}>
              <label className="flex items-center gap-2 text-[13px] font-medium" style={{ color: 'var(--text)' }}>
                <Brain size={15} strokeWidth={1.5} style={{ color: 'var(--text-secondary)' }} />
                AI Provider
              </label>
              <div className="apple-pill flex">
                {[
                  { value: "none", label: "None" },
                  { value: "ollama", label: "Ollama" },
                  { value: "claude", label: "Claude" },
                  { value: "openai", label: "OpenAI" },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => {
                      const defaultModel = AI_PROVIDER_DEFAULTS[value] ?? "";
                      updateSettings({
                        ai_provider: value,
                        ai_model: defaultModel,
                      });
                    }}
                    className={`apple-pill-item flex-1 flex items-center justify-center py-1.5 text-[11px] ${settings.ai_provider === value ? "active" : ""}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>AI provider used for auto-tagging and summarisation</p>
            </div>

            {(settings.ai_provider === "claude" || settings.ai_provider === "openai") && (
              <div className="space-y-2 pt-2" style={{ borderTop: '0.5px solid var(--separator)' }}>
                <label className="flex items-center gap-2 text-[13px] font-medium" style={{ color: 'var(--text)' }}>
                  <KeyRound size={15} strokeWidth={1.5} style={{ color: 'var(--text-secondary)' }} />
                  API Key
                </label>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => {
                    setApiKeyInput(e.target.value);
                    if (e.target.value.length > 0) {
                      updateSettings({ ai_api_key_configured: true });
                    } else {
                      updateSettings({ ai_api_key_configured: false });
                    }
                  }}
                  placeholder={settings.ai_api_key_configured ? "••••••••••••••••" : "Enter API key…"}
                  className="apple-input w-full px-3.5 h-[30px] text-[13px]"
                />
                {settings.ai_api_key_configured && apiKeyInput.length === 0 && (
                  <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>API key is configured. Enter a new value to replace it.</p>
                )}
              </div>
            )}

            {settings.ai_provider === "ollama" && (
              <div className="space-y-2 pt-2" style={{ borderTop: '0.5px solid var(--separator)' }}>
                <label className="flex items-center gap-2 text-[13px] font-medium" style={{ color: 'var(--text)' }}>
                  <Link size={15} strokeWidth={1.5} style={{ color: 'var(--text-secondary)' }} />
                  Ollama Base URL
                </label>
                <input
                  type="text"
                  value={(settings as any).ollama_base_url ?? "http://localhost:11434"}
                  onChange={(e) => updateSettings({ ollama_base_url: e.target.value } as any)}
                  placeholder="http://localhost:11434"
                  className="apple-input w-full px-3.5 h-[30px] text-[13px]"
                />
                <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>URL of your local Ollama instance</p>
              </div>
            )}

            {settings.ai_provider !== "none" && (
              <div className="space-y-2 pt-2" style={{ borderTop: '0.5px solid var(--separator)' }}>
                <label className="flex items-center gap-2 text-[13px] font-medium" style={{ color: 'var(--text)' }}>
                  AI Model
                </label>
                <input
                  type="text"
                  value={settings.ai_model}
                  onChange={(e) => updateSettings({ ai_model: e.target.value })}
                  placeholder={AI_PROVIDER_DEFAULTS[settings.ai_provider] ?? ""}
                  className="apple-input w-full px-3.5 h-[30px] text-[13px]"
                />
                <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                  {settings.ai_provider === "claude" && "e.g. claude-sonnet-4-6, claude-opus-4-5"}
                  {settings.ai_provider === "openai" && "e.g. gpt-4o, gpt-4o-mini"}
                  {settings.ai_provider === "ollama" && "e.g. llama3.2, mistral, gemma3"}
                </p>
              </div>
            )}
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
                  {settings.pro_unlocked ? "You have access to all Pro features" : "Upgrade for command builder, presets, and batch yoinking"}
                </p>
              </div>
            </div>
            {!settings.pro_unlocked && <Button size="sm">Upgrade</Button>}
          </div>
          </div>
        </div>

        {/* Pro License */}
        <div className="glass-card p-5 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Pro License</h3>
          {settings.pro_unlocked ? (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <span className="text-sm">Pro Unlocked</span>
              {settings.pro_since && <span className="text-xs text-[var(--text-muted)]">since {new Date(settings.pro_since).toLocaleDateString()}</span>}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-[var(--text-muted)]">Free Plan</span>
            </div>
          )}
        </div>

        {/* Legal */}
        <div className="glass-card p-5 space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Legal</h3>
          <div className="space-y-2">
            <a href="https://yoinkit.app/terms" target="_blank" className="block text-sm text-[var(--brand)] hover:underline">Terms of Use</a>
            <a href="https://yoinkit.app/privacy" target="_blank" className="block text-sm text-[var(--brand)] hover:underline">Privacy Policy</a>
            <a href="https://yoinkit.app/dmca" target="_blank" className="block text-sm text-[var(--brand)] hover:underline">DMCA Policy</a>
            <p className="text-xs text-[var(--text-muted)]">copyright@yoinkit.app</p>
          </div>
        </div>
      </div>
    </div>
  );
}
