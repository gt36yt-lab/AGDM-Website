import { getUserSession, isAdminSession } from "@/lib/auth";
import { listUsers } from "@/lib/db";
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
