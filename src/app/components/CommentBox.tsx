"use client";

import { FormEvent, useEffect, useState } from "react";

type CommentReply = {
  id: number;
  message: string;
  createdAt: string;
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
                <div className="mt-4 space-y-2 rounded-lg border border-white/10 bg-[var(--bg-deep)]/70 p-3">
                  {comment.replies.map((reply) => (
                    <div key={reply.id}>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-soft)]">
                        Admin reply
                      </p>
                      <p className="mt-1 text-sm text-[var(--text)]">{reply.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))
        )}
      </div>
    </section>
  );
}
