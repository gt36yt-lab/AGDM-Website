"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import PrivateChat from "@/app/components/PrivateChat";

type Quote = {
  id: number;
  text: string;
  scheduledDate: string;
};

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

type UserAccount = {
  id: number;
  username: string;
  createdAt: string;
};

export default function AdminDashboard() {
  const router = useRouter();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [text, setText] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const loadQuotes = useCallback(async () => {
    const res = await fetch("/api/quotes", { cache: "no-store" });
    if (res.status === 401) {
      router.push("/admin/login");
      return;
    }
    const data = await res.json();
    setQuotes(data.quotes ?? []);
    setLoading(false);
  }, [router]);

  const loadComments = useCallback(async () => {
    const res = await fetch("/api/comments?mode=admin", { cache: "no-store" });
    if (res.status === 401) {
      router.push("/admin/login");
      return;
    }
    const data = await res.json();
    setComments(data.comments ?? []);
  }, [router]);

  const loadUsers = useCallback(async () => {
    const res = await fetch("/api/users", { cache: "no-store" });
    if (res.status === 401) {
      router.push("/admin/login");
      return;
    }
    const data = await res.json();
    setUsers(data.users ?? []);
  }, [router]);

  useEffect(() => {
    loadQuotes();
    loadComments();
    loadUsers();
  }, [loadQuotes, loadComments, loadUsers]);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    setError("");

    const res = await fetch("/api/quotes", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, scheduledDate }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Could not save.");
      return;
    }

    setText("");
    setScheduledDate("");
    setMessage("Quote scheduled.");
    await loadQuotes();
  }

  async function onDelete(id: number) {
    if (!confirm("Remove this scheduled quote?")) return;

    const res = await fetch(`/api/quotes?id=${id}`, {
      method: "DELETE",
      cache: "no-store",
    });
    if (!res.ok) {
      setError("Could not delete.");
      return;
    }
    await loadQuotes();
  }

  async function onLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  async function onReply(commentId: number) {
    const draft = replyDrafts[commentId]?.trim();
    if (!draft) return;

    const res = await fetch("/api/comments/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentId, message: draft }),
    });

    if (!res.ok) {
      setError("Could not save reply.");
      return;
    }

    setReplyDrafts((prev) => ({ ...prev, [commentId]: "" }));
    await loadComments();
  }

  async function onReplyToThread(commentId: number, parentReplyId: number, targetName?: string) {
    const key = `${commentId}-${parentReplyId}`;
    const draft = replyDrafts[key]?.trim();
    if (!draft) return;

    const res = await fetch("/api/comments/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentId, parentReplyId, message: draft, targetName }),
    });

    if (!res.ok) {
      setError("Could not save reply.");
      return;
    }

    setReplyDrafts((prev) => ({ ...prev, [key]: "" }));
    await loadComments();
  }

  async function onDeleteComment(commentId: number) {
    if (!confirm("Delete this comment?")) return;

    const res = await fetch(`/api/comments/${commentId}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Could not delete comment.");
      return;
    }

    await loadComments();
  }

  function renderReplyTree(reply: CommentReply, commentId: number, depth = 0, replyTargetName?: string) {
    const key = `${commentId}-${reply.id}`;

    return (
      <div
        key={reply.id}
        className={`rounded-lg border border-white/10 bg-white/[0.03] p-3 ${depth > 0 ? "ml-4" : ""}`}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-soft)]">
          {reply.author === "ag" ? "AG reply" : "User reply"}
        </p>
        <p className="mt-1 text-sm text-[var(--text)]">
          {reply.targetName ? `@${reply.targetName} ${reply.message}` : reply.message}
        </p>

        <div className="mt-3 space-y-2">
          <textarea
            value={replyDrafts[key] ?? ""}
            onChange={(e) =>
              setReplyDrafts((prev) => ({ ...prev, [key]: e.target.value }))
            }
            rows={3}
            placeholder="Reply to this thread…"
            className="w-full resize-y rounded-lg border border-white/10 bg-[var(--bg-deep)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
          <button
            type="button"
            onClick={() => onReplyToThread(commentId, reply.id, reply.targetName ?? replyTargetName)}
            className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-[var(--bg-deep)] hover:brightness-110"
          >
            Reply
          </button>
        </div>

        {reply.replies && reply.replies.length > 0 && (
          <div className="mt-3 space-y-2">
            {reply.replies.map((childReply) => renderReplyTree(childReply, commentId, depth + 1, reply.targetName ?? replyTargetName))}
          </div>
        )}
      </div>
    );
  }

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-6 py-12">
      <div className="mb-10 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-serif)] text-3xl text-[var(--accent-soft)]">
            AG dashboard
          </h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            One quote per calendar day. Visitors see today&apos;s message on the
            home page.
          </p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="shrink-0 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          Log out
        </button>
      </div>

      <form
        onSubmit={onAdd}
        className="mb-12 space-y-4 rounded-xl border border-white/10 bg-white/5 p-6"
      >
        <h2 className="text-sm font-medium uppercase tracking-wider text-[var(--text-muted)]">
          New quote
        </h2>
        <label className="block text-sm text-[var(--text-muted)]">
          Goes live on
          <input
            type="date"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            className="mt-2 w-full rounded-lg border border-white/10 bg-[var(--bg-deep)] px-4 py-3 text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
            required
          />
        </label>
        <label className="block text-sm text-[var(--text-muted)]">
          Quote
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="Write something that will lift someone today…"
            className="mt-2 w-full resize-y rounded-lg border border-white/10 bg-[var(--bg-deep)] px-4 py-3 text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
            required
          />
        </label>

        {error && (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        )}
        {message && <p className="text-sm text-emerald-400">{message}</p>}

        <button
          type="submit"
          className="rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--bg-deep)] hover:brightness-110"
        >
          Schedule
        </button>
      </form>

      <section className="mb-12">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-[var(--text-muted)]">
          Upcoming &amp; past
        </h2>
        {loading ? (
          <p className="text-sm text-[var(--text-muted)]">Loading…</p>
        ) : quotes.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            No quotes yet. Schedule your first one above.
          </p>
        ) : (
          <ul className="space-y-3">
            {quotes.map((q) => (
              <li
                key={q.id}
                className="flex gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-[var(--accent-soft)]">
                    {q.scheduledDate}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--text)]">
                    {q.text}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onDelete(q.id)}
                  className="shrink-0 self-start text-xs text-red-400/80 hover:text-red-400"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-12">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-[var(--text-muted)]">
          Account users
        </h2>
        {users.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No user accounts yet.</p>
        ) : (
          <ul className="space-y-3">
            {users.map((user) => (
              <li key={user.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--accent-soft)]">{user.username}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Joined {new Date(user.createdAt).toLocaleString()}
                  </p>
                </div>
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  User
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-12">
        <PrivateChat isAdmin={true} />
      </section>

      <section>
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-[var(--text-muted)]">
          Public comments
        </h2>
        {comments.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No comments yet.</p>
        ) : (
          <ul className="space-y-4">
            {comments.map((comment) => (
              <li key={comment.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--accent-soft)]">
                      {comment.userName}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {comment.isAnonymous ? "Anonymous" : "Public name"}
                    </p>
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">
                    {new Date(comment.createdAt).toLocaleString()}
                  </p>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-[var(--text)]">{comment.message}</p>
                {comment.replies.length > 0 && (
                  <div className="mt-4 space-y-2 rounded-lg border border-white/10 bg-[var(--bg-deep)]/70 p-3">
                    {comment.replies.map((reply) => renderReplyTree(reply, comment.id, 0, comment.userName))}
                  </div>
                )}
                <div className="mt-4 space-y-2">
                  <textarea
                    value={replyDrafts[comment.id] ?? ""}
                    onChange={(e) =>
                      setReplyDrafts((prev) => ({ ...prev, [comment.id]: e.target.value }))
                    }
                    rows={3}
                    placeholder="Reply publicly to this comment…"
                    className="w-full resize-y rounded-lg border border-white/10 bg-[var(--bg-deep)] px-4 py-3 text-sm text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => onReply(comment.id)}
                      className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--bg-deep)] hover:brightness-110"
                    >
                      Reply publicly
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteComment(comment.id)}
                      className="rounded-lg border border-red-400/40 px-4 py-2 text-sm text-red-400 hover:bg-red-400/10"
                    >
                      Delete comment
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link
        href="/"
        className="mt-12 inline-block text-sm text-[var(--text-muted)] hover:text-[var(--accent-soft)]"
      >
        View public site →
      </Link>
    </main>
  );
}
