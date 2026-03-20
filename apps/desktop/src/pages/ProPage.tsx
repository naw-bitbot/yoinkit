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
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="text-6xl">🔒</div>
        <h2 className="text-xl font-semibold text-yoinkit-text">Pro Mode</h2>
        <p className="text-yoinkit-muted text-center max-w-md">
          Unlock the full power of Wget with the visual command builder, presets, batch downloads, and more.
        </p>
        <Button size="lg">Upgrade to Pro</Button>
      </div>
    );
  }

  const handleSingleDownload = async () => {
    if (!url.trim()) return;
    setLoading(true);
    try {
      await startDownload(url.trim(), flags);
      setUrl("");
    } catch (err) {
      console.error("Download failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchDownload = async (urls: string[]) => {
    setLoading(true);
    try {
      for (const u of urls) {
        await startDownload(u, flags);
      }
    } catch (err) {
      console.error("Batch download failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-yoinkit-text">Pro Mode</h2>
          <p className="text-sm text-yoinkit-muted">Full Wget command builder</p>
        </div>
        <div className="flex bg-yoinkit-surface rounded-lg p-0.5">
          <button
            onClick={() => setTab("single")}
            className={`px-3 py-1 rounded-md text-sm transition-colors ${
              tab === "single" ? "bg-yoinkit-primary text-white" : "text-yoinkit-muted hover:text-yoinkit-text"
            }`}
          >
            Single
          </button>
          <button
            onClick={() => setTab("batch")}
            className={`px-3 py-1 rounded-md text-sm transition-colors ${
              tab === "batch" ? "bg-yoinkit-primary text-white" : "text-yoinkit-muted hover:text-yoinkit-text"
            }`}
          >
            Batch
          </button>
        </div>
      </div>

      {tab === "single" ? (
        <div className="flex gap-3">
          <UrlField value={url} onChange={setUrl} onSubmit={handleSingleDownload} className="flex-1" />
          <Button onClick={handleSingleDownload} loading={loading} disabled={!url.trim()} size="lg">
            Yoink!
          </Button>
        </div>
      ) : (
        <BatchInput onSubmit={handleBatchDownload} loading={loading} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <CommandBuilder flags={flags} onChange={setFlags} />
          <CommandPreview url={url} flags={flags} savePath={settings.default_save_path} />
        </div>
        <div>
          <PresetManager currentFlags={flags} onLoadPreset={setFlags} />
        </div>
      </div>

      <DownloadList
        downloads={downloads}
        onPause={pauseDownload}
        onResume={resumeDownload}
        onCancel={cancelDownload}
        onDelete={deleteDownload}
      />
    </div>
  );
}
