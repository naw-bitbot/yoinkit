import { useState } from "react";

// Pages
import { SimplePage } from "./pages/SimplePage";
import { ProPage } from "./pages/ProPage";
import { SettingsPage } from "./pages/SettingsPage";

type Page = "simple" | "pro" | "settings";

function App() {
  const [page, setPage] = useState<Page>("simple");

  return (
    <div className="min-h-screen bg-yoinkit-bg text-yoinkit-text flex">
      {/* Sidebar */}
      <nav className="w-56 bg-yoinkit-surface border-r border-yoinkit-muted/10 flex flex-col">
        <div className="p-5">
          <h1 className="text-xl font-bold text-yoinkit-text tracking-tight">Yoinkit</h1>
          <p className="text-xs text-yoinkit-muted mt-0.5">Download anything</p>
        </div>

        <div className="flex-1 px-3 space-y-1">
          <NavButton
            label="Download"
            icon="↓"
            active={page === "simple"}
            onClick={() => setPage("simple")}
          />
          <NavButton
            label="Pro Mode"
            icon="⚡"
            active={page === "pro"}
            onClick={() => setPage("pro")}
          />
          <NavButton
            label="Settings"
            icon="⚙"
            active={page === "settings"}
            onClick={() => setPage("settings")}
          />
        </div>

        <div className="p-4 border-t border-yoinkit-muted/10">
          <p className="text-xs text-yoinkit-muted">v0.1.0</p>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-y-auto">
        {page === "simple" && <SimplePage />}
        {page === "pro" && <ProPage />}
        {page === "settings" && <SettingsPage />}
      </main>
    </div>
  );
}

function NavButton({ label, icon, active, onClick }: { label: string; icon: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
        active
          ? "bg-yoinkit-primary/10 text-yoinkit-primary font-medium"
          : "text-yoinkit-muted hover:text-yoinkit-text hover:bg-yoinkit-bg/50"
      }`}
    >
      <span className="text-base">{icon}</span>
      {label}
    </button>
  );
}

export default App;
