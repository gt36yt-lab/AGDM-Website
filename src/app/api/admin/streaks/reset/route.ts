import type { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { resetAndPersistStreaks } from '@/lib/streaks';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Daily streak reset endpoint.
 * 
 * This endpoint recomputes all user streaks from the full comment history
 * and persists them to Supabase. It should be called once per day at midnight
 * (in your QUOTE_TIMEZONE) to ensure streaks are properly updated.
 * 
 * Usage:
 * - Requires admin authentication via cookie
 * - Call via: POST /api/admin/streaks/reset
 * - Can be automated with external cron services:
 *   - Vercel Cron (if deployed on Vercel): Add cron route
 *   - EasyCron: https://www.easycron.com/
 *   - AWS EventBridge + Lambda
 *   - Google Cloud Scheduler
 */
export async function POST(request: NextRequest) {
  const cookie = request.headers.get('cookie');
  const denied = await requireAdmin(cookie);
  if (denied) return denied;

  try {
    const result = await resetAndPersistStreaks();

    return Response.json(
      {
        ok: result.success,
        streaksUpdated: result.streaksUpdated,
        errors: result.errors,
        timestamp: new Date().toISOString(),
      },
      {
        status: result.success ? 200 : 207,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  } catch (err) {
    return Response.json(
      {
        ok: false,
        error: `Unexpected error during streak reset: ${String(err)}`,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
