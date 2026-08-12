import type { NextRequest } from "next/server";
import { createReply } from "@/lib/db";
import { getUserSession, requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  const cookie = request.headers.get("cookie");
  const session = await getUserSession(cookie);
  const adminCheck = await requireAdmin(cookie);
  const isAdmin = !adminCheck;

  if (!session && !isAdmin) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { commentId?: number; parentReplyId?: number; message?: string; authorName?: string; targetName?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const commentId = Number(body.commentId);
  const parentReplyId = Number(body.parentReplyId);
  const message = (body.message ?? "").trim();
  const authorName = (body.authorName ?? "").trim();
  const targetName = (body.targetName ?? "").trim();

  if (!Number.isInteger(commentId) || commentId < 1) {
    return Response.json({ error: "Invalid commentId" }, { status: 400 });
  }

  if (!message) {
    return Response.json({ error: "Please write a reply." }, { status: 400 });
  }

  if (!isAdmin && (!Number.isInteger(parentReplyId) || parentReplyId < 1)) {
    return Response.json({ error: "Invalid reply target" }, { status: 400 });
  }

  const reply = await createReply(
    commentId,
    message,
    isAdmin ? "ag" : "user",
    isAdmin ? undefined : parentReplyId,
    authorName || (isAdmin ? "AG" : session?.username || undefined),
    targetName || undefined,
    isAdmin ? undefined : session?.id,
    isAdmin ? undefined : session?.username,
  );

  return Response.json({ reply });
}
