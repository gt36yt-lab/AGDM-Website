import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  formatDisplayDate,
  getQuoteTimezone,
  todayInTimezone,
} from "@/lib/dates";
import { getLatestQuoteOnOrBefore, getQuoteForDate } from "@/lib/db";
import { getUserSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  const cookie = (await headers()).get("cookie");
  const session = await getUserSession(cookie);

  if (!session) {
    redirect("/account/login");
  }

  const tz = getQuoteTimezone();
  const today = todayInTimezone(tz);
  const exact = await getQuoteForDate(today);
  const quote = exact ?? await getLatestQuoteOnOrBefore(today);
  const displayDate = formatDisplayDate(today, tz);

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-8 flex items-center gap-3 text-sm text-[var(--text-muted)]">
        <span>
          Signed in as <span className="font-semibold text-[var(--accent-soft)]">{session.username}</span>
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
        <blockquote className="relative px-4">
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
        <div className="max-w-md space-y-4">
          <p className="font-[family-name:var(--font-serif)] text-2xl text-[var(--text-muted)]">
            Something good is on its way.
          </p>
          <p className="text-sm text-[var(--text-muted)]">
            Check back soon for today&apos;s motivation from AG.
          </p>
        </div>
      )}

      <footer className="mt-20 text-xs text-[var(--text-muted)] opacity-60">
        With care, AG
      </footer>
    </main>
  );
}
