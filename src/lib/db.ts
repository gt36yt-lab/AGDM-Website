import { randomBytes, pbkdf2Sync, timingSafeEqual } from 'crypto';
import { getSupabaseClient } from './supabase';

export interface Quote {
  id: number;
  text: string;
  scheduledDate: string;
}

export interface User {
  id: number;
  username: string;
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
}

export interface CommentReply {
  id: number;
  message: string;
  createdAt: string;
  author: 'ag' | 'user';
  authorName?: string;
  targetName?: string;
  replies?: CommentReply[];
}

export interface Comment {
  id: number;
  quoteId: number;
  userId: number;
  userName: string;
  message: string;
  isAnonymous: boolean;
  createdAt: string;
  replies: CommentReply[];
}

export interface ChatMessage {
  id: number;
  sender: 'user' | 'ag';
  userId?: number;
  message: string;
  createdAt: string;
}

export interface Conversation {
  id: number;
  userId: number;
  username: string;
  createdAt: string;
  messages: ChatMessage[];
}

const HASH_ITERATIONS = 310000;
const HASH_LENGTH = 32;

function hashPassword(password: string, salt: string): string {
  return pbkdf2Sync(password, salt, HASH_ITERATIONS, HASH_LENGTH, 'sha256').toString('hex');
}

function normalizeQuote(row: Record<string, unknown>): Quote {
  return {
    id: Number(row.id ?? 0),
    text: String(row.text ?? ''),
    scheduledDate: String(row.scheduled_date ?? row.scheduledDate ?? ''),
  };
}

function normalizeUser(row: Record<string, unknown>): User {
  return {
    id: Number(row.id ?? 0),
    username: String(row.username ?? ''),
    passwordHash: String(row.password_hash ?? row.passwordHash ?? ''),
    passwordSalt: String(row.password_salt ?? row.passwordSalt ?? ''),
    createdAt: String(row.created_at ?? row.createdAt ?? new Date().toISOString()),
  };
}

function normalizeReply(value: unknown): CommentReply {
  const reply = (value as Record<string, unknown>) ?? {};
  const nestedReplies = Array.isArray(reply.replies) ? reply.replies.map(normalizeReply) : [];

  return {
    id: Number(reply.id ?? 0),
    message: String(reply.message ?? ''),
    createdAt: String(reply.createdAt ?? reply.created_at ?? new Date().toISOString()),
    author: reply.author === 'user' ? 'user' : 'ag',
    authorName: typeof reply.authorName === 'string' ? reply.authorName : undefined,
    targetName: typeof reply.targetName === 'string' ? reply.targetName : undefined,
    replies: nestedReplies,
  };
}

function normalizeComment(row: Record<string, unknown>): Comment {
  const repliesValue = Array.isArray(row.replies) ? row.replies : [];
  return {
    id: Number(row.id ?? 0),
    quoteId: Number(row.quote_id ?? row.quoteId ?? 0),
    userId: Number(row.user_id ?? row.userId ?? 0),
    userName: String(row.user_name ?? row.userName ?? 'User'),
    message: String(row.message ?? ''),
    isAnonymous: Boolean(row.is_anonymous ?? row.isAnonymous ?? false),
    createdAt: String(row.created_at ?? row.createdAt ?? new Date().toISOString()),
    replies: repliesValue.map(normalizeReply),
  };
}

function normalizeChatMessage(value: unknown): ChatMessage {
  const message = (value as Record<string, unknown>) ?? {};
  return {
    id: Number(message.id ?? 0),
    sender: message.sender === 'ag' ? 'ag' : 'user',
    userId: typeof message.userId === 'number' ? message.userId : undefined,
    message: String(message.message ?? ''),
    createdAt: String(message.createdAt ?? message.created_at ?? new Date().toISOString()),
  };
}

function normalizeConversation(row: Record<string, unknown>): Conversation {
  const rawMessages = Array.isArray(row.messages) ? row.messages : [];
  return {
    id: Number(row.id ?? 0),
    userId: Number(row.user_id ?? row.userId ?? 0),
    username: String(row.username ?? 'User'),
    createdAt: String(row.created_at ?? row.createdAt ?? new Date().toISOString()),
    messages: rawMessages.map(normalizeChatMessage),
  };
}

