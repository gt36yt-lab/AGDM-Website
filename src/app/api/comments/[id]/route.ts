import type { NextRequest } from "next/server";
import { deleteComment } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookie = request.headers.get("cookie");
  const denied = await requireAdmin(cookie);
  if (denied) return denied;

  const { id } = await params;
  const commentId = Number(id);

  if (!Number.isInteger(commentId) || commentId < 1) {
    return Response.json({ error: "Invalid comment id" }, { status: 400 });
  }

  const deleted = await deleteComment(commentId);
  if (!deleted) {
    return Response.json({ error: "Comment not found" }, { status: 404 });
  }

  return Response.json({ ok: true });
}
