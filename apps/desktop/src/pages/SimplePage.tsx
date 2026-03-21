import { useState } from "react";
import { useDownloads } from "../hooks/useDownloads";
import { UrlInput } from "../components/UrlInput";
import { DownloadList } from "../components/DownloadList";

export function SimplePage() {
  const { downloads, startDownload, pauseDownload, resumeDownload, cancelDownload, deleteDownload } = useDownloads();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (url: string) => {
    setLoading(true);
    try {
      await startDownload(url);
    } catch (err) {
      console.error("Download failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h2 className="text-[20px] font-bold tracking-tight" style={{ color: 'var(--text)' }}>Downloads</h2>
        <p className="text-[13px] mt-1" style={{ color: 'var(--text-secondary)' }}>Paste a URL and yoink it to your Mac.</p>
      </div>

      <UrlInput onSubmit={handleSubmit} loading={loading} />

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
