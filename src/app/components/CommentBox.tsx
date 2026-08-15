"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

type CommentReply = {
  id: number;
  message: string;
  createdAt: string;
  author: "ag" | "user";
  authorName?: string;
  targetName?: string;
  userId?: number;
  userName?: string;
  streak?: number;
  replies?: CommentReply[];
};

type Comment = {
  id: number;
  quoteId: number;
  userName: string;
  message: string;
  isAnonymous: boolean;
  createdAt: string;
  replies: CommentReply[];
  streak?: number;
};

type CommentBoxProps = {
  quoteId: number;
  date?: string;
  isSignedIn: boolean;
};

type ChatMessage = {
  id: string;
  authorLabel: string;
  createdAt: string;
  message: string;
  targetName?: string;
  streak?: number;
};

type UserOption = {
  id: number;
  username: string;
};

function renderMentionText(text: string) {
  return text.split(/(@[A-Za-z0-9._-]+)/g).map((part, index) => {
    if (!part.startsWith("@")) {
      return <span key={`${part}-${index}`}>{part}</span>;
    }

    return (
      <span key={`${part}-${index}`} className="font-semibold text-[var(--accent-soft)]">
        {part}
      </span>
    );
  });
}

export default function CommentBox({ quoteId, date, isSignedIn }: CommentBoxProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [message, setMessage] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [mentionContext, setMentionContext] = useState<{ query: string; start: number | null }>({ query: "", start: null });
  const [mentionSelection, setMentionSelection] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loadComments = useCallback(async () => {
    const query = new URLSearchParams({ quoteId: String(quoteId) });
    if (date) {
      query.set("date", date);
    }

    const res = await fetch(`/api/comments?${query.toString()}`, { cache: "no-store" });
    if (!res.ok) return;

    const data = await res.json();
    const nextComments = data.comments ?? [];

    setComments((previousComments) => {
      if (previousComments.length === nextComments.length && JSON.stringify(previousComments) === JSON.stringify(nextComments)) {
        return previousComments;
      }
      return nextComments;
    });
  }, [date, quoteId]);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadComments();
    }, 1500);

    return () => window.clearInterval(interval);
  }, [loadComments]);

  useEffect(() => {
    if (!isSignedIn) {
      setUserOptions([]);
      return;
    }

    const loadUsers = async () => {
      const res = await fetch("/api/users", { cache: "no-store" });
      if (!res.ok) return;

      const data = await res.json();
      setUserOptions((data.users ?? []) as UserOption[]);
    };

    void loadUsers();
  }, [isSignedIn]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isSignedIn) return;

    setLoading(true);
    setStatus("");

    const res = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quoteId, message, isAnonymous }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setStatus(data.error ?? "Could not post comment.");
      return;
    }

    setMessage("");
    setIsAnonymous(false);
    setStatus("Message posted.");
    await loadComments();
  }

  function getMentionContext(text: string, cursor: number) {
    const beforeCursor = text.slice(0, cursor);
    const match = beforeCursor.match(/(?:^|\s)@([a-zA-Z0-9._-]*)$/);
    if (!match) {
      return { query: "", start: null };
    }

    return {
      query: match[1],
      start: beforeCursor.length - match[1].length - 1,
    };
  }

  function updateMentionContext(value: string, cursor: number) {
    setMentionContext(getMentionContext(value, cursor));
    setMentionSelection(0);
  }

  function insertMention(username: string) {
    if (mentionContext.start === null || !textareaRef.current) return;

    const start = mentionContext.start;
    const end = textareaRef.current.selectionStart;
    const nextValue = `${message.slice(0, start)}@${username} ${message.slice(end)}`;
    const nextCursor = start + username.length + 2;

    setMessage(nextValue);
    updateMentionContext(nextValue, nextCursor);

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextCursor, nextCursor);
    });
  }

  function flattenReplies(replies: CommentReply[]): ChatMessage[] {
    return replies.flatMap((reply) => {
      const rows: ChatMessage[] = [
        {
          id: `reply-${reply.id}`,
          authorLabel: reply.author === "ag" ? "AG" : reply.authorName || "User",
          createdAt: reply.createdAt,
          message: reply.message,
          targetName: reply.targetName,
          streak: reply.streak,
        },
      ];

      if (reply.replies && reply.replies.length > 0) {
        rows.push(...flattenReplies(reply.replies));
      }

      return rows;
    });
  }

  const mentionSuggestions = userOptions
    .filter((user) => user.username.toLowerCase().includes(mentionContext.query.toLowerCase()))
    .slice(0, 6);

  useEffect(() => {
    setMentionSelection(0);
  }, [mentionContext.query]);

  const chatMessages = comments
    .flatMap((comment) => {
      const rows: ChatMessage[] = [
        {
          id: `comment-${comment.id}`,
          authorLabel: comment.isAnonymous ? "Anonymous" : comment.userName,
          createdAt: comment.createdAt,
          message: comment.message,
          streak: comment.streak,
        },
      ];

      if (comment.replies && comment.replies.length > 0) {
        rows.push(...flattenReplies(comment.replies));
      }

      return rows;
    })
    .sort((a, b) => {
      const timeDelta = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (timeDelta !== 0) return timeDelta;
      return a.id.localeCompare(b.id);
    });

  return (
    <section className="mt-10 w-full rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-left">
      <h2 className="text-sm font-medium uppercase tracking-[0.24em] text-[var(--text-muted)]">
        Community chat
      </h2>

      {isSignedIn ? (
        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => {
                const nextValue = e.target.value;
                setMessage(nextValue);
                updateMentionContext(nextValue, e.target.selectionStart);
              }}
              onKeyDown={(e) => {
                const value = e.currentTarget.value;
                const cursor = e.currentTarget.selectionStart ?? value.length;
                updateMentionContext(value, cursor);

                if (!mentionContext.start || mentionSuggestions.length === 0) return;

                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setMentionSelection((current) => (current + 1) % mentionSuggestions.length);
                }

                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setMentionSelection((current) => (current - 1 + mentionSuggestions.length) % mentionSuggestions.length);
                }

                if (e.key === "Enter") {
                  e.preventDefault();
                  const selectedUser = mentionSuggestions[mentionSelection];
                  if (selectedUser) {
                    insertMention(selectedUser.username);
                  }
                }
              }}
              onKeyUp={(e) => {
                const value = e.currentTarget.value;
                const cursor = e.currentTarget.selectionStart ?? value.length;
                updateMentionContext(value, cursor);
              }}
              onClick={() => {
                const value = textareaRef.current?.value ?? message;
                const cursor = textareaRef.current?.selectionStart ?? value.length;
                updateMentionContext(value, cursor);
              }}
              rows={4}
              placeholder="Write a message or mention someone with @username"
              className="w-full resize-y rounded-lg border border-white/10 bg-[var(--bg-deep)] px-4 py-3 text-sm text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
              required
            />

            {mentionContext.start !== null && mentionSuggestions.length > 0 && (
              <div className="absolute z-10 mt-2 w-full rounded-lg border border-white/10 bg-[var(--bg-deep)] p-2 shadow-lg">
                {mentionSuggestions.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      insertMention(user.username);
                    }}
                    className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-[var(--text)] hover:bg-white/10"
                  >
                    @{user.username}
                  </button>
                ))}
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <input
              type="checkbox"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
            />
            Post anonymously
          </label>

          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--bg-deep)] hover:brightness-110 disabled:opacity-50"
          >
            {loading ? "Posting…" : "Send message"}
          </button>
        </form>
      ) : (
        <p className="mt-4 text-sm text-[var(--text-muted)]">
          Sign in to join the chat and mention others with @username.
        </p>
      )}

      {status && <p className="mt-3 text-sm text-emerald-400">{status}</p>}

      <div className="mt-6 space-y-2">
        {chatMessages.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No messages yet.</p>
        ) : (
          chatMessages.map((item) => (
            <div key={item.id} className="rounded-xl border border-white/10 bg-[var(--bg-deep)]/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-soft)]">
                    {item.authorLabel}
                  </p>
                  {typeof item.streak === "number" && item.streak > 0 && (
                    <span className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)]/15 px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--accent-soft)]">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--bg-deep)]/60 text-[12px]">🔥</span>
                      <span className="whitespace-nowrap">{item.streak}</span>
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">
                  {new Date(item.createdAt).toLocaleString()}
                </p>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text)]">
                {item.targetName ? (
                  <>
                    <span className="font-semibold text-[var(--accent-soft)]">@{item.targetName}</span>{" "}
                    {renderMentionText(item.message)}
                  </>
                ) : (
                  renderMentionText(item.message)
                )}
              </p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
