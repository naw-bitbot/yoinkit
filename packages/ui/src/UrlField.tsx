import React, { useState, useCallback } from "react";
import { Link } from "lucide-react";

interface UrlFieldProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (url: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function UrlField({
  value,
  onChange,
  onSubmit,
  placeholder = "Paste a URL to download...",
  className = "",
  disabled = false,
}: UrlFieldProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && value.trim() && onSubmit) {
      onSubmit(value.trim());
    }
  }, [value, onSubmit]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const text = e.dataTransfer.getData("text/plain");
    if (text) {
      onChange(text);
      if (onSubmit) onSubmit(text);
    }
  }, [onChange, onSubmit]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text/plain");
    if (text && text.startsWith("http")) {
      e.preventDefault();
      onChange(text);
    }
  }, [onChange]);

  return (
    <div
      className={`relative ${className}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-yoinkit-text-muted pointer-events-none">
        <Link size={15} />
      </div>
      <input
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full pl-10 pr-4 h-11 bg-yoinkit-bg border rounded-lg text-sm text-yoinkit-text placeholder:text-yoinkit-text-muted/60 focus:outline-none focus:ring-2 focus:ring-yoinkit-accent/40 focus:border-yoinkit-accent/40 transition-all ${
          isDragOver
            ? "border-yoinkit-accent ring-2 ring-yoinkit-accent/20"
            : "border-yoinkit-border"
        } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
      />
      {isDragOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-yoinkit-accent/5 rounded-lg border-2 border-dashed border-yoinkit-accent pointer-events-none">
          <span className="text-yoinkit-accent text-sm font-medium">Drop URL here</span>
        </div>
      )}
    </div>
  );
}
