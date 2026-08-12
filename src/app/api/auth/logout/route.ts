import { clearSessionCookie, clearUserSessionCookie } from "@/lib/auth";

export async function POST() {
  return new Response(null, {
    status: 302,
    headers: {
      Location: "/account/login",
      "Set-Cookie": [clearUserSessionCookie(), clearSessionCookie()].join(", "),
    },
  });
}
