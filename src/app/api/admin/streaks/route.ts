import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { setAccountStreak, listAccountStreaks } from "@/lib/db";
import { resetAndPersistStreaks } from "@/lib/streaks";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function PATCH(request: NextRequest) {
  const cookie = request.headers.get('cookie');
  const denied = await requireAdmin(cookie);
  if (denied) return denied;

  let body: { userId?: number; displayName?: string; streak?: number };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const streak = Number(body.streak);
  if (!Number.isInteger(streak) || streak < 0) {
    return Response.json({ error: 'Invalid streak' }, { status: 400 });
  }

  const userId = Number.isInteger(Number(body.userId)) ? Number(body.userId) : undefined;
  const displayName = String(body.displayName ?? '').trim() || 'User';

  const saved = await setAccountStreak(userId, displayName, streak);
  if (!saved) {
    return Response.json({ error: 'Could not save account streak' }, { status: 500 });
  }

  return Response.json({ ok: true });
}

export async function GET(request: NextRequest) {
  const cookie = request.headers.get('cookie');
  const denied = await requireAdmin(cookie);
  if (denied) return denied;

  const rows = await listAccountStreaks();
  return Response.json({ rows }, { headers: { 'Cache-Control': 'no-store' } });
}

// Recompute streaks from full comments history and persist them atomically.
export async function POST(request: NextRequest) {
  const cookie = request.headers.get('cookie');
  const denied = await requireAdmin(cookie);
  if (denied) return denied;

  const result = await resetAndPersistStreaks();
  return Response.json({ ok: result.success, errors: result.errors, streaksUpdated: result.streaksUpdated }, { headers: { 'Cache-Control': 'no-store' } });
}
