import { useState, useEffect, useCallback } from "react";
import { api, ChatMessage } from "../lib/tauri";

export function useAI() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.chatHistory();
      setMessages(result);
    } catch (err) {
      console.error("Failed to fetch chat history:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const sendMessage = useCallback(async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
      sources: "",
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setSending(true);

    try {
      const response = await api.chatAsk(trimmed);

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response.answer,
        sources: JSON.stringify(response.source_ids),
        created_at: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      console.error("Failed to send message:", err);
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: "Sorry, something went wrong. Please try again.",
        sources: "",
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setSending(false);
    }
  }, []);

  const clearChat = useCallback(async () => {
    try {
      await api.chatClear();
      setMessages([]);
    } catch (err) {
      console.error("Failed to clear chat history:", err);
    }
  }, []);

  return { messages, loading, sending, sendMessage, clearChat };
}