export async function listQuotes(): Promise<Quote[]> {
  const client = getSupabaseClient();
  if (!client) return [];

  const { data, error } = await client.from('quotes').select('*').order('scheduled_date', { ascending: true });
  if (error) {
    console.error('Supabase quote list failed:', error);
    return [];
  }

  return Array.isArray(data) ? data.map((entry) => normalizeQuote(entry as Record<string, unknown>)) : [];
}

export async function createQuote(text: string, scheduledDate: string): Promise<Quote> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase is not configured');
  }

  const existingQuotes = await listQuotes();
  const duplicate = existingQuotes.find((quote) => quote.scheduledDate === scheduledDate);
  if (duplicate) {
    throw new Error('DUPLICATE_DATE');
  }

  const nextId = existingQuotes.length > 0 ? Math.max(...existingQuotes.map((quote) => quote.id)) + 1 : 1;
  const newQuote: Quote = { id: nextId, text, scheduledDate };
  const { error } = await client.from('quotes').insert({
    id: newQuote.id,
    text: newQuote.text,
    scheduled_date: newQuote.scheduledDate,
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error('Supabase quote insert failed:', error);
    throw new Error(error.message || 'Could not save quote');
  }

  await client.from('comments').delete().neq('id', 0);
  return newQuote;
}

export async function deleteQuote(id: number): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  const { error } = await client.from('quotes').delete().eq('id', id);
  if (error) {
    console.error('Supabase quote delete failed:', error);
    return false;
  }

  return true;
}

export async function getQuoteForDate(dateStr: string): Promise<Quote | null> {
  const quotes = await listQuotes();
  return quotes.find((quote) => quote.scheduledDate === dateStr) || null;
}

export async function getLatestQuoteOnOrBefore(dateStr: string): Promise<Quote | null> {
  const quotes = await listQuotes();
  const pastQuotes = quotes.filter((quote) => quote.scheduledDate <= dateStr);
  if (pastQuotes.length === 0) return null;

  pastQuotes.sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate));
  return pastQuotes[0] ?? null;
}

export async function createUser(username: string, password: string): Promise<User> {
  const normalizedUsername = username.trim().toLowerCase();
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase is not configured');
  }

  const existingUser = await getUserByUsername(normalizedUsername);
  if (existingUser) {
    throw new Error('USERNAME_TAKEN');
  }

  const users = await listUsers();
  const nextId = users.length > 0 ? Math.max(...users.map((user) => user.id)) + 1 : 1;
  const salt = randomBytes(16).toString('hex');
  const passwordHash = hashPassword(password, salt);
  const user: User = {
    id: nextId,
    username: normalizedUsername,
    passwordHash,
    passwordSalt: salt,
    createdAt: new Date().toISOString(),
  };

  const { error } = await client.from('app_users').insert({
    id: user.id,
    username: user.username,
    password_hash: user.passwordHash,
    password_salt: user.passwordSalt,
    created_at: user.createdAt,
  });

  if (error) {
    console.error('Supabase user insert failed:', error);
    throw new Error(error.message || 'Could not create user');
  }

  return user;
}

export async function getUserByUsername(username: string): Promise<User | null> {
  const normalizedUsername = username.trim().toLowerCase();
  const client = getSupabaseClient();
  if (!client) return null;

  const { data, error } = await client.from('app_users').select('*').eq('username', normalizedUsername).limit(1);
  if (error) {
    console.error('Supabase user lookup failed:', error);
    return null;
  }

  return Array.isArray(data) && data[0] ? normalizeUser(data[0] as Record<string, unknown>) : null;
}

export async function getUserById(id: number): Promise<User | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data, error } = await client.from('app_users').select('*').eq('id', id).limit(1);
  if (error) {
    console.error('Supabase user lookup failed:', error);
    return null;
  }

  return Array.isArray(data) && data[0] ? normalizeUser(data[0] as Record<string, unknown>) : null;
}

export async function listUsers(): Promise<User[]> {
  const client = getSupabaseClient();
  if (!client) return [];

  const { data, error } = await client.from('app_users').select('*').order('created_at', { ascending: false });
  if (error) {
    console.error('Supabase user list failed:', error);
    return [];
  }

  return Array.isArray(data) ? data.map((entry) => normalizeUser(entry as Record<string, unknown>)) : [];
}

