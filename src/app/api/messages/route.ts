import type { NextRequest } from "next/server";
import { getUserSession, isAdminSession, requireAdmin } from "@/lib/auth";
import { clearConversationMessages, getConversationByUserId, getOrCreateConversation, listConversations, sendMessageToConversation } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const cookie = request.headers.get("cookie");
  const isAdmin = await isAdminSession(cookie);
  const session = await getUserSession(cookie);

  if (isAdmin) {
    const conversations = await listConversations();
    return Response.json({ conversations });
  }

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const conversation = await getConversationByUserId(session.id);
  if (!conversation) {
    return Response.json({ conversation: null });
  }

  return Response.json({ conversation });
}

export async function DELETE(request: NextRequest) {
  const denied = await requireAdmin(request.headers.get("cookie"));
  if (denied) return denied;

  const conversationId = Number(new URL(request.url).searchParams.get("conversationId"));
  if (!Number.isInteger(conversationId) || conversationId < 1) {
    return Response.json({ error: "Invalid conversationId" }, { status: 400 });
  }

  const cleared = await clearConversationMessages(conversationId);
  if (!cleared) {
    return Response.json({ error: "Conversation not found" }, { status: 404 });
  }

  return Response.json({ ok: true });
}

export async function POST(request: NextRequest) {
  const cookie = request.headers.get("cookie");
  const session = await getUserSession(cookie);
  const isAdmin = await isAdminSession(cookie);

  if (!session && !isAdmin) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { conversationId?: number; message?: string; userId?: number; role?: "user" | "admin" };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = (body.message ?? "").trim();
  const requestedRole = body.role;
  if (!message) {
    return Response.json({ error: "Please write a message." }, { status: 400 });
  }

  try {
    if (requestedRole === "admin" || (requestedRole !== "user" && isAdmin)) {
      const conversationId = Number(body.conversationId);
      const userId = Number(body.userId);
      if (!Number.isInteger(conversationId) || conversationId < 1) {
        return Response.json({ error: "Invalid conversationId" }, { status: 400 });
      }
      if (!Number.isInteger(userId) || userId < 1) {
        return Response.json({ error: "Invalid userId" }, { status: 400 });
      }

      await sendMessageToConversation(conversationId, "ag", message, userId);
      return Response.json({ ok: true });
    }

    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const conversation = await getOrCreateConversation(session.id, session.username);
    await sendMessageToConversation(conversation.id, "user", message, session.id);
    return Response.json({ ok: true });
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "Could not save private message";
    console.error('Private message save failed:', error);
    return Response.json({ error: messageText }, { status: 500 });
  }
}
