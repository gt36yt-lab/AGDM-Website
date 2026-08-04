import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { formatDisplayDate, getQuoteTimezone, todayInTimezone } from "@/lib/dates";
import { getLatestQuoteOnOrBefore, getQuoteForDate } from "@/lib/db";
import { getUserSession, isAdminSession } from "@/lib/auth";

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
    <main className="min-h-screen w-full bg-white">
      <iframe
        src="/images/main-page.html"
        title="Main page"
        className="h-screen w-full border-0"
        style={{ display: "block" }}
      />
    </main>
  );
}