export async function deleteUser(id: number): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  const { error } = await client.from('app_users').delete().eq('id', id);
  if (error) {
    console.error('Supabase user delete failed:', error);
    return false;
  }

  await client.from('conversations').delete().eq('user_id', id);
  await client.from('comments').delete().eq('user_id', id);
  return true;
}

export async function verifyUserPassword(userId: number, password: string): Promise<boolean> {
  const user = await getUserById(userId);
  if (!user) return false;

  const suppliedHash = hashPassword(password, user.passwordSalt);
  const expectedHash = Buffer.from(user.passwordHash, 'hex');
  const suppliedBuffer = Buffer.from(suppliedHash, 'hex');

  return timingSafeEqual(suppliedBuffer, expectedHash);
}

export async function getOrCreateConversation(userId: number, username: string): Promise<Conversation> {
  const client = getSupabaseClient();
  if (!client) {
    return { id: 0, userId, username, createdAt: new Date().toISOString(), messages: [] };
  }

  const { data, error } = await client.from('conversations').select('*').eq('user_id', userId).limit(1);
  if (!error && Array.isArray(data) && data[0]) {
    return normalizeConversation(data[0] as Record<string, unknown>);
  }

  if (error) {
    console.error('Supabase conversation lookup failed:', error);
  }

  const conversation: Conversation = {
    id: Date.now(),
    userId,
    username,
    createdAt: new Date().toISOString(),
    messages: [],
  };

  const { error: insertError } = await client.from('conversations').insert({
    id: conversation.id,
    user_id: conversation.userId,
    username: conversation.username,
    created_at: conversation.createdAt,
    messages: [],
  });

  if (insertError) {
    console.error('Supabase conversation insert failed:', insertError);
  }

  return conversation;
}

export async function getConversationByUserId(userId: number): Promise<Conversation | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data, error } = await client.from('conversations').select('*').eq('user_id', userId).limit(1);
  if (error) {
    console.error('Supabase conversation lookup failed:', error);
    return null;
  }

  return Array.isArray(data) && data[0] ? normalizeConversation(data[0] as Record<string, unknown>) : null;
}

export async function listConversations(): Promise<Conversation[]> {
  const client = getSupabaseClient();
  if (!client) return [];

  const { data, error } = await client.from('conversations').select('*').order('created_at', { ascending: false });
  if (error) {
    console.error('Supabase conversation list failed:', error);
    return [];
  }

  return Array.isArray(data) ? data.map((entry) => normalizeConversation(entry as Record<string, unknown>)) : [];
}

export async function sendMessageToConversation(
  conversationId: number,
  sender: 'user' | 'ag',
  message: string,
  userId?: number,
): Promise<ChatMessage> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase is not configured');
  }

  const { data, error } = await client.from('conversations').select('*').eq('id', conversationId).limit(1);
  if (error || !Array.isArray(data) || !data[0]) {
    throw new Error('CONVERSATION_NOT_FOUND');
  }

  const existingConversation = data[0] as Record<string, unknown>;
  const messages = Array.isArray(existingConversation.messages) ? (existingConversation.messages as unknown[]) : [];
  const nextId = messages.length > 0 ? Math.max(...messages.map((item) => Number((item as Record<string, unknown>).id ?? 0))) + 1 : 1;
  const chatMessage: ChatMessage = {
    id: nextId,
    sender,
    userId,
    message,
    createdAt: new Date().toISOString(),
  };

  const { error: updateError } = await client.from('conversations').update({
    messages: [...messages, chatMessage],
  }).eq('id', conversationId);

  if (updateError) {
    console.error('Supabase conversation update failed:', updateError);
    throw new Error(updateError.message || 'Could not save message');
  }

  return chatMessage;
}

export async function clearConversationMessages(conversationId: number): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  const { error } = await client.from('conversations').update({ messages: [] }).eq('id', conversationId);
  if (error) {
    console.error('Supabase conversation clear failed:', error);
    return false;
  }

  return true;
}

