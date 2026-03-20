import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { UrlField, Button } from "@yoinkit/ui";
import { api } from "../lib/api";
import "./popup.css";

function Popup() {
  const [url, setUrl] = useState("");
  const [connected, setConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    // Check connection to desktop app
    api.health()
      .then(() => setConnected(true))
      .catch(() => setConnected(false));

    // Get current tab URL
    chrome.runtime.sendMessage({ type: "GET_CURRENT_TAB_URL" }, (tabUrl: string) => {
      if (tabUrl && !tabUrl.startsWith("chrome://")) {
        setUrl(tabUrl);
      }
    });
  }, []);

  const handleDownload = async (downloadUrl: string) => {
    if (!downloadUrl.trim()) return;
    setLoading(true);
    setMessage(null);
    try {
      await api.startDownload({ url: downloadUrl.trim() });
      setMessage({ text: "Sent to Yoinkit!", type: "success" });
      setUrl("");
    } catch (err) {
      setMessage({ text: "Failed to send download", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-yoinkit-bg text-yoinkit-text p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold">Yoinkit</h1>
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              connected === true ? "bg-yoinkit-success" : connected === false ? "bg-yoinkit-danger" : "bg-yoinkit-muted"
            }`}
          />
          <span className="text-xs text-yoinkit-muted">
            {connected === true ? "Connected" : connected === false ? "App not running" : "Checking..."}
          </span>
        </div>
      </div>

      {connected === false && (
        <div className="mb-4 p-3 bg-yoinkit-danger/10 border border-yoinkit-danger/20 rounded-lg">
          <p className="text-sm text-yoinkit-danger">Yoinkit desktop app is not running.</p>
          <p className="text-xs text-yoinkit-muted mt-1">Launch the app to start downloading.</p>
        </div>
      )}

      {/* URL Input */}
      <div className="space-y-3">
        <UrlField
          value={url}
          onChange={setUrl}
          onSubmit={handleDownload}
          placeholder="Paste URL to download..."
          disabled={!connected || loading}
        />
        <Button
          onClick={() => handleDownload(url)}
          loading={loading}
          disabled={!connected || !url.trim()}
          className="w-full"
        >
          Yoink!
        </Button>
      </div>

      {/* Status Message */}
      {message && (
        <div className={`mt-3 p-2 rounded text-sm text-center ${
          message.type === "success"
            ? "bg-yoinkit-success/10 text-yoinkit-success"
            : "bg-yoinkit-danger/10 text-yoinkit-danger"
        }`}>
          {message.text}
        </div>
      )}

      {/* Quick Actions */}
      <div className="mt-4 pt-3 border-t border-yoinkit-muted/20">
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={async () => {
            if (!url.trim()) return;
            setLoading(true);
            setMessage(null);
            try {
              await api.startDownload({
                url: url.trim(),
                flags: {
                  recursive: true,
                  convert_links: true,
                  page_requisites: true,
                  no_parent: true
                }
              });
              setMessage({ text: "Site mirror started!", type: "success" });
            } catch {
              setMessage({ text: "Failed to start mirror", type: "error" });
            } finally {
              setLoading(false);
            }
          }}
          disabled={!connected || !url.trim()}
        >
          Download Whole Site (Recursive)
        </Button>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
);
