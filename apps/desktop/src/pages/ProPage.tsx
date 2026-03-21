import { useState } from "react";
import { useDownloads } from "../hooks/useDownloads";
import { useSettings } from "../hooks/useSettings";
import { WgetFlags } from "../lib/tauri";
import { UrlField, Button } from "@yoinkit/ui";
import { CommandBuilder } from "../components/CommandBuilder";
import { CommandPreview } from "../components/CommandPreview";
import { PresetManager } from "../components/PresetManager";
import { BatchInput } from "../components/BatchInput";
import { DownloadList } from "../components/DownloadList";
import { Lock, Crown } from "lucide-react";

type ProTab = "single" | "batch";

export function ProPage() {
  const { downloads, startDownload, pauseDownload, resumeDownload, cancelDownload, deleteDownload } = useDownloads();
  const { settings } = useSettings();
  const [url, setUrl] = useState("");
  const [flags, setFlags] = useState<WgetFlags>({});
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<ProTab>("single");

  if (!settings.pro_unlocked) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-5">
        <div className="w-[56px] h-[56px] rounded-[12px] flex items-center justify-center glass" style={{ border: '0.5px solid var(--border-strong)' }}>
          <Lock size={22} strokeWidth={1.5} style={{ color: 'var(--text-tertiary)' }} />
        </div>
        <div className="text-center">
          <h2 className="text-[20px] font-bold" style={{ color: 'var(--text)' }}>Pro Mode</h2>
          <p className="text-[13px] mt-2 max-w-sm" style={{ color: 'var(--text-secondary)' }}>
            Unlock the full power of Wget with the visual command builder, presets, batch downloads, and more.
          </p>
        </div>
        <Button size="lg">
          <Crown size={16} strokeWidth={1.5} />
          Upgrade to Pro
        </Button>
      </div>
    );
  }

  const handleSingleDownload = async () => {
    if (!url.trim()) return;
    setLoading(true);
    try { await startDownload(url.trim(), flags); setUrl(""); }
    catch (err) { console.error("Download failed:", err); }
    finally { setLoading(false); }
  };

  const handleBatchDownload = async (urls: string[]) => {
    setLoading(true);
    try { for (const u of urls) await startDownload(u, flags); }
    catch (err) { console.error("Batch download failed:", err); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[20px] font-bold tracking-tight" style={{ color: 'var(--text)' }}>Pro</h2>
          <p className="text-[13px] mt-1" style={{ color: 'var(--text-secondary)' }}>Full Wget command builder</p>
        </div>
        <div className="apple-pill flex">
          <button onClick={() => setTab("single")} className={`apple-pill-item ${tab === "single" ? 'active' : ''}`}>Single</button>
          <button onClick={() => setTab("batch")} className={`apple-pill-item ${tab === "batch" ? 'active' : ''}`}>Batch</button>
        </div>
      </div>

      {tab === "single" ? (
        <div className="flex gap-2">
          <UrlField value={url} onChange={setUrl} onSubmit={handleSingleDownload} className="flex-1" />
          <Button onClick={handleSingleDownload} loading={loading} disabled={!url.trim()} size="lg">Yoink!</Button>
        </div>
      ) : (
        <BatchInput onSubmit={handleBatchDownload} loading={loading} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <CommandBuilder flags={flags} onChange={setFlags} />
          <CommandPreview url={url} flags={flags} savePath={settings.default_save_path} />
        </div>
        <div><PresetManager currentFlags={flags} onLoadPreset={setFlags} /></div>
      </div>

      <DownloadList downloads={downloads} onPause={pauseDownload} onResume={resumeDownload} onCancel={cancelDownload} onDelete={deleteDownload} />
    </div>
  );
}
