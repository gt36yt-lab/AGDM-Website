import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

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

function poolPath() {
  return path.join(process.cwd(), "data", "quotes.json");
}

export async function readQuotePool(): Promise<string[]> {
  const filePath = poolPath();

  try {
    const raw = await readFile(filePath, "utf8");
    if (!raw.trim()) {
      await writeFile(filePath, JSON.stringify(DEFAULT_QUOTE_POOL, null, 2), "utf8");
      return [...DEFAULT_QUOTE_POOL];
    }

    const parsed = JSON.parse(raw) as unknown;
    const entries = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object" && Array.isArray((parsed as Record<string, unknown>).quotes)
        ? (parsed as Record<string, unknown>).quotes as unknown[]
        : [];

    const normalized = entries
      .map((entry) => normalizeQuoteText(entry))
      .filter((entry): entry is string => Boolean(entry));

    if (normalized.length > 0) {
      return [...new Set(normalized)];
    }

    await writeFile(filePath, JSON.stringify(DEFAULT_QUOTE_POOL, null, 2), "utf8");
    return [...DEFAULT_QUOTE_POOL];
  } catch {
    try {
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, JSON.stringify(DEFAULT_QUOTE_POOL, null, 2), "utf8");
    } catch {
      // Ignore FS issues during app startup; fall back to in-memory quotes.
    }

    return [...DEFAULT_QUOTE_POOL];
  }
}

export async function saveQuotePool(quotes: string[]): Promise<string[]> {
  const uniqueQuotes = [...new Set(quotes.map((quote) => quote.trim()).filter((quote) => quote.length > 0))];
  const filePath = poolPath();

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(uniqueQuotes, null, 2), "utf8");

  return uniqueQuotes;
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
