import { useState, useRef, KeyboardEvent } from "react";

interface TagEditorProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  className?: string;
}

export function TagEditor({ tags, onChange, className = "" }: TagEditorProps) {
  const [inputValue, setInputValue] = useState("");
  const [isInputFocused, setIsInputFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (tags.includes(trimmed)) {
      setInputValue("");
      return;
    }
    onChange([...tags, trimmed]);
    setInputValue("");
  };

  const removeTag = (index: number) => {
    const next = tags.filter((_, i) => i !== index);
    onChange(next);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === "Escape") {
      setInputValue("");
      inputRef.current?.blur();
    } else if (e.key === "Backspace" && inputValue === "" && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  return (
    <div
      className={`flex flex-wrap items-center gap-1 px-2 py-1.5 rounded-[6px] transition-all duration-200 ${className}`}
      style={{
        background: isInputFocused ? "var(--fill)" : "transparent",
        cursor: "text",
      }}
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((tag, index) => (
        <span
          key={tag}
          className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 transition-all duration-150"
          style={{
            background: "color-mix(in srgb, var(--brand) 12%, transparent)",
            fontSize: "11px",
            lineHeight: "1.4",
            fontWeight: 500,
            letterSpacing: "0.01em",
          }}
        >
          <span style={{ color: "var(--brand)" }}>{tag}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeTag(index);
            }}
            className="flex items-center justify-center w-3 h-3 rounded-full transition-opacity duration-150 hover:opacity-100 ml-0.5"
            style={{
              color: "var(--text-tertiary)",
              opacity: 0.7,
              fontSize: "10px",
              lineHeight: 1,
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
            aria-label={`Remove tag ${tag}`}
          >
            ×
          </button>
        </span>
      ))}

      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsInputFocused(true)}
        onBlur={() => {
          setIsInputFocused(false);
          if (inputValue.trim()) {
            addTag(inputValue);
          }
        }}
        placeholder={tags.length === 0 ? "Add tags…" : ""}
        className="flex-1 min-w-[80px] bg-transparent outline-none transition-all duration-150"
        style={{
          fontSize: "11px",
          lineHeight: "1.4",
          color: "var(--text)",
          border: "none",
          padding: "1px 2px",
        }}
        aria-label="Add tag"
      />
    </div>
  );
}
