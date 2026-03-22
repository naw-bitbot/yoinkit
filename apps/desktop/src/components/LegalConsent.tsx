import React, { useState } from "react";
import { Shield } from "lucide-react";

interface LegalConsentProps {
  onAccept: () => void;
}

export function LegalConsent({ onAccept }: LegalConsentProps) {
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "var(--bg)" }}>
      <div className="max-w-md w-full mx-4 space-y-6">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "color-mix(in srgb, var(--brand) 10%, transparent)" }}>
            <Shield className="w-8 h-8" style={{ color: "var(--brand)" }} />
          </div>
          <h1 className="text-2xl font-bold">Welcome to Yoinkit</h1>
          <p style={{ color: "var(--text-secondary)" }} className="text-center">Your personal web toolkit</p>
        </div>

        <div className="rounded-xl p-5 space-y-3 text-sm" style={{ backgroundColor: "var(--surface)", color: "var(--text-secondary)" }}>
          <p>Yoinkit is a personal web toolkit for saving content to your own device.</p>
          <p>You are responsible for ensuring you have the right to save content you download.</p>
          <p>Respect creators — credit original sources, do not redistribute copyrighted material.</p>
        </div>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1 rounded"
          />
          <span className="text-sm">
            I agree to the{" "}
            <a href="https://yoinkit.app/terms" target="_blank" rel="noopener noreferrer" style={{ color: "var(--brand)" }} className="underline">
              Terms of Use
            </a>{" "}
            and{" "}
            <a href="https://yoinkit.app/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "var(--brand)" }} className="underline">
              Privacy Policy
            </a>
          </span>
        </label>

        <button
          onClick={onAccept}
          disabled={!agreed}
          className="w-full py-3 rounded-xl text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          style={{ backgroundColor: "var(--brand)" }}
        >
          Get Started
        </button>
      </div>
    </div>
  );
}
