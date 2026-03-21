import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Brain, Trash2, Send } from "lucide-react";
import { useAI } from "../hooks/useAI";
import { ChatMessage } from "../components/ChatMessage";
import { Button } from "@yoinkit/ui";

export function AIPage() {
  const { messages, loading, sending, sendMessage, clearChat } = useAI();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    setInput("");
    await sendMessage(trimmed);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-4 shrink-0">
        <div>
          <h2 className="text-[20px] font-bold tracking-tight" style={{ color: "var(--text)" }}>
            Ask My Yoinks
          </h2>
          <p className="text-[13px] mt-1" style={{ color: "var(--text-tertiary)" }}>
            Ask anything about your saved content
          </p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="flex items-center gap-1.5 h-[28px] px-2.5 rounded-[6px] text-[11px] transition-all duration-150"
            style={{
              background: "var(--fill)",
              color: "var(--text-tertiary)",
              border: "0.5px solid var(--border)",
            }}
            title="Clear chat"
          >
            <Trash2 size={12} strokeWidth={1.5} />
            Clear Chat
          </button>
        )}
      </div>

      {/* Chat area */}
      <div
        className="flex-1 overflow-y-auto rounded-[10px] p-4 space-y-4 mb-3"
        style={{
          background: "var(--surface-solid)",
          border: "0.5px solid var(--border)",
          minHeight: 0,
        }}
      >
        {messages.length === 0 && !loading && !sending ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full gap-3 py-12">
            <Brain size={32} strokeWidth={1} style={{ color: "var(--text-tertiary)" }} />
            <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>
              Ask anything about your saved content
            </p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}

            {/* Thinking indicator */}
            {sending && (
              <div className="flex justify-start">
                <div
                  className="px-3 py-2 rounded-[10px] text-[13px] animate-pulse"
                  style={{
                    background: "var(--surface-solid)",
                    border: "0.5px solid var(--border)",
                    color: "var(--brand)",
                  }}
                >
                  <span className="italic">Thinking…</span>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div
        className="flex items-center gap-2 p-2 rounded-[10px] shrink-0"
        style={{
          background: "var(--surface-solid)",
          border: "0.5px solid var(--border)",
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question…"
          disabled={sending || loading}
          className="flex-1 bg-transparent outline-none text-[13px] px-2"
          style={{ color: "var(--text)" }}
        />
        <Button
          variant="primary"
          size="sm"
          disabled={sending || loading || !input.trim()}
          onClick={handleSend}
        >
          <Send size={14} strokeWidth={1.5} />
          Send
        </Button>
      </div>
    </div>
  );
}
