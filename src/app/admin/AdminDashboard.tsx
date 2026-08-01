"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";

type Quote = {
  id: number;
  text: string;
  scheduledDate: string;
};

export default function AdminDashboard() {
  const router = useRouter();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [text, setText] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
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

  useEffect(() => {
    loadQuotes();
  }, [loadQuotes]);

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

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-6 py-12">
      <div className="mb-10 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-serif)] text-3xl text-[var(--accent-soft)]">
            Schedule quotes
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

      <section>
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

      <Link
        href="/"
        className="mt-12 inline-block text-sm text-[var(--text-muted)] hover:text-[var(--accent-soft)]"
      >
        View public site →
      </Link>
    </main>
  );
}
