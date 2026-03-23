import React, { useState } from "react";
import { Crown, Zap, Video, Music, LayoutGrid, Layers, Gauge, Calendar, Bot, Terminal, Search, CheckCircle2 } from "lucide-react";
import { usePro } from "../hooks/usePro";
import { useSettings } from "../hooks/useSettings";
import { api } from "../lib/tauri";
import { ConfettiCelebration } from "../components/ConfettiCelebration";

export function ProPage() {
  const { isPro, proSince } = usePro();
  const { settings } = useSettings();
  const [licenseKey, setLicenseKey] = useState("");
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);

  const handleActivate = async () => {
    if (!licenseKey.trim()) return;
    setActivating(true);
    setError("");
    try {
      const result = await api.activateLicense(licenseKey.trim());
      if (result.success) {
        setShowConfetti(true);
      } else {
        setError(result.error || "Activation failed");
      }
    } catch (e: any) {
      setError(e.toString());
    } finally {
      setActivating(false);
    }
  };

  if (isPro) {
    // Pro dashboard
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[color-mix(in_srgb,var(--brand)_10%,transparent)] flex items-center justify-center">
            <Crown className="w-5 h-5 text-[var(--brand)]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Pro</h1>
            {proSince && <p className="text-sm text-[var(--text-muted)]">Member since {new Date(proSince).toLocaleDateString()}</p>}
          </div>
        </div>
        <p className="text-[var(--text-secondary)]">All Pro features are unlocked. Enjoy the full toolkit.</p>
      </div>
    );
  }

  // Free state — shop window
  const features = [
    { icon: Video, title: "4K & 1080p Video", desc: "Log in full quality, any format" },
    { icon: Music, title: "Lossless Audio", desc: "FLAC, WAV, AAC, Opus, 320kbps" },
    { icon: LayoutGrid, title: "Unlimited Library", desc: "Collections, tags, flags, smart folders" },
    { icon: Layers, title: "Batch Operations", desc: "Yoink, clip, and export in bulk" },
    { icon: Gauge, title: "Multi-Thread Logging", desc: "Parallel chunked fetching" },
    { icon: Calendar, title: "Scheduling", desc: "Yoink scheduler & site monitoring" },
    { icon: Bot, title: "MCP Server", desc: "Claude Desktop integration" },
    { icon: Terminal, title: "Wget Builder", desc: "Visual command builder & presets" },
    { icon: Search, title: "Advanced Search", desc: "Regex, filters, saved searches" },
  ];

  return (
    <div className="space-y-8">
      {showConfetti && <ConfettiCelebration />}

      {/* Hero */}
      <div className="text-center space-y-3 py-8">
        <div className="w-16 h-16 rounded-2xl bg-[color-mix(in_srgb,var(--brand)_10%,transparent)] flex items-center justify-center mx-auto">
          <Zap className="w-8 h-8 text-[var(--brand)]" />
        </div>
        <h1 className="text-3xl font-bold">Unlock the full toolkit</h1>
        <p className="text-[var(--text-secondary)]">£19 one-time purchase · Yours forever</p>
      </div>

      {/* Feature grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {features.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="p-4 rounded-xl bg-[var(--surface)] space-y-2">
            <Icon className="w-5 h-5 text-[var(--brand)]" />
            <p className="font-medium text-sm">{title}</p>
            <p className="text-xs text-[var(--text-muted)]">{desc}</p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="text-center space-y-4 py-4">
        <a
          href="https://yoinkit.app/pro"
          target="_blank"
          className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-[var(--brand)] text-white font-medium hover:opacity-90 transition-opacity"
        >
          <Crown className="w-4 h-4" /> Upgrade to Pro · £19
        </a>
        <p className="text-xs text-[var(--text-muted)]">One-time purchase. No subscription. Ever.</p>
      </div>

      {/* License key input */}
      <div className="bg-[var(--surface)] rounded-xl p-5 space-y-3">
        <p className="text-sm font-medium">Already have a license key?</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={licenseKey}
            onChange={(e) => setLicenseKey(e.target.value)}
            placeholder="Paste your license key"
            className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-sm"
          />
          <button
            onClick={handleActivate}
            disabled={activating || !licenseKey.trim()}
            className="px-4 py-2 rounded-lg bg-[var(--brand)] text-white text-sm font-medium disabled:opacity-40"
          >
            {activating ? "Activating..." : "Activate"}
          </button>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    </div>
  );
}
