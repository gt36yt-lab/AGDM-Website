import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getUserSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProfilePage() {
  const cookie = (await headers()).get("cookie");
  const session = await getUserSession(cookie);

  if (!session) {
    redirect("/account/login");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-6 py-16">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--text-muted)]">
            Profile
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-serif)] text-3xl text-[var(--accent-soft)]">
            Your account
          </h1>
        </div>

        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            className="text-sm text-[var(--text-muted)] hover:text-[var(--accent-soft)]"
          >
            Sign out
          </button>
        </form>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--text-muted)]">
          Username
        </p>
        <p className="mt-3 font-[family-name:var(--font-serif)] text-2xl text-[var(--text)]">
          {session.username}
        </p>
        <p className="mt-4 text-sm leading-relaxed text-[var(--text-muted)]">
          This is the name used to identify your account on the site.
        </p>
      </section>

      <div className="mt-8 flex gap-3">
        <Link
          href="/"
          className="text-sm text-[var(--text-muted)] hover:text-[var(--accent-soft)]"
        >
          ← Back to home
        </Link>
      </div>
    </main>
  );
}
