"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type ChatMessage = {
  id: number;
  sender: "user" | "ag";
  userId?: number;
  message: string;
  createdAt: string;
};

type Conversation = {
  id: number;
  userId: number;
  username: string;
  createdAt: string;
  messages: ChatMessage[];
};

type PrivateChatProps = {
  isAdmin: boolean;
};

export default function PrivateChat({ isAdmin }: PrivateChatProps) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [message, setMessage] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    const res = await fetch("/api/messages", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();

    if (isAdmin) {
      const nextConversations: Conversation[] = (data.conversations ?? []) as Conversation[];
      setConversations(nextConversations);
      if (!selectedUserId && nextConversations[0]) {
        setSelectedUserId(nextConversations[0].userId);
      } else if (selectedUserId && !nextConversations.some((item: Conversation) => item.userId === selectedUserId)) {
        setSelectedUserId(nextConversations[0]?.userId ?? null);
      }
      return;
    }

    setConversation(data.conversation ?? null);
  }, [isAdmin, selectedUserId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      loadData();
    }, 3000);

    return () => window.clearInterval(interval);
  }, [loadData]);

  useEffect(() => {
    if (!isAdmin || !selectedUserId) return;
    const current = conversations.find((item) => item.userId === selectedUserId);
    setConversation(current ?? null);
  }, [conversations, selectedUserId, isAdmin]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;

    setLoading(true);

    const payload = isAdmin
      ? { conversationId: conversation?.id, userId: selectedUserId, message }
      : { message };

    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);
    if (!res.ok) return;

    setMessage("");
    await loadData();
  }

  return (
    <section className="mt-10 w-full rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-left">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-medium uppercase tracking-[0.24em] text-[var(--text-muted)]">
          {isAdmin ? "Private chats with users" : "Message AG"}
        </h2>
        {isAdmin && conversations.length > 0 && (
          <select
            value={selectedUserId ?? ""}
            onChange={(e) => setSelectedUserId(Number(e.target.value))}
            className="rounded-lg border border-white/10 bg-[var(--bg-deep)] px-3 py-2 text-sm text-[var(--text)]"
          >
            {conversations.map((item) => (
              <option key={item.userId} value={item.userId}>
                {item.username}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="mt-5 space-y-3 rounded-xl border border-white/10 bg-[var(--bg-deep)]/70 p-4">
        {!conversation || conversation.messages.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            {isAdmin ? "No messages yet." : "Send AG a private message."}
          </p>
        ) : (
          conversation.messages.map((item) => {
            const isMine = item.sender === "ag" ? false : !isAdmin;
            return (
              <div
                key={item.id}
                className={`flex ${isMine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    isMine
                      ? "bg-[var(--accent)] text-[var(--bg-deep)]"
                      : "border border-white/10 bg-white/[0.06] text-[var(--text)]"
                  }`}
                >
                  <p className="text-[10px] uppercase tracking-[0.2em] opacity-70">
                    {item.sender === "ag" ? "AG" : isAdmin ? "User" : "You"}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed">{item.message}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          placeholder={isAdmin ? "Write a reply to this user…" : "Write a private message to AG…"}
          className="w-full resize-y rounded-lg border border-white/10 bg-[var(--bg-deep)] px-4 py-3 text-sm text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--bg-deep)] hover:brightness-110 disabled:opacity-50"
        >
          {loading ? "Sending…" : isAdmin ? "Send reply" : "Send to AG"}
        </button>
      </form>
    </section>
  );
}
