import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  formatDisplayDate,
  getQuoteTimezone,
  todayInTimezone,
} from "@/lib/dates";
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
  const quote = exact ?? await getLatestQuoteOnOrBefore(today);
  const displayDate = formatDisplayDate(today, tz);

  return (
    <main className="relative min-h-dvh overflow-hidden">
      <Image
        src="/images/main-page.png"
        alt="Main page design"
        fill
        priority
        className="object-cover"
      />
      <div className="absolute inset-0 bg-black/15" />

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-2xl flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-8 flex flex-wrap items-center justify-center gap-3 rounded-full border border-white/10 bg-[rgba(15,10,26,0.7)] px-4 py-2 text-sm text-[var(--text-muted)] backdrop-blur-md">
          <span>
            Signed in as <span className="font-semibold text-[var(--accent-soft)]">{isAdmin ? "AG" : session?.username}</span>
          </span>
          <Link href="/profile" className="text-xs text-[var(--text-muted)] hover:text-[var(--accent-soft)]">
            View profile
          </Link>
          <form action="/api/auth/logout" method="post">
            <button type="submit" className="text-xs text-[var(--text-muted)] hover:text-[var(--accent-soft)]">
              Sign out
            </button>
          </form>
        </div>
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.25em] text-[var(--text-muted)]">
          AG Daily Motivation
        </p>
        <p className="mb-12 text-sm text-[var(--accent-soft)]">{displayDate}</p>

        {quote ? (
          <blockquote className="relative rounded-3xl border border-white/10 bg-[rgba(15,10,26,0.75)] px-6 py-8 shadow-2xl shadow-black/20 backdrop-blur-md">
            <span
              className="quote-mark absolute -left-2 -top-8 text-7xl leading-none select-none"
              aria-hidden
            >
              &ldquo;
            </span>
            <p
              className="font-[family-name:var(--font-serif)] text-3xl leading-snug font-normal text-[var(--text)] sm:text-4xl sm:leading-snug"
            >
              {quote.text}
            </p>
            <span
              className="quote-mark mt-2 block text-right text-5xl leading-none select-none"
              aria-hidden
            >
              &rdquo;
            </span>
            {!exact && (
              <p className="mt-8 text-sm text-[var(--text-muted)]">
                No new message for today yet — showing the most recent one.
              </p>
            )}
          </blockquote>
        ) : (
          <div className="max-w-md space-y-4 rounded-3xl border border-white/10 bg-[rgba(15,10,26,0.75)] px-6 py-8 shadow-2xl shadow-black/20 backdrop-blur-md">
            <p className="font-[family-name:var(--font-serif)] text-2xl text-[var(--text-muted)]">
              Something good is on its way.
            </p>
            <p className="text-sm text-[var(--text-muted)]">
              Check back soon for today&apos;s motivation from AG.
            </p>
          </div>
        )}

        {quote && (
          <>
            <div className="mt-8 w-full rounded-3xl border border-white/10 bg-[rgba(15,10,26,0.75)] p-4 shadow-2xl shadow-black/20 backdrop-blur-md">
              <CommentBox quoteId={quote.id} isSignedIn={Boolean(session || isAdmin)} />
            </div>
            <div className="mt-6 w-full rounded-3xl border border-white/10 bg-[rgba(15,10,26,0.75)] p-4 shadow-2xl shadow-black/20 backdrop-blur-md">
              <PrivateChat isAdmin={false} />
            </div>
          </>
        )}

        <footer className="mt-20 text-xs text-[var(--text-muted)] opacity-60">
          With care, AG
        </footer>
      </div>
    </main>
  );
}
