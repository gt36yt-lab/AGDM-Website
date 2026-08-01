import path from "path";
import fs from "fs";

export type Quote = {
  id: number;
  text: string;
  scheduled_date: string;
  created_at: string;
};

type Store = {
  nextId: number;
  quotes: Quote[];
};

const storePath = path.join(process.cwd(), "data", "quotes.json");

function ensureDataDir(): void {
  const dir = path.dirname(storePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readStore(): Store {
  ensureDataDir();
  if (!fs.existsSync(storePath)) {
    return { nextId: 1, quotes: [] };
  }
  const raw = fs.readFileSync(storePath, "utf-8");
  return JSON.parse(raw) as Store;
}

function writeStore(store: Store): void {
  ensureDataDir();
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2), "utf-8");
}

export function getQuoteForDate(date: string): Quote | undefined {
  return readStore().quotes.find((q) => q.scheduled_date === date);
}

export function getLatestQuoteOnOrBefore(date: string): Quote | undefined {
  return readStore()
    .quotes.filter((q) => q.scheduled_date <= date)
    .sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date))[0];
}

export function listQuotes(): Quote[] {
  return readStore().quotes.sort((a, b) =>
    b.scheduled_date.localeCompare(a.scheduled_date),
  );
}

export function createQuote(text: string, scheduledDate: string): Quote {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Quote text is required.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) {
    throw new Error("Invalid date format.");
  }

  const store = readStore();
  if (store.quotes.some((q) => q.scheduled_date === scheduledDate)) {
    throw new Error("DUPLICATE_DATE");
  }

  const quote: Quote = {
    id: store.nextId++,
    text: trimmed,
    scheduled_date: scheduledDate,
    created_at: new Date().toISOString(),
  };
  store.quotes.push(quote);
  writeStore(store);
  return quote;
}

export function deleteQuote(id: number): boolean {
  const store = readStore();
  const before = store.quotes.length;
  store.quotes = store.quotes.filter((q) => q.id !== id);
  if (store.quotes.length === before) return false;
  writeStore(store);
  return true;
}
