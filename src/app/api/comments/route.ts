import type { NextRequest } from "next/server";
import { createComment, enrichCommentsWithStreaks, listAllComments, listCommentsForQuote, setUserStreakOverride } from "@/lib/db";
import { getQuoteTimezone, todayInTimezone } from "@/lib/dates";
import { getUserSession, requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatDateKey(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export async function GET(request: NextRequest) {
  const cookie = request.headers.get("cookie");

  const mode = request.nextUrl.searchParams.get("mode");
  if (mode === "admin") {
    const denied = await requireAdmin(cookie);
    if (denied) return denied;

    const selectedDate = request.nextUrl.searchParams.get("date") ?? todayInTimezone(getQuoteTimezone());
    const dateKey = String(selectedDate);

    // Compute streaks from the full comment history so per-day admin views
    // don't accidentally compute streaks from a partial dataset and reset
    // persisted values. Then filter the enriched comments to the requested
    // date for display.
    const allComments = await listAllComments();
    const { comments: allWithStreaks, streaks } = await enrichCommentsWithStreaks(allComments);
    const commentsForDate = (allWithStreaks ?? []).filter(
      (comment) => formatDateKey(comment.createdAt, getQuoteTimezone()) === dateKey,
    );

    return Response.json(
      { comments: commentsForDate, streaks },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const quoteIdParam = request.nextUrl.searchParams.get("quoteId");
  const selectedDate = request.nextUrl.searchParams.get("date");

  if (!quoteIdParam) {
    return Response.json({ error: "quoteId is required" }, { status: 400 });
  }

  const quoteId = Number(quoteIdParam);
  if (!Number.isInteger(quoteId) || quoteId < 1) {
    return Response.json({ error: "Invalid quoteId" }, { status: 400 });
  }

  const comments = await listCommentsForQuote(quoteId);
  const filteredByDate = selectedDate
    ? comments.filter((comment) => formatDateKey(comment.createdAt, getQuoteTimezone()) === String(selectedDate))
    : comments;

  const { comments: withStreaks } = await enrichCommentsWithStreaks(filteredByDate);
  return Response.json(
    { comments: withStreaks },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function POST(request: NextRequest) {
  const cookie = request.headers.get("cookie");
  const session = await getUserSession(cookie);
  const adminCheck = await requireAdmin(cookie);
  const isAdmin = !adminCheck;

  if (!session && !isAdmin) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { quoteId?: number; message?: string; isAnonymous?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const quoteId = Number(body.quoteId);
  const message = (body.message ?? "").trim();
  const isAnonymous = Boolean(body.isAnonymous);

  if (!Number.isInteger(quoteId) || quoteId < 1) {
    return Response.json({ error: "Invalid quoteId" }, { status: 400 });
  }

  if (!message) {
    return Response.json({ error: "Please write a comment." }, { status: 400 });
  }

  const comment = await createComment(
    quoteId,
    session?.id ?? 0,
    message,
    isAnonymous,
    isAdmin ? 'AG' : (session?.username ?? 'User'),
  );

  return Response.json({ comment }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const cookie = request.headers.get("cookie");
  const denied = await requireAdmin(cookie);
  if (denied) return denied;

  let body: { commentId?: number; userId?: number; username?: string; streak?: number };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const streak = Number(body.streak);
  if (!Number.isInteger(streak) || streak < 0) {
    return Response.json({ error: "Invalid streak" }, { status: 400 });
  }

  const commentId = Number.isInteger(Number(body.commentId)) ? Number(body.commentId) : undefined;
  if (!commentId) {
    return Response.json({ error: "commentId is required" }, { status: 400 });
  }

  const username = String(body.username ?? "").trim();
  const userId = Number.isInteger(Number(body.userId)) ? Number(body.userId) : undefined;

  const changed = await setUserStreakOverride(commentId, userId, username, streak);
  if (!changed) {
    return Response.json({ error: "Could not save streak override" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
