import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { readQuotePool, saveQuotePool } from "@/lib/quotePool";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request.headers.get("cookie"));
  if (denied) return denied;

  const quotes = await readQuotePool();
  return Response.json({ quotes }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin(request.headers.get("cookie"));
  if (denied) return denied;

  let body: { quotes?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawQuotes = Array.isArray(body.quotes) ? body.quotes : [];
  const normalizedQuotes = rawQuotes
    .map((entry) => {
      if (typeof entry === "string") return entry.trim();
      if (entry && typeof entry === "object") {
        const record = entry as Record<string, unknown>;
        const value = typeof record.text === "string" ? record.text : typeof record.quote === "string" ? record.quote : "";
        return value.trim();
      }
      return "";
    })
    .filter((quote) => quote.length > 0);

  if (normalizedQuotes.length === 0) {
    return Response.json({ error: "Add at least one quote." }, { status: 400 });
  }

  try {
    const savedQuotes = await saveQuotePool(normalizedQuotes);
    return Response.json({ quotes: savedQuotes, count: savedQuotes.length }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error('Quote pool save error:', message);
    return Response.json({ error: `Could not save quotes: ${message}` }, { status: 500 });
  }
}

