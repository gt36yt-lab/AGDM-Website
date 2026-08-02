import type { NextRequest } from "next/server";
import { createReply } from "@/lib/db";
import { getUserSession, requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  const cookie = request.headers.get("cookie");
  const session = await getUserSession(cookie);
  const denied = await requireAdmin(cookie);

  if (!session && denied) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { commentId?: number; message?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const commentId = Number(body.commentId);
  const message = (body.message ?? "").trim();

  if (!Number.isInteger(commentId) || commentId < 1) {
    return Response.json({ error: "Invalid commentId" }, { status: 400 });
  }

  if (!message) {
    return Response.json({ error: "Please write a reply." }, { status: 400 });
  }

  const reply = await createReply(commentId, message);
  return Response.json({ reply });
}
