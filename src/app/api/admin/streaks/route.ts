import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { setAccountStreak, listAccountStreaks, listAllComments, enrichCommentsWithStreaks } from "@/lib/db";

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

  // recompute from full history
  const comments = await listAllComments();
  const { streaks } = await enrichCommentsWithStreaks(comments);

  // persist each account row using existing helper
  const results: Array<{ key: string; ok: boolean }> = [];
  for (const s of streaks) {
    try {
      const ok = await setAccountStreak(s.userId, s.displayName, s.currentStreak);
      results.push({ key: s.key, ok });
    } catch (err) {
      results.push({ key: s.key, ok: false });
    }
  }

  return Response.json({ ok: true, results }, { headers: { 'Cache-Control': 'no-store' } });
}
