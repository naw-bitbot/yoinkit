import { ChatMessage as ChatMessageType } from "../lib/tauri";

// Simple text renderer for chat responses (renders as plain text with line breaks)
function SimpleMarkdown({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) => (
        <p key={i} className="text-[13px] leading-relaxed" style={{ color: "var(--text)" }}>
          {line || "\u00A0"}
        </p>
      ))}
    </div>
  );
}

interface ChatMessageProps {
  message: ChatMessageType;
}

function formatTime(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function parseSourceIds(sources: string): string[] {
  if (!sources) return [];
  try {
    const parsed = JSON.parse(sources);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  const sourceIds = parseSourceIds(message.sources);

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`flex flex-col gap-1 max-w-[75%] ${isUser ? "items-end" : "items-start"}`}>
        <div
          className="px-3 py-2 rounded-[10px] text-[13px] leading-relaxed"
          style={{
            background: isUser
              ? "color-mix(in srgb, var(--brand) 12%, transparent)"
              : "var(--surface-solid)",
            border: isUser ? "none" : "0.5px solid var(--border)",
            color: "var(--text)",
          }}
        >
          {isUser ? (
            message.content
          ) : (
            <SimpleMarkdown content={message.content} />
          )}
        </div>

        {/* Source pills for assistant messages */}
        {!isUser && sourceIds.length > 0 && (
          <div className="flex flex-wrap gap-1 px-1">
            {sourceIds.map((id) => (
              <span
                key={id}
                className="text-[11px] px-2 py-0.5 rounded-[6px]"
                style={{
                  background: "var(--fill)",
                  color: "var(--text-secondary)",
                  border: "0.5px solid var(--border)",
                }}
              >
                {id}
              </span>
            ))}
          </div>
        )}

        {/* Timestamp */}
        <span className="text-[11px] px-1" style={{ color: "var(--text-tertiary)" }}>
          {formatTime(message.created_at)}
        </span>
      </div>
    </div>
  );
}
