"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function AccountLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    <main className="min-h-dvh bg-[linear-gradient(180deg,#060721_0%,#111e4d_26%,#5b6e9e_62%,#eff2f8_100%)] px-4 py-10 text-[var(--text)]">
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
              <p className="text-xs uppercase tracking-[0.4em] text-[var(--text-muted)] [text-shadow:0px_1px_2px_rgba(0,0,0,0.25)]">AG Daily Motivation</p>
              <h1 className="mt-2 text-3xl font-[family-name:var(--font-serif)] [text-shadow:0px_2px_4px_rgba(0,0,0,0.32)]">Sign in to access</h1>
            </div>
          </div>
          <div className="mt-10 space-y-4 text-sm text-[var(--text-muted)] [text-shadow:0px_1px_2px_rgba(0,0,0,0.22)]">
            <p>Join a calm, daily motivation space built to help you start each morning with clarity. Sign in to view the quote of the day, join the community chat, and send private messages to AG — all while keeping your own username.</p>
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
              <div className="mt-3 flex items-center gap-3 rounded-3xl border border-white/10 bg-white/10 px-4 py-4">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-[var(--text)] outline-none"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="text-sm font-semibold text-[var(--text-muted)] transition hover:text-[var(--accent-soft)]"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
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

      <section className="mx-auto mt-12 max-w-6xl rounded-[2rem] border border-white/10 bg-white/5 p-10 shadow-[0_40px_120px_rgba(0,0,0,0.15)] backdrop-blur-xl">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_0.9fr]">
          <div className="rounded-[2rem] bg-[rgba(255,255,255,0.06)] p-10 text-center shadow-inner shadow-black/10">
            <h2 className="text-4xl font-[family-name:var(--font-serif)] leading-tight sm:text-5xl">
              A GOOD DAY STARTS WITH A POSITIVE ATTITUDE
            </h2>
          </div>

          <div className="space-y-8 text-sm text-[var(--text-muted)]">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-[var(--accent-soft)]">Ali&apos;s Place</p>
              <p className="mt-4 leading-relaxed text-[var(--text)]">
                What began as a simple coding project evolved into a personal sanctuary for daily inspiration. I once stumbled upon a quote William Hazlitt wrote. It said, “A gentle word, a kind look, a good-natured smile can work wonders and accomplish miracles.” That idea stayed with me. I created this space to ground myself with daily words to live by, and to offer a gentle pause for anyone else who might need it. Welcome to my little corner of motivation. I hope it brightens your day as much as it does mine.
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-[var(--accent-soft)]">My Socials</p>
              <ul className="mt-4 space-y-3 text-sm">
                <li>
                  <a href="https://www.tiktok.com/@gt36yt" target="_blank" rel="noreferrer" className="text-[var(--text)] hover:text-[var(--accent-soft)]">
                    TikTok · https://www.tiktok.com/@gt36yt
                  </a>
                </li>
                <li>
                  <a href="https://www.facebook.com/ali.rabaya.940/" target="_blank" rel="noreferrer" className="text-[var(--text)] hover:text-[var(--accent-soft)]">
                    Facebook · https://www.facebook.com/ali.rabaya.940/
                  </a>
                </li>
                <li>
                  <a href="https://www.instagram.com/alirabaya123" target="_blank" rel="noreferrer" className="text-[var(--text)] hover:text-[var(--accent-soft)]">
                    Instagram · https://www.instagram.com/alirabaya123
                  </a>
                </li>
                <li>
                  <a href="https://github.com/gt36yt-lab" target="_blank" rel="noreferrer" className="text-[var(--text)] hover:text-[var(--accent-soft)]">
                    GitHub · https://github.com/gt36yt-lab
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