export async function createComment(
  quoteId: number,
  userId: number,
  message: string,
  isAnonymous: boolean,
  userName: string,
): Promise<Comment> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase is not configured');
  }

  const comments = await listAllComments();
  const nextId = comments.length > 0 ? Math.max(...comments.map((comment) => comment.id)) + 1 : 1;
  const comment: Comment = {
    id: nextId,
    quoteId,
    userId,
    userName: isAnonymous ? 'Anonymous' : userName,
    message,
    isAnonymous,
    createdAt: new Date().toISOString(),
    replies: [],
  };

  const { error } = await client.from('comments').insert({
    id: comment.id,
    quote_id: comment.quoteId,
    user_id: comment.userId,
    user_name: comment.userName,
    message: comment.message,
    is_anonymous: comment.isAnonymous,
    created_at: comment.createdAt,
    replies: [],
  });

  if (error) {
    console.error('Supabase comment insert failed:', error);
    throw new Error(error.message || 'Could not save comment');
  }

  return comment;
}

export async function listCommentsForQuote(quoteId: number): Promise<Comment[]> {
  const client = getSupabaseClient();
  if (!client) return [];

  const { data, error } = await client.from('comments').select('*').eq('quote_id', quoteId).order('created_at', { ascending: false });
  if (error) {
    console.error('Supabase comment list failed:', error);
    return [];
  }

  return Array.isArray(data) ? data.map((entry) => normalizeComment(entry as Record<string, unknown>)) : [];
}

export async function listAllComments(): Promise<Comment[]> {
  const client = getSupabaseClient();
  if (!client) return [];

  const { data, error } = await client.from('comments').select('*').order('created_at', { ascending: false });
  if (error) {
    console.error('Supabase comment list failed:', error);
    return [];
  }

  return Array.isArray(data) ? data.map((entry) => normalizeComment(entry as Record<string, unknown>)) : [];
}

function addReplyToThread(replies: CommentReply[], targetReplyId: number, incomingReply: CommentReply): boolean {
  for (const reply of replies) {
    if (reply.id === targetReplyId) {
      reply.replies = reply.replies ?? [];
      reply.replies.push(incomingReply);
      return true;
    }

    if (reply.replies && reply.replies.length > 0) {
      const added = addReplyToThread(reply.replies, targetReplyId, incomingReply);
      if (added) return true;
    }
  }

  return false;
}

function getMaxReplyId(replies: CommentReply[]): number {
  let maxId = 0;

  for (const reply of replies) {
    maxId = Math.max(maxId, reply.id);
    if (reply.replies && reply.replies.length > 0) {
      maxId = Math.max(maxId, getMaxReplyId(reply.replies));
    }
  }

  return maxId;
}

export async function createReply(
  commentId: number,
  message: string,
  author: 'ag' | 'user' = 'ag',
  parentReplyId?: number,
  authorName?: string,
  targetName?: string,
): Promise<CommentReply> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase is not configured');
  }

  const existingComments = await listAllComments();
  const comment = existingComments.find((item) => item.id === commentId);
  if (!comment) {
    throw new Error('COMMENT_NOT_FOUND');
  }

  const nextReplyId = getMaxReplyId(comment.replies) + 1;
  const resolvedTargetName = targetName || (typeof parentReplyId === 'number' && parentReplyId > 0 ? undefined : comment.userName);
  const reply: CommentReply = {
    id: nextReplyId,
    message,
    createdAt: new Date().toISOString(),
    author,
    authorName,
    targetName: resolvedTargetName,
    replies: [],
  };

  const updatedReplies = [...comment.replies];
  if (typeof parentReplyId === 'number' && parentReplyId > 0) {
    const added = addReplyToThread(updatedReplies, parentReplyId, reply);
    if (!added) {
      throw new Error('REPLY_NOT_FOUND');
    }
  } else {
    updatedReplies.push(reply);
  }

  const { error } = await client.from('comments').update({ replies: updatedReplies }).eq('id', commentId);
  if (error) {
    console.error('Supabase reply insert failed:', error);
    throw new Error(error.message || 'Could not save reply');
  }

  return reply;
}

export async function deleteComment(commentId: number): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  const { error } = await client.from('comments').delete().eq('id', commentId);
  if (error) {
    console.error('Supabase comment delete failed:', error);
    return false;
  }

  return true;
}
