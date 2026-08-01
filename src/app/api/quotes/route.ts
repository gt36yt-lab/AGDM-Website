import type { NextRequest } from "next/server";
import { createQuote, deleteQuote, listQuotes } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request.headers.get("cookie"));
  if (denied) return denied;

  return Response.json({ quotes: listQuotes() });
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin(request.headers.get("cookie"));
  if (denied) return denied;

  let body: { text?: string; scheduledDate?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const quote = createQuote(body.text ?? "", body.scheduledDate ?? "");
    return Response.json({ quote }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not save quote";
    if (message === "DUPLICATE_DATE") {
      return Response.json(
        { error: "A quote is already scheduled for that date." },
        { status: 409 },
      );
    }
    return Response.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const denied = await requireAdmin(request.headers.get("cookie"));
  if (denied) return denied;

  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id < 1) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  if (!deleteQuote(id)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ ok: true });
}
