import { useState, useEffect, createContext, useContext } from "react";
import { Download, Video, Music, ImageIcon, Zap, Settings, Sun, Moon, Monitor, Scissors, Archive, Search, Brain, LayoutGrid, type LucideProps } from "lucide-react";
import { useTheme } from "./hooks/useTheme";

import { SimplePage } from "./pages/SimplePage";
import { VideoPage } from "./pages/VideoPage";
import { AudioPage } from "./pages/AudioPage";
import { ImagesPage } from "./pages/ImagesPage";
import { ProPage } from "./pages/ProPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ClipperPage } from "./pages/ClipperPage";
import { ArchivePage } from "./pages/ArchivePage";
import { SearchPage } from "./pages/SearchPage";
import { AIPage } from "./pages/AIPage";
import { LegalConsent } from "./components/LegalConsent";
import { api } from "./lib/tauri";

type Page = "yoinks" | "gallery" | "video" | "audio" | "images" | "clipper" | "archive" | "search" | "ai" | "pro" | "settings";
type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  resolved: "light" | "dark";
  setTheme: (t: Theme) => void;
}

export const ThemeContext = createContext<ThemeContextType>({
  theme: "system",
  resolved: "light",
  setTheme: () => {},
});

export const useThemeContext = () => useContext(ThemeContext);

const NAV_ITEMS: { id: Page; label: string; icon: React.ComponentType<LucideProps> }[] = [
  { id: "yoinks", label: "Yoinks", icon: Download },
  { id: "gallery", label: "Gallery", icon: LayoutGrid },
  { id: "video", label: "Video", icon: Video },
  { id: "audio", label: "Audio", icon: Music },
  { id: "images", label: "Images", icon: ImageIcon },
  { id: "clipper", label: "Clipper", icon: Scissors },
  { id: "archive", label: "Archive", icon: Archive },
  { id: "search", label: "Search", icon: Search },
  { id: "ai", label: "Ask", icon: Brain },
  { id: "pro", label: "Pro", icon: Zap },
  { id: "settings", label: "Settings", icon: Settings },
];

function App() {
  const [page, setPage] = useState<Page>("yoinks");
  const themeState = useTheme();
  const [consentChecked, setConsentChecked] = useState(false);
  const [hasConsent, setHasConsent] = useState(true); // default true to avoid flash

  useEffect(() => {
    api.checkConsent().then(ok => {
      setHasConsent(ok);
      setConsentChecked(true);
    }).catch(() => setConsentChecked(true)); // fail-open: if backend errors, allow app access
  }, []);

  const handleAcceptConsent = async () => {
    try {
      await api.acceptConsent();
      setHasConsent(true);
    } catch (e) {
      console.error("Failed to record consent:", e);
    }
  };

  if (consentChecked && !hasConsent) {
    return <LegalConsent onAccept={handleAcceptConsent} />;
  }

  return (
    <ThemeContext.Provider value={themeState}>
      <div className="h-screen flex overflow-hidden" style={{ background: 'var(--bg)' }}>
        {/* Sidebar — Liquid Glass */}
        <nav className="glass-sidebar w-[200px] flex flex-col border-r" style={{ borderColor: 'var(--separator)' }}>
          {/* Drag region — macOS traffic light area */}
          <div className="h-[52px] flex items-end px-4 pb-2" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
            <h1 className="text-[20px] font-bold tracking-tight" style={{ color: 'var(--brand)' }}>
              Yoinkit
            </h1>
          </div>

          <div className="flex-1 px-2 pt-3 space-y-px">
            {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setPage(id)}
                className="w-full flex items-center gap-2 px-2 py-[5px] rounded-[6px] text-[13px] transition-all duration-150"
                style={{
                  background: page === id ? 'var(--fill)' : 'transparent',
                  color: page === id ? 'var(--text)' : 'var(--text-secondary)',
                  fontWeight: page === id ? 500 : 400,
                }}
                onMouseEnter={e => {
                  if (page !== id) e.currentTarget.style.background = 'var(--fill)';
                }}
                onMouseLeave={e => {
                  if (page !== id) e.currentTarget.style.background = 'transparent';
                }}
              >
                <Icon size={16} strokeWidth={1.5} />
                {label}
              </button>
            ))}
          </div>

          {/* Theme toggle */}
          <div className="px-3 pb-4">
            <div className="apple-pill flex">
              {[
                { value: "light" as Theme, icon: Sun },
                { value: "system" as Theme, icon: Monitor },
                { value: "dark" as Theme, icon: Moon },
              ].map(({ value, icon: TIcon }) => (
                <button
                  key={value}
                  onClick={() => themeState.setTheme(value)}
                  className={`apple-pill-item flex-1 flex items-center justify-center py-1.5 ${themeState.theme === value ? 'active' : ''}`}
                >
                  <TIcon size={14} strokeWidth={1.5} />
                </button>
              ))}
            </div>
            <p className="text-[11px] text-center mt-1.5" style={{ color: 'var(--text-tertiary)' }}>v0.3.0</p>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto px-6 py-5">
          {page === "yoinks" && <SimplePage />}
          {page === "gallery" && <div className="text-center py-20" style={{ color: 'var(--text-secondary)' }}>Gallery coming soon</div>}
          {page === "video" && <VideoPage />}
          {page === "audio" && <AudioPage />}
          {page === "images" && <ImagesPage />}
          {page === "clipper" && <ClipperPage />}
          {page === "archive" && <ArchivePage />}
          {page === "search" && <SearchPage />}
          {page === "ai" && <AIPage />}
          {page === "pro" && <ProPage />}
          {page === "settings" && <SettingsPage />}
        </main>
      </div>
    </ThemeContext.Provider>
  );
}

export default App;
