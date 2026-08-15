import { getSupabaseClient } from './supabase';

const DEFAULT_QUOTE_POOL = [
  "Believe you can and you are halfway there.",
  "The future depends on what you do today.",
  "Small steps every day lead to big changes.",
  "Your calm is a strength, not a weakness.",
  "You do not have to have it all figured out to move forward.",
  "A gentle heart can still be strong.",
  "Progress is built from quiet consistency.",
  "Let today be the day you trust your own rhythm.",
  "The best way forward is the one you can keep walking.",
  "Growth is not always loud; sometimes it is steady.",
];

function normalizeQuoteText(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const text = typeof record.text === "string" ? record.text : typeof record.quote === "string" ? record.quote : null;
    const trimmed = text?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : null;
  }

  return null;
}

export async function readQuotePool(): Promise<string[]> {
  const client = getSupabaseClient();
  if (!client) {
    return [...DEFAULT_QUOTE_POOL];
  }

  try {
    const { data, error } = await client
      .from('quote_pool')
      .select('quotes')
      .eq('id', 1)
      .single();

    if (!error && data && Array.isArray(data.quotes)) {
      const normalized = data.quotes
        .map((entry) => normalizeQuoteText(entry))
        .filter((entry): entry is string => Boolean(entry));

      if (normalized.length > 0) {
        return [...new Set(normalized)];
      }
    }
  } catch {
    // Ignore errors; fall back to defaults
  }

  return [...DEFAULT_QUOTE_POOL];
}

export async function saveQuotePool(quotes: string[]): Promise<string[]> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase is not configured');
  }

  const uniqueQuotes = [...new Set(quotes.map((quote) => quote.trim()).filter((quote) => quote.length > 0))];

  if (uniqueQuotes.length === 0) {
    throw new Error('No valid quotes to save');
  }

  try {
    const { error: upsertError } = await client
      .from('quote_pool')
      .upsert({ id: 1, quotes: uniqueQuotes, updated_at: new Date().toISOString() })
      .select()
      .single();

    if (upsertError) {
      throw new Error(upsertError.message || 'Failed to save quotes to database');
    }

    return uniqueQuotes;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to save quotes: ${message}`);
  }
}

export function pickQuoteForDate(dateKey: string, quotes: string[]): string {
  const pool = quotes.filter((quote) => quote.trim().length > 0);
  if (pool.length === 0) {
    return "";
  }

  const hash = Array.from(dateKey).reduce((total, character) => total + character.charCodeAt(0), 0);
  const index = Math.abs(hash) % pool.length;
  return pool[index];
}
