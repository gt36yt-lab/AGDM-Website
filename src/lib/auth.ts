const COOKIE_NAME = "ag_admin_session";

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET must be set (at least 16 characters).");
  }
  return secret;
}

function getAdminPassword(): string {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error("ADMIN_PASSWORD must be set in .env");
  }
  return password;
}

function toBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

function fromBase64Url(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return `${payload}.${toBase64Url(new Uint8Array(signature))}`;
}

async function verify(token: string): Promise<boolean> {
  const dot = token.lastIndexOf(".");
  if (dot === -1) return false;

  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );

  return crypto.subtle.verify(
    "HMAC",
    key,
    Uint8Array.from(fromBase64Url(sig)),
    new TextEncoder().encode(payload),
  );
}

export function verifyAdminPassword(password: string): boolean {
  const expected = getAdminPassword();
  if (password.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= password.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function createSessionCookie(): Promise<string> {
  const expires = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const payload = toBase64Url(new TextEncoder().encode(`admin:${expires}`));
  const token = await sign(payload);
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`;
}

export async function isAdminSession(
  cookieHeader: string | null,
): Promise<boolean> {
  if (!cookieHeader) return false;

  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));

  if (!match) return false;

  const token = match.slice(COOKIE_NAME.length + 1);
  if (!(await verify(token))) return false;

  const dot = token.lastIndexOf(".");
  if (dot === -1) return false;

  try {
    const payload = new TextDecoder().decode(
      fromBase64Url(token.slice(0, dot)),
    );
    const [, expiresStr] = payload.split(":");
    const expires = Number(expiresStr);
    return Number.isFinite(expires) && Date.now() < expires;
  } catch {
    return false;
  }
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export async function requireAdmin(
  cookieHeader: string | null,
): Promise<Response | null> {
  if (await isAdminSession(cookieHeader)) return null;
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
