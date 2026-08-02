import type { NextRequest } from "next/server";
import { createComment, listAllComments, listCommentsForQuote } from "@/lib/db";
import { getUserSession, requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const cookie = request.headers.get("cookie");

  const mode = request.nextUrl.searchParams.get("mode");
  if (mode === "admin") {
    const denied = await requireAdmin(cookie);
    if (denied) return denied;

    const comments = await listAllComments();
    return Response.json(
      { comments },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const quoteIdParam = request.nextUrl.searchParams.get("quoteId");
  if (!quoteIdParam) {
    return Response.json({ error: "quoteId is required" }, { status: 400 });
  }

  const quoteId = Number(quoteIdParam);
  if (!Number.isInteger(quoteId) || quoteId < 1) {
    return Response.json({ error: "Invalid quoteId" }, { status: 400 });
  }

  const comments = await listCommentsForQuote(quoteId);
  return Response.json(
    { comments },
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

  if (!session) {
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
    session.id,
    message,
    isAnonymous,
    session.username,
  );

  return Response.json({ comment }, { status: 201 });
}
