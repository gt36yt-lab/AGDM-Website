import type { NextRequest } from "next/server";
import {
  createSessionCookie,
  verifyAdminPassword,
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const password = body.password ?? "";
  if (!verifyAdminPassword(password)) {
    return Response.json({ error: "Wrong password" }, { status: 401 });
  }

  const cookie = await createSessionCookie();
  return Response.json(
    { ok: true },
    { headers: { "Set-Cookie": cookie } },
  );
}
