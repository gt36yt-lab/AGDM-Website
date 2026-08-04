"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import PrivateChat from "@/app/components/PrivateChat";
import { getQuoteTimezone, todayInTimezone } from "@/lib/dates";

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

type UserAccount = {
  id: number;
  username: string;
  createdAt: string;
};

type ChatMessageRow = {
  id: string;
  authorLabel: string;
  createdAt: string;
  message: string;
  targetName?: string;
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
  const [chatStatus, setChatStatus] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [chatAnonymous, setChatAnonymous] = useState(false);
  const [activeQuoteId, setActiveQuoteId] = useState<number | null>(null);
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

  useEffect(() => {
    const timezone = getQuoteTimezone();
    const today = todayInTimezone(timezone);

    const exactMatch = quotes.find((quote) => quote.scheduledDate === today);
    if (exactMatch) {
      setActiveQuoteId(exactMatch.id);
      return;
    }

    const latestMatch = [...quotes]
      .filter((quote) => quote.scheduledDate <= today)
      .sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate))[0];

    setActiveQuoteId(latestMatch?.id ?? null);
  }, [quotes]);

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
    await loadComments();
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

  async function onSubmitChat(e: FormEvent) {
    e.preventDefault();
    if (!chatMessage.trim()) return;

    setChatLoading(true);
    setChatStatus("");

    const targetQuoteId = activeQuoteId ?? 1;

    const res = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quoteId: targetQuoteId, message: chatMessage, isAnonymous: chatAnonymous }),
    });

    setChatLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setChatStatus(data.error ?? "Could not post comment.");
      return;
    }

    setChatMessage("");
    setChatAnonymous(false);
    setChatStatus("Message posted.");
    await loadComments();
  }

  async function onDeleteComment(commentId: number) {
    if (!confirm("Delete this comment?")) return;

    const res = await fetch(`/api/comments/${commentId}`, { method: "DELETE" });
    if (!res.ok) {
      setChatStatus("Could not delete comment.");
      return;
    }

    setChatStatus("Comment deleted.");
    await loadComments();
  }

  async function onDeleteUser(userId: number, username: string) {
    if (!confirm(`Delete account "${username}"?`)) return;

    const res = await fetch(`/api/users?id=${userId}`, { method: "DELETE", cache: "no-store" });
    if (!res.ok) {
      setError("Could not delete account.");
      return;
    }

    setMessage(`Deleted account ${username}.`);
    await loadUsers();
  }

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

  function flattenCommentFeed(replies: CommentReply[]): ChatMessageRow[] {
    return replies.flatMap((reply) => {
      const rows: ChatMessageRow[] = [
        {
          id: `reply-${reply.id}`,
          authorLabel: reply.author === "ag" ? "AG" : reply.authorName || "User",
          createdAt: reply.createdAt,
          message: reply.message,
          targetName: reply.targetName,
        },
      ];

      if (reply.replies && reply.replies.length > 0) {
        rows.push(...flattenCommentFeed(reply.replies));
      }

      return rows;
    });
  }

  const chatMessages = comments
    .flatMap((comment) => {
      const rows: ChatMessageRow[] = [
        {
          id: `comment-${comment.id}`,
          authorLabel: comment.isAnonymous ? "Anonymous" : comment.userName,
          createdAt: comment.createdAt,
          message: comment.message,
        },
      ];

      if (comment.replies && comment.replies.length > 0) {
        rows.push(...flattenCommentFeed(comment.replies));
      }

      return rows;
    })
    .sort((a, b) => {
      const timeDelta = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (timeDelta !== 0) return timeDelta;
      return a.id.localeCompare(b.id);
    });

  return (
    <main className="min-h-dvh bg-[linear-gradient(180deg,#060721_0%,#111e4d_26%,#5b6e9e_62%,#eff2f8_100%)] px-4 py-10 text-[var(--text)]">
      <div className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-10">
        <header className="flex flex-col gap-6 rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-[0_40px_120px_rgba(0,0,0,0.15)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-[var(--text-muted)]">AG Dashboard</p>
            <h1 className="mt-3 text-4xl font-[family-name:var(--font-serif)] sm:text-5xl">One quote per calendar day.</h1>
            <p className="mt-2 text-sm text-[var(--text-muted)]">Visitors see today&apos;s message on the home page.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onLogout}
              className="rounded-full border border-white/10 bg-[var(--accent)]/10 px-5 py-3 text-sm text-[var(--accent-soft)] transition hover:bg-[var(--accent)]/20"
            >
              Log out
            </button>
            <Link
              href="/"
              className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm text-[var(--text)] transition hover:bg-white/10"
            >
              Public site
            </Link>
          </div>
        </header>

        <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-[0_40px_120px_rgba(0,0,0,0.15)] backdrop-blur-xl">
          <h2 className="mb-6 text-sm font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">New quote</h2>
          <form className="grid gap-5 sm:grid-cols-[1fr_1.4fr]" onSubmit={onAdd}>
            <label className="text-sm text-[var(--text-muted)]">
              Goes live on
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="mt-3 w-full rounded-3xl border border-white/10 bg-[var(--bg-deep)]/80 px-4 py-4 text-sm text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
                required
              />
            </label>
            <label className="text-sm text-[var(--text-muted)]">
              Quote
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                placeholder="Write something that will life someone today"
                className="mt-3 w-full rounded-3xl border border-white/10 bg-[var(--bg-deep)]/80 px-4 py-4 text-sm text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
                required
              />
            </label>
            <div className="flex items-end justify-end">
              <button type="submit" className="rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-[var(--bg-deep)] transition hover:brightness-110">
                Schedule
              </button>
            </div>
          </form>
          {(error || message) && (
            <p className={`mt-4 text-sm ${error ? "text-red-400" : "text-emerald-400"}`}>
              {error || message}
            </p>
          )}
        </section>

        <section className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-[0_40px_120px_rgba(0,0,0,0.15)] backdrop-blur-xl">
            <h2 className="mb-6 text-sm font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">Upcoming &amp; past</h2>
            {loading ? (
              <p className="text-sm text-[var(--text-muted)]">Loading…</p>
            ) : quotes.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">No quotes yet. Schedule your first one above.</p>
            ) : (
              <ul className="space-y-4">
                {quotes.map((q) => (
                  <li key={q.id} className="rounded-[1.75rem] border border-white/10 bg-[var(--bg-deep)]/80 p-5">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-sm uppercase tracking-[0.2em] text-[var(--accent-soft)]">{q.scheduledDate}</p>
                      <button
                        type="button"
                        onClick={() => onDelete(q.id)}
                        className="text-xs uppercase tracking-[0.2em] text-red-300 hover:text-red-200"
                      >
                        Delete
                      </button>
                    </div>
                    <p className="mt-4 text-base leading-relaxed text-[var(--text)]">“{q.text}”</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-8">
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-[0_40px_120px_rgba(0,0,0,0.15)] backdrop-blur-xl">
              <h2 className="mb-6 text-sm font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">Public chat</h2>
              <form onSubmit={onSubmitChat} className="space-y-4">
                <textarea
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  rows={4}
                  placeholder="Write a public comment for the main page…"
                  className="w-full resize-y rounded-3xl border border-white/10 bg-[var(--bg-deep)]/80 px-4 py-4 text-sm text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  required
                />
                <label className="inline-flex items-center gap-3 text-sm text-[var(--text-muted)]">
                  <input
                    type="checkbox"
                    checked={chatAnonymous}
                    onChange={(e) => setChatAnonymous(e.target.checked)}
                    className="h-4 w-4 rounded border-white/10 bg-slate-900 text-[var(--accent)] focus:ring-[var(--accent)]"
                  />
                  Post anonymously
                </label>
                <div className="flex items-center justify-between gap-4">
                  <button
                    type="submit"
                    disabled={chatLoading}
                    className="rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-[var(--bg-deep)] transition hover:brightness-110 disabled:opacity-60"
                  >
                    {chatLoading ? "Posting…" : "Send message"}
                  </button>
                  {chatStatus && <p className="text-sm text-emerald-400">{chatStatus}</p>}
                </div>
              </form>

              {chatMessages.length === 0 ? (
                <p className="mt-6 text-sm text-[var(--text-muted)]">No messages yet.</p>
              ) : (
                <ul className="mt-6 space-y-4">
                  {chatMessages.map((item) => (
                    <li key={item.id} className="rounded-3xl border border-white/10 bg-[var(--bg-deep)]/80 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent-soft)]">{item.authorLabel}</p>
                        <p className="text-xs text-[var(--text-muted)]">{new Date(item.createdAt).toLocaleString()}</p>
                      </div>
                      <p className="mt-3 text-sm leading-relaxed text-[var(--text)]">
                        {item.targetName ? (
                          <><span className="font-semibold text-[var(--accent-soft)]">@{item.targetName}</span>{" "}{renderMentionText(item.message)}</>
                        ) : (
                          renderMentionText(item.message)
                        )}
                      </p>
                      {item.id.startsWith("comment-") && (
                        <button
                          type="button"
                          onClick={() => onDeleteComment(Number(item.id.replace("comment-", "")))}
                          className="mt-3 text-xs uppercase tracking-[0.2em] text-red-300 hover:text-red-200"
                        >
                          Delete
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-[0_40px_120px_rgba(0,0,0,0.15)] backdrop-blur-xl">
              <div className="mb-6 flex items-center justify-between gap-4">
                <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">Account users</h2>
                <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-[var(--accent-soft)]">{users.length}</span>
              </div>
              {users.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">No user accounts yet.</p>
              ) : (
                <ul className="space-y-4">
                  {users.map((user) => (
                    <li key={user.id} className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-[var(--bg-deep)]/80 p-4">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-[var(--accent-soft)]">{user.username}</p>
                          <p className="text-xs text-[var(--text-muted)]">Joined {new Date(user.createdAt).toLocaleString()}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onDeleteUser(user.id, user.username)}
                          className="rounded-full border border-red-400/30 px-4 py-2 text-xs uppercase tracking-[0.2em] text-red-400 hover:bg-red-400/10"
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-[0_40px_120px_rgba(0,0,0,0.15)] backdrop-blur-xl">
          <PrivateChat isAdmin={true} />
        </section>
      </div>
    </main>
  );
}
