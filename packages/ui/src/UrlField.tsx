import React, { useState, useCallback } from "react";

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
      <input
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full px-4 py-3 bg-yoinkit-bg border rounded-lg text-yoinkit-text placeholder-yoinkit-muted/50 focus:outline-none focus:ring-2 focus:ring-yoinkit-primary/50 focus:border-yoinkit-primary transition-all ${
          isDragOver
            ? "border-yoinkit-primary ring-2 ring-yoinkit-primary/30"
            : "border-yoinkit-muted/30"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      />
      {isDragOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-yoinkit-primary/10 rounded-lg border-2 border-dashed border-yoinkit-primary pointer-events-none">
          <span className="text-yoinkit-primary font-medium">Drop URL here</span>
        </div>
      )}
    </div>
  );
}
