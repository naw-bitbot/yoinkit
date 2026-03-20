import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { Button } from "@yoinkit/ui";

function Options() {
  const [token, setToken] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    chrome.storage.local.get("auth_token", (result) => {
      if (result.auth_token) setToken(result.auth_token);
    });
  }, []);

  const handleSave = () => {
    chrome.storage.local.set({ auth_token: token }, () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  };

  return (
    <div className="max-w-lg mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Yoinkit Extension Settings</h1>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Auth Token</label>
          <p className="text-xs text-gray-500 mb-2">
            Find this in the Yoinkit desktop app under Settings → Extension Token
          </p>
          <input
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Paste your auth token here"
            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={handleSave}>Save</Button>
          {saved && <span className="text-sm text-green-600">Saved!</span>}
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Options />
  </React.StrictMode>
);
