import { getUserSession, isAdminSession, requireAdmin } from "@/lib/auth";
import { deleteUser, listUsers } from "@/lib/db";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const cookie = request.headers.get("cookie");
  const isAdmin = await isAdminSession(cookie);
  const session = await getUserSession(cookie);

  if (!isAdmin && !session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await listUsers();
  return Response.json({ users });
}

export async function DELETE(request: NextRequest) {
  const denied = await requireAdmin(request.headers.get("cookie"));
  if (denied) return denied;

  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id < 1) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  const deleted = await deleteUser(id);
  if (!deleted) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  return Response.json({ ok: true });
}
