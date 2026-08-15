# Streaks Daily Reset Setup Guide

## What Was Fixed

### 1. Persistent Streak Syncing ✓
**File**: `.env.local`
- Added `PERSIST_STREAKS=true` environment variable
- Computed streaks are now **automatically saved to Supabase** 
- Admin page and database stay in sync
- Eliminates orphaned streaks that only exist in the admin view

### 2. Daily Reset Mechanism ✓
**Files**: 
- `src/lib/streaks.ts` - Core reset logic
- `src/app/api/admin/streaks/reset/route.ts` - Reset API endpoint
- Updated `src/app/api/admin/streaks/route.ts` - Uses new utility

Recomputes all user streaks from full comment history and persists them daily.

---

## How to Set Up Daily Resets

### Option A: Manual Reset (for testing)
Call the reset endpoint manually:

```bash
# Test locally
curl -X POST http://localhost:3000/api/admin/streaks/reset

# In production (requires your admin auth token)
curl -X POST https://yourdomain.com/api/admin/streaks/reset \
  -H "Cookie: session=<your_session_token>"
```

### Option B: Automated Daily Reset (Recommended)

Currently, the reset endpoint requires **admin cookie authentication**. To set up automated daily resets with external cron services, you'll need to implement **Bearer token authentication**.

#### How to Add Bearer Token Auth

1. Create an API key/secret for cron jobs (add to `.env.local`):
```env
CRON_SECRET=your_secure_random_token_here
```

2. Update `/api/admin/streaks/reset/route.ts` to accept Bearer tokens:

```ts
export async function POST(request: NextRequest) {
  const cookie = request.headers.get('cookie');
  const authHeader = request.headers.get('authorization');
  
  // Check for Bearer token (for automated cron jobs)
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    if (token !== process.env.CRON_SECRET) {
      return Response.json({ error: 'Invalid cron token' }, { status: 401 });
    }
  } else {
    // Otherwise require admin cookie auth
    const denied = await requireAdmin(cookie);
    if (denied) return denied;
  }
  
  // ... rest of the function
}
```

3. Then set up a cron service to call it daily:

**Using EasyCron** (easycron.com):
- Set URL: `https://yourdomain.com/api/admin/streaks/reset`
- Set frequency: `0 0 * * *` (midnight UTC)
- Add custom header: `Authorization: Bearer YOUR_CRON_SECRET`

**Using AWS EventBridge + Lambda**:
- Schedule: `cron(0 0 * * ? *)` (daily at midnight UTC)
- Target: HTTPS endpoint with Bearer token in headers

**Using Google Cloud Scheduler**:
- Frequency: `0 0 * * *` (cron format)
- Target: HTTPS
- Add HTTP header: `Authorization: Bearer YOUR_CRON_SECRET`

**Using Vercel Cron** (if deployed on Vercel):
```ts
// next.config.ts
export default {
  crons: [
    { path: '/api/admin/streaks/reset', schedule: '0 0 * * *' }
  ]
}
```
Note: Vercel automatically authenticates cron requests, no Bearer token needed.

---

## How Streaks Now Work

1. **Computed Daily**: Every time the admin page loads or an endpoint is called, streaks are calculated from user activity (consecutive days of comments)

2. **Persisted Automatically**: With `PERSIST_STREAKS=true`, computed values are always saved to Supabase's `account_streaks` table

3. **Reset Daily**: Call `/api/admin/streaks/reset` every midnight in your `QUOTE_TIMEZONE` to:
   - Recalculate all streaks from scratch
   - Check if users maintained their streak (commented today)
   - Persist updated values to DB
   - Update best streaks if they increased

4. **Consistent Data**: Admin page now shows exactly what's in Supabase (no mismatches)

---

## Testing the Reset

### Test Locally
```bash
npm run dev  # starts dev server

# In another terminal
curl -X POST http://localhost:3000/api/admin/streaks/reset
```

### Expected Response
```json
{
  "ok": true,
  "streaksUpdated": 5,
  "errors": [],
  "timestamp": "2026-08-15T12:00:00.000Z"
}
```

---

## Environment Variables

Your `.env.local` now has:
```env
ADMIN_PASSWORD=ALILEO8410
SESSION_SECRET=gamertraiter36yt
QUOTE_TIMEZONE=Asia/Manila
PERSIST_STREAKS=true       # NEW: Auto-save computed streaks
CRON_SECRET=???            # OPTIONAL: Add if using cron jobs
```

---

## API Endpoints Summary

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/api/admin/streaks` | GET | List all stored streaks | Admin |
| `/api/admin/streaks` | POST | Recompute & persist all streaks | Admin |
| `/api/admin/streaks` | PATCH | Update a specific streak | Admin |
| `/api/admin/streaks/reset` | POST | **Daily reset** (NEW) | Admin or Bearer |

---

## Troubleshooting

**Q: Streaks still not resetting daily?**
- A: You need to set up an external cron service to call the reset endpoint
- Verify `PERSIST_STREAKS=true` in `.env.local`

**Q: Admin page shows different streaks than Supabase?**
- A: Restart the dev server or deploy to apply `PERSIST_STREAKS=true`

**Q: 401 Unauthorized from cron service?**
- A: Implement Bearer token auth as described above

**Q: Some users' streaks show 0 even though they commented today?**
- A: Their comment hasn't been counted in that day's activity yet
- The reset should fix this the next time it runs
