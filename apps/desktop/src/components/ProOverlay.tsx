import React from "react";
import { Lock } from "lucide-react";

interface ProOverlayProps {
  feature: string;
  description: string;
  onUpgrade: () => void;
}

export function ProOverlay({ feature, description, onUpgrade }: ProOverlayProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 space-y-4">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "var(--surface)" }}>
        <Lock className="w-8 h-8" style={{ color: "var(--text-muted)" }} />
      </div>
      <h2 className="text-xl font-semibold">{feature}</h2>
      <p className="text-center max-w-sm" style={{ color: "var(--text-secondary)" }}>{description}</p>
      <button
        onClick={onUpgrade}
        className="mt-4 px-6 py-2.5 rounded-xl text-white font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
        style={{ backgroundColor: "var(--brand)" }}
      >
        Upgrade to Pro · £19
      </button>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>One-time purchase. No subscription. Ever.</p>
    </div>
  );
}
