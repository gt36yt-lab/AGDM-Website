import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { formatDisplayDate, getQuoteTimezone, todayInTimezone } from "@/lib/dates";
import { getLatestQuoteOnOrBefore, getQuoteForDate } from "@/lib/db";
import { getUserSession, isAdminSession } from "@/lib/auth";
import CommentBox from "@/app/components/CommentBox";
import PrivateChat from "@/app/components/PrivateChat";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  const cookie = (await headers()).get("cookie");
  const isAdmin = await isAdminSession(cookie);
  const session = await getUserSession(cookie);

  if (!session && !isAdmin) {
    redirect("/account/login");
  }

  const tz = getQuoteTimezone();
  const today = todayInTimezone(tz);
  const exact = await getQuoteForDate(today);
  const quote = exact ?? (await getLatestQuoteOnOrBefore(today));
  const displayDate = formatDisplayDate(today, tz);

  return (
    <main className="min-h-dvh bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),_transparent_28%),linear-gradient(180deg,#02021c_0%,#2a2744_38%,#6c6c91_100%)] px-4 text-[var(--text)]">
      <div className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-10 py-10 sm:py-14">
        <header className="flex flex-col items-center gap-6 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-200/15 shadow-[0_0_80px_rgba(255,255,255,0.08)]">
            <Image
              src="/images/logo.jpg"
              alt="AG logo"
              width={64}
              height={64}
              className="object-contain rounded-full"
            />
          </div>
          <p className="text-xs uppercase tracking-[0.4em] text-[var(--text-muted)]">
            AG Daily Motivation
          </p>
          <div className="space-y-1">
            <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-muted)]">{displayDate}</p>
            <h1 className="text-5xl font-[family-name:var(--font-serif)] leading-[0.95] sm:text-6xl">
              {quote?.text ?? "Life Goes On"}
            </h1>
          </div>
          <p className="text-sm text-[var(--text-muted)]">AG&apos;s Quote of the Day</p>
          <p className="text-base italic text-[var(--accent-soft)]">With care, AG</p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/profile" className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm text-[var(--text)] shadow-sm hover:bg-white/10">
              Profile
            </Link>
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="rounded-full border border-[var(--accent)] bg-[var(--accent)]/10 px-5 py-3 text-sm text-[var(--accent-soft)] transition hover:bg-[var(--accent)]/20"
              >
                Sign out
              </button>
            </form>
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,0.6fr)]">
          <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_40px_120px_rgba(0,0,0,0.15)] backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">Message AG</p>
                <p className="text-xs text-[var(--text-muted)]">Send a private message to AG.</p>
              </div>
              <span className="rounded-full bg-white/5 px-3 py-1 text-[var(--accent-soft)]">Private</span>
            </div>
            <PrivateChat isAdmin={false} />
          </section>

          <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_40px_120px_rgba(0,0,0,0.15)] backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">Community Chat</p>
                <p className="text-xs text-[var(--text-muted)]">Write a message or mention someone with @username.</p>
              </div>
              <div className="rounded-full bg-white/5 px-3 py-1 text-[var(--accent-soft)]">Live</div>
            </div>
            <CommentBox quoteId={quote?.id ?? 1} isSignedIn={Boolean(session || isAdmin)} />
          </section>
        </div>
      </div>
    </main>
  );
}
