"use client";

import Image from "next/image";
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
    <main className="relative min-h-dvh overflow-hidden">
      <Image
        src="/images/admin-page.png"
        alt="Admin dashboard design"
        fill
        priority
        className="object-cover"
      />
      <div className="absolute inset-0 bg-black/15" />

      <div className="relative z-10 mx-auto min-h-dvh max-w-2xl px-6 py-12">
        <div className="mb-10 flex items-start justify-between gap-4 rounded-3xl border border-white/10 bg-[rgba(15,10,26,0.75)] p-6 shadow-2xl shadow-black/20 backdrop-blur-md">
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
          className="mb-12 space-y-4 rounded-3xl border border-white/10 bg-[rgba(15,10,26,0.75)] p-6 shadow-2xl shadow-black/20 backdrop-blur-md"
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

        <section className="mb-12 rounded-3xl border border-white/10 bg-[rgba(15,10,26,0.75)] p-6 shadow-2xl shadow-black/20 backdrop-blur-md">
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

        <section className="mb-12 rounded-3xl border border-white/10 bg-[rgba(15,10,26,0.75)] p-6 shadow-2xl shadow-black/20 backdrop-blur-md">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-[var(--text-muted)]">
            Public chat
          </h2>

          <form onSubmit={onSubmitChat} className="mb-4 space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <textarea
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              rows={4}
              placeholder="Write a public comment for the main page…"
              className="w-full resize-y rounded-lg border border-white/10 bg-[var(--bg-deep)] px-4 py-3 text-sm text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
              required
            />
            <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
              <input
                type="checkbox"
                checked={chatAnonymous}
                onChange={(e) => setChatAnonymous(e.target.checked)}
              />
              Post anonymously
            </label>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={chatLoading}
                className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--bg-deep)] hover:brightness-110 disabled:opacity-50"
              >
                {chatLoading ? "Posting…" : "Post comment"}
              </button>
              {chatStatus && <p className="text-sm text-emerald-400">{chatStatus}</p>}
            </div>
          </form>

          {chatMessages.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No public messages yet.</p>
          ) : (
            <ul className="space-y-3">
              {chatMessages.map((item) => (
                <li key={item.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[var(--accent-soft)]">{item.authorLabel}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-[var(--text-muted)]">{new Date(item.createdAt).toLocaleString()}</p>
                      {item.id.startsWith("comment-") && (
                        <button
                          type="button"
                          onClick={() => onDeleteComment(Number(item.id.replace("comment-", "")))}
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--text)]">
                    {item.targetName ? (
                      <>
                        <span className="font-semibold text-[var(--accent-soft)]">@{item.targetName}</span>{" "}
                        {renderMentionText(item.message)}
                      </>
                    ) : (
                      renderMentionText(item.message)
                    )}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mb-12 rounded-3xl border border-white/10 bg-[rgba(15,10,26,0.75)] p-6 shadow-2xl shadow-black/20 backdrop-blur-md">
          <PrivateChat isAdmin={true} />
        </section>

        <section className="rounded-3xl border border-white/10 bg-[rgba(15,10,26,0.75)] p-6 shadow-2xl shadow-black/20 backdrop-blur-md">
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
                  <button
                    type="button"
                    onClick={() => onDeleteUser(user.id, user.username)}
                    className="rounded-full border border-red-400/30 px-3 py-1 text-xs uppercase tracking-[0.2em] text-red-400 hover:bg-red-400/10"
                  >
                    Delete
                  </button>
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
      </div>
    </main>
  );
}
