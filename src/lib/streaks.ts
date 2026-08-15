import { listAllComments, enrichCommentsWithStreaks, setAccountStreak } from './db';

/**
 * Recompute all streaks from full comment history and persist them to Supabase.
 * This should be called daily to ensure streaks are up-to-date and reflect
 * the latest activity, including checking if users maintained their streak
 * after a new day began.
 */
export async function resetAndPersistStreaks(): Promise<{
  success: boolean;
  streaksUpdated: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let streaksUpdated = 0;

  try {
    // Recompute streaks from full history
    const comments = await listAllComments();
    const { streaks } = await enrichCommentsWithStreaks(comments);

    // Persist each account's computed streak
    for (const streak of streaks) {
      try {
        const ok = await setAccountStreak(streak.userId, streak.displayName, streak.currentStreak);
        if (ok) {
          streaksUpdated += 1;
        } else {
          errors.push(`Failed to persist streak for ${streak.displayName}`);
        }
      } catch (err) {
        errors.push(`Error persisting streak for ${streak.displayName}: ${String(err)}`);
      }
    }

    return {
      success: errors.length === 0,
      streaksUpdated,
      errors,
    };
  } catch (err) {
    return {
      success: false,
      streaksUpdated: 0,
      errors: [`Fatal error during streak reset: ${String(err)}`],
    };
  }
}
