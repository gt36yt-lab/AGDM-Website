"use client";

import { FormEvent, useEffect, useState } from "react";

type CommentReply = {
  id: number;
  message: string;
  createdAt: string;
  author: "ag" | "user";
  authorName?: string;
  targetName?: string;
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
};

type CommentBoxProps = {
  quoteId: number;
  isSignedIn: boolean;
};

type ChatMessage = {
  id: string;
  authorLabel: string;
  createdAt: string;
  message: string;
  targetName?: string;
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

export default function CommentBox({ quoteId, isSignedIn }: CommentBoxProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [message, setMessage] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const loadComments = async () => {
    const res = await fetch(`/api/comments?quoteId=${quoteId}`, { cache: "no-store" });
    if (!res.ok) return;

    const data = await res.json();
    setComments(data.comments ?? []);
  };

  useEffect(() => {
    loadComments();
  }, [quoteId]);

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

  function flattenReplies(replies: CommentReply[]): ChatMessage[] {
    return replies.flatMap((reply) => {
      const rows: ChatMessage[] = [
        {
          id: `reply-${reply.id}`,
          authorLabel: reply.author === "ag" ? "AG" : reply.authorName || "User",
          createdAt: reply.createdAt,
          message: reply.message,
          targetName: reply.targetName,
        },
      ];

      if (reply.replies && reply.replies.length > 0) {
        rows.push(...flattenReplies(reply.replies));
      }

      return rows;
    });
  }

  const chatMessages = comments.flatMap((comment) => {
    const rows: ChatMessage[] = [
      {
        id: `comment-${comment.id}`,
        authorLabel: comment.isAnonymous ? "Anonymous" : comment.userName,
        createdAt: comment.createdAt,
        message: comment.message,
      },
    ];

    if (comment.replies && comment.replies.length > 0) {
      rows.push(...flattenReplies(comment.replies));
    }

    return rows;
  });

  return (
    <section className="mt-10 w-full rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-left">
      <h2 className="text-sm font-medium uppercase tracking-[0.24em] text-[var(--text-muted)]">
        Community chat
      </h2>

      {isSignedIn ? (
        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder="Write a message or mention someone with @username"
            className="w-full resize-y rounded-lg border border-white/10 bg-[var(--bg-deep)] px-4 py-3 text-sm text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
            required
          />

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
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-soft)]">
                  {item.authorLabel}
                </p>
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
