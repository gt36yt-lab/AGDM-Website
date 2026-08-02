"use client";

import { FormEvent, useEffect, useState } from "react";

type CommentReply = {
  id: number;
  message: string;
  createdAt: string;
  author: "ag" | "user";
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

export default function CommentBox({ quoteId, isSignedIn }: CommentBoxProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [message, setMessage] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

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
    setStatus("Comment posted.");
    await loadComments();
  }

  async function onReplySubmit(e: FormEvent, commentId: number, parentReplyId: number, targetName?: string) {
    e.preventDefault();
    if (!isSignedIn) return;

    const key = `${commentId}-${parentReplyId}`;
    const replyText = (replyDrafts[key] ?? "").trim();
    if (!replyText) return;

    const res = await fetch("/api/comments/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentId, parentReplyId, message: replyText, targetName }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setStatus(data.error ?? "Could not send reply.");
      return;
    }

    setReplyDrafts((prev) => ({ ...prev, [key]: "" }));
    setStatus("Reply posted.");
    await loadComments();
  }

  function renderReplyTree(reply: CommentReply, commentId: number, depth = 0, replyTargetName?: string) {
    return (
      <div
        key={reply.id}
        className={`rounded-lg border border-white/10 bg-white/[0.03] p-3 ${depth > 0 ? "ml-4" : ""}`}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-soft)]">
          {reply.author === "ag" ? "AG reply" : "Reply"}
        </p>
        <p className="mt-1 text-sm text-[var(--text)]">
          {reply.targetName ? `@${reply.targetName} ${reply.message}` : reply.message}
        </p>

        {isSignedIn && (
          <form
            onSubmit={(e) => onReplySubmit(e, commentId, reply.id, reply.targetName ?? replyTargetName)}
            className="mt-3 space-y-2"
          >
            <textarea
              value={replyDrafts[`${commentId}-${reply.id}`] ?? ""}
              onChange={(e) =>
                setReplyDrafts((prev) => ({
                  ...prev,
                  [`${commentId}-${reply.id}`]: e.target.value,
                }))
              }
              rows={3}
              placeholder="Reply to this thread…"
              className="w-full resize-y rounded-lg border border-white/10 bg-[var(--bg-deep)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
            <button
              type="submit"
              className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-[var(--bg-deep)] hover:brightness-110"
            >
              Reply
            </button>
          </form>
        )}

        {reply.replies && reply.replies.length > 0 && (
          <div className="mt-3 space-y-2 rounded-lg border border-white/10 bg-[var(--bg-deep)]/60 p-3">
            {reply.replies.map((childReply) => renderReplyTree(childReply, commentId, depth + 1, reply.targetName ?? replyTargetName))}
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="mt-10 w-full rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-left">
      <h2 className="text-sm font-medium uppercase tracking-[0.24em] text-[var(--text-muted)]">
        Community thoughts
      </h2>

      {isSignedIn ? (
        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder="Share your thoughts about this quote…"
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
            {loading ? "Posting…" : "Post comment"}
          </button>
        </form>
      ) : (
        <p className="mt-4 text-sm text-[var(--text-muted)]">
          Sign in to leave a public comment or post anonymously.
        </p>
      )}

      {status && <p className="mt-3 text-sm text-emerald-400">{status}</p>}

      <div className="mt-6 space-y-4">
        {comments.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No comments yet.</p>
        ) : (
          comments.map((comment) => (
            <article key={comment.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[var(--accent-soft)]">
                  {comment.userName}
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  {new Date(comment.createdAt).toLocaleString()}
                </p>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-[var(--text)]">{comment.message}</p>

              {comment.replies.length > 0 && (
                <div className="mt-4 space-y-3 rounded-lg border border-white/10 bg-[var(--bg-deep)]/70 p-3">
                  {comment.replies.map((reply) => renderReplyTree(reply, comment.id, 0, comment.userName))}
                </div>
              )}
            </article>
          ))
        )}
      </div>
    </section>
  );
}
