"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    setLoading(false);

    if (!res.ok) {
      setError("Wrong password. Try again.");
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-16">
      <h1 className="mb-2 font-[family-name:var(--font-serif)] text-3xl text-[var(--accent-soft)]">
        Admin
      </h1>
      <p className="mb-8 text-sm text-[var(--text-muted)]">
        Schedule daily motivation for your visitors.
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block text-sm text-[var(--text-muted)]">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-[var(--text)] outline-none ring-[var(--accent)] focus:ring-2"
            autoComplete="current-password"
            required
          />
        </label>

        {error && (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--bg-deep)] transition hover:brightness-110 disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <Link
        href="/"
        className="mt-10 text-center text-sm text-[var(--text-muted)] hover:text-[var(--accent-soft)]"
      >
        ← Back to site
      </Link>
    </main>
  );
}
