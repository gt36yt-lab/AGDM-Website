import { NextRequest } from "next/server";
import { createUserSessionCookie } from "@/lib/auth";
import { createUser, getUserByUsername, verifyUserPassword } from "@/lib/db";

export async function POST(request: NextRequest) {
  let body: { username?: string; password?: string; mode?: "login" | "signup" };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const username = (body.username ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const mode = body.mode ?? "login";

  if (!username || password.length < 4) {
    return Response.json({ error: "Username and password are required." }, { status: 400 });
  }

  if (mode === "signup") {
    try {
      const user = await createUser(username, password);
      const cookie = await createUserSessionCookie(user.id, user.username);
      return Response.json(
        { ok: true, user: { id: user.id, username: user.username } },
        { headers: { "Set-Cookie": cookie } },
      );
    } catch (error) {
      if (error instanceof Error && error.message === "USERNAME_TAKEN") {
        return Response.json({ error: "That username is already taken." }, { status: 409 });
      }
      return Response.json({ error: "Could not create account." }, { status: 500 });
    }
  }

  const user = await getUserByUsername(username);
  if (!user || !(await verifyUserPassword(user.id, password))) {
    return Response.json({ error: "Invalid username or password." }, { status: 401 });
  }

  const cookie = await createUserSessionCookie(user.id, user.username);
  return Response.json(
    { ok: true, user: { id: user.id, username: user.username } },
    { headers: { "Set-Cookie": cookie } },
  );
}
