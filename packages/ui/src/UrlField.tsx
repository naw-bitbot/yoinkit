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
  placeholder = "Paste a URL to yoink...",
  className = "",
  disabled = false,
}: UrlFieldProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

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
      <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-tertiary)' }}>
        <Link size={14} strokeWidth={1.5} />
      </div>
      <input
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full pl-9 pr-3 h-[36px] rounded-[8px] text-[13px] transition-all duration-200 ${disabled ? "opacity-40 pointer-events-none" : ""}`}
        style={{
          background: 'var(--fill)',
          color: 'var(--text)',
          border: isDragOver || isFocused ? '0.5px solid var(--accent)' : '0.5px solid var(--border-strong)',
          boxShadow: isFocused ? '0 0 0 3px color-mix(in srgb, var(--accent) 25%, transparent)' : 'none',
        }}
      />
      {isDragOver && (
        <div className="absolute inset-0 flex items-center justify-center rounded-[8px] pointer-events-none" style={{ background: 'color-mix(in srgb, var(--accent) 8%, transparent)', border: '2px dashed var(--accent)' }}>
          <span className="text-[13px] font-medium" style={{ color: 'var(--accent)' }}>Drop URL here</span>
        </div>
      )}
    </div>
  );
}
