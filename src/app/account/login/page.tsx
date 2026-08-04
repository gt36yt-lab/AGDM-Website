"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function AccountLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, mode }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Please try again.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="min-h-dvh bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),_transparent_28%),linear-gradient(180deg,#02021c_0%,#2a2744_38%,#6c6c91_100%)] px-4 py-10 text-[var(--text)]">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.5fr_1fr]">
        <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-[0_40px_120px_rgba(0,0,0,0.15)] backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-200/15 shadow-[0_0_60px_rgba(255,255,255,0.08)]">
            <Image
              src="/images/logo.jpg"
              alt="AG logo"
              width={48}
              height={48}
              className="object-contain rounded-full"
            />
          </div>
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-[var(--text-muted)]">AG Daily Motivation</p>
              <h1 className="mt-2 text-3xl font-[family-name:var(--font-serif)]">Sign In to access</h1>
            </div>
          </div>
          <div className="mt-10 space-y-4 text-sm text-[var(--text-muted)]">
            <p>Create your own account with a username and password. No gmail required.</p>
            <p>Use the fields on the right to sign in or create an account.</p>
          </div>
          <div className="mt-10 rounded-[1.75rem] border border-white/10 bg-white/5 p-6 shadow-inner shadow-black/10">
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-muted)]">Quick intro</p>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-[var(--text-muted)]">
              <li>Daily quote view after login.</li>
              <li>Chat with the community and message AG privately.</li>
              <li>Create an account and keep your username.</li>
            </ul>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-[0_40px_120px_rgba(0,0,0,0.15)] backdrop-blur-xl">
          <div className="mb-8 flex items-center gap-2 rounded-full border border-white/10 bg-black/70 p-1">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`flex-1 rounded-full px-5 py-3 text-sm font-semibold transition ${
                mode === "login" ? "bg-[var(--text)] text-[var(--bg-deep)]" : "text-[var(--text-muted)]"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 rounded-full px-5 py-3 text-sm font-semibold transition ${
                mode === "signup" ? "bg-[var(--text)] text-[var(--bg-deep)]" : "text-[var(--text-muted)]"
              }`}
            >
              Create account
            </button>
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label className="block text-sm uppercase tracking-[0.25em] text-[var(--text-muted)]">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-3 w-full rounded-3xl border border-white/10 bg-white/10 px-4 py-4 text-sm text-[var(--text)] outline-none ring-[var(--accent)] transition focus:ring-2"
                autoComplete="username"
                required
              />
            </div>

            <div>
              <label className="block text-sm uppercase tracking-[0.25em] text-[var(--text-muted)]">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-3 w-full rounded-3xl border border-white/10 bg-white/10 px-4 py-4 text-sm text-[var(--text)] outline-none ring-[var(--accent)] transition focus:ring-2"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-3xl bg-[var(--accent)] px-6 py-4 text-sm font-semibold text-[var(--bg-deep)] transition hover:brightness-110 disabled:opacity-60"
            >
              {loading ? "Please wait…" : mode === "login" ? "Login" : "Create account"}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between text-sm text-[var(--text-muted)]">
            <Link href="/" className="hover:text-[var(--accent-soft)]">
              Home
            </Link>
            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="font-semibold text-[var(--text)] hover:text-[var(--accent-soft)]"
            >
              {mode === "login" ? "Sign up" : "Sign in"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
