import { useState } from "react";
import { Download, Video, Music, ImageIcon, Zap, Settings, type LucideProps } from "lucide-react";

import { SimplePage } from "./pages/SimplePage";
import { VideoPage } from "./pages/VideoPage";
import { AudioPage } from "./pages/AudioPage";
import { ImagesPage } from "./pages/ImagesPage";
import { ProPage } from "./pages/ProPage";
import { SettingsPage } from "./pages/SettingsPage";

type Page = "simple" | "video" | "audio" | "images" | "pro" | "settings";

const NAV_ITEMS: { id: Page; label: string; icon: React.ComponentType<LucideProps> }[] = [
  { id: "simple", label: "Download", icon: Download },
  { id: "video", label: "Video", icon: Video },
  { id: "audio", label: "Audio", icon: Music },
  { id: "images", label: "Images", icon: ImageIcon },
  { id: "pro", label: "Pro Mode", icon: Zap },
  { id: "settings", label: "Settings", icon: Settings },
];

function App() {
  const [page, setPage] = useState<Page>("simple");

  return (
    <div className="min-h-screen bg-yoinkit-bg text-yoinkit-text flex">
      {/* Sidebar */}
      <nav className="w-52 bg-yoinkit-surface border-r border-yoinkit-border flex flex-col">
        <div className="px-5 py-6">
          <h1 className="text-lg font-semibold tracking-tight">Yoinkit</h1>
          <p className="text-xs text-yoinkit-text-muted mt-0.5">Download anything</p>
        </div>

        <div className="flex-1 px-3 space-y-0.5">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setPage(id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-colors ${
                page === id
                  ? "bg-yoinkit-accent/10 text-yoinkit-accent font-medium"
                  : "text-yoinkit-text-secondary hover:text-yoinkit-text hover:bg-yoinkit-surface-hover"
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>

        <div className="px-5 py-4 border-t border-yoinkit-border">
          <p className="text-[11px] text-yoinkit-text-muted">v0.2.1</p>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        {page === "simple" && <SimplePage />}
        {page === "video" && <VideoPage />}
        {page === "audio" && <AudioPage />}
        {page === "images" && <ImagesPage />}
        {page === "pro" && <ProPage />}
        {page === "settings" && <SettingsPage />}
      </main>
    </div>
  );
}

export default App;
