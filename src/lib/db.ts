import { randomBytes, pbkdf2Sync, timingSafeEqual } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';
import { put, get } from '@vercel/blob';
import { getSupabaseClient } from './supabase';

// The interface structure for your website's quotes
export interface Quote {
  id: number;
  text: string;
  scheduledDate: string; // Expected format: YYYY-MM-DD
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

const QUOTES_BLOB_FILENAME = 'quotes.json';
const USERS_BLOB_FILENAME = 'users.json';
const COMMENTS_BLOB_FILENAME = 'comments.json';
const CONVERSATIONS_BLOB_FILENAME = 'conversations.json';
const HASH_ITERATIONS = 310000;
const HASH_LENGTH = 32;
const DATA_DIRECTORY = join(process.cwd(), 'data');

async function ensureDataDirectory(): Promise<void> {
  await fs.mkdir(DATA_DIRECTORY, { recursive: true });
}

async function readLocalJson<T>(filename: string, fallback: T): Promise<T> {
  await ensureDataDirectory();
  const filePath = join(DATA_DIRECTORY, filename);

  try {
    const content = await fs.readFile(filePath, 'utf8');
    if (!content.trim()) return fallback;

    const parsed = JSON.parse(content) as unknown;
    if (Array.isArray(parsed)) return parsed as T;

    if (parsed && typeof parsed === 'object') {
      const record = parsed as Record<string, unknown>;
      if (Array.isArray(record.quotes)) return record.quotes as T;
      if (Array.isArray(record.users)) return record.users as T;
      if (Array.isArray(record.comments)) return record.comments as T;
      if (Array.isArray(record.conversations)) return record.conversations as T;
      if (Array.isArray(record.items)) return record.items as T;
    }

    return fallback;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return fallback;
    console.error(`readLocalJson failed for ${filename}:`, error);
    return fallback;
  }
}

async function writeLocalJson(filename: string, data: unknown): Promise<void> {
  await ensureDataDirectory();
  const filePath = join(DATA_DIRECTORY, filename);
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function getCloudJson<T>(filename: string, fallback: T): Promise<T> {
  try {
    const blob = await get(filename, {
      access: 'private',
      useCache: false,
    });

    if (!blob || blob.stream === null) {
      throw new Error('Missing blob stream');
    }

    const response = new Response(blob.stream, {
      headers: {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });

    const parsed = await response.json();
    if (Array.isArray(parsed)) return parsed as T;
    if (parsed && typeof parsed === 'object') {
      const record = parsed as Record<string, unknown>;
      if (Array.isArray(record.quotes)) return record.quotes as T;
      if (Array.isArray(record.users)) return record.users as T;
      if (Array.isArray(record.comments)) return record.comments as T;
      if (Array.isArray(record.conversations)) return record.conversations as T;
      if (Array.isArray(record.items)) return record.items as T;
    }

    return fallback;
  } catch (error) {
    console.error(`getCloudJson failed for ${filename}:`, error);
    return readLocalJson<T>(filename, fallback);
  }
}

async function saveCloudJson(filename: string, data: unknown): Promise<void> {
  const jsonString = JSON.stringify(data, null, 2);
  try {
    await put(filename, jsonString, {
      access: 'private',
      allowOverwrite: true,
      addRandomSuffix: false,
    });
  } catch (error) {
    console.error(`saveCloudJson failed for ${filename}:`, error);
  }

  await writeLocalJson(filename, data);
}

async function getCloudQuotes(): Promise<Quote[]> {
  return await getCloudJson<Quote[]>(QUOTES_BLOB_FILENAME, []);
}

async function saveCloudQuotes(quotes: Quote[]): Promise<void> {
  await saveCloudJson(QUOTES_BLOB_FILENAME, quotes);
}

async function getCloudUsers(): Promise<User[]> {
  return await getCloudJson<User[]>(USERS_BLOB_FILENAME, []);
}

async function saveCloudUsers(users: User[]): Promise<void> {
  await saveCloudJson(USERS_BLOB_FILENAME, users);
}

async function getCloudComments(): Promise<Comment[]> {
  return await getCloudJson<Comment[]>(COMMENTS_BLOB_FILENAME, []);
}

async function saveCloudComments(comments: Comment[]): Promise<void> {
  await saveCloudJson(COMMENTS_BLOB_FILENAME, comments);
}

async function getCloudConversations(): Promise<Conversation[]> {
  return await getCloudJson<Conversation[]>(CONVERSATIONS_BLOB_FILENAME, []);
}

async function saveCloudConversations(conversations: Conversation[]): Promise<void> {
  await saveCloudJson(CONVERSATIONS_BLOB_FILENAME, conversations);
}

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
  if (client) {
    const { data, error } = await client.from('quotes').select('*').order('scheduled_date', { ascending: true });
    if (!error && Array.isArray(data)) {
      return data.map((entry) => normalizeQuote(entry as Record<string, unknown>));
    }
    console.error('Supabase quote list failed:', error);
  }

  return await getCloudQuotes();
}

export async function createQuote(text: string, scheduledDate: string): Promise<Quote> {
  const client = getSupabaseClient();
  if (client) {
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

    if (!error) {
      await client.from('comments').delete().neq('id', 0);
      return newQuote;
    }

    console.error('Supabase quote insert failed:', error);
  }

  const quotes = await getCloudQuotes();
  const duplicate = quotes.find((quote) => quote.scheduledDate === scheduledDate);
  if (duplicate) {
    throw new Error('DUPLICATE_DATE');
  }

  const nextId = quotes.length > 0 ? Math.max(...quotes.map((quote) => quote.id)) + 1 : 1;
  const newQuote: Quote = { id: nextId, text, scheduledDate };
  quotes.push(newQuote);

  await saveCloudQuotes(quotes);
  await saveCloudComments([]);
  return newQuote;
}

export async function deleteQuote(id: number): Promise<boolean> {
  const client = getSupabaseClient();
  if (client) {
    const { error } = await client.from('quotes').delete().eq('id', id);
    if (!error) {
      return true;
    }
    console.error('Supabase quote delete failed:', error);
  }

  const quotes = await getCloudQuotes();
  const index = quotes.findIndex((quote) => quote.id === id);
  if (index === -1) return false;

  quotes.splice(index, 1);
  await saveCloudQuotes(quotes);
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
  if (client) {
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

    if (!error) {
      return user;
    }

    console.error('Supabase user insert failed:', error);
  }

  const users = await getCloudUsers();
  if (users.some((user) => user.username === normalizedUsername)) {
    throw new Error('USERNAME_TAKEN');
  }

  const salt = randomBytes(16).toString('hex');
  const passwordHash = hashPassword(password, salt);
  const nextId = users.length > 0 ? Math.max(...users.map((user) => user.id)) + 1 : 1;

  const user: User = {
    id: nextId,
    username: normalizedUsername,
    passwordHash,
    passwordSalt: salt,
    createdAt: new Date().toISOString(),
  };

  users.push(user);
  await saveCloudUsers(users);
  return user;
}

export async function getUserByUsername(username: string): Promise<User | null> {
  const normalizedUsername = username.trim().toLowerCase();
  const client = getSupabaseClient();
  if (client) {
    const { data, error } = await client.from('app_users').select('*').eq('username', normalizedUsername).limit(1);
    if (!error && Array.isArray(data) && data[0]) {
      return normalizeUser(data[0] as Record<string, unknown>);
    }
    console.error('Supabase user lookup failed:', error);
  }

  const users = await getCloudUsers();
  return users.find((user) => user.username === normalizedUsername) ?? null;
}

export async function getUserById(id: number): Promise<User | null> {
  const client = getSupabaseClient();
  if (client) {
    const { data, error } = await client.from('app_users').select('*').eq('id', id).limit(1);
    if (!error && Array.isArray(data) && data[0]) {
      return normalizeUser(data[0] as Record<string, unknown>);
    }
    console.error('Supabase user lookup failed:', error);
  }

  const users = await getCloudUsers();
  return users.find((user) => user.id === id) ?? null;
}

export async function listUsers(): Promise<User[]> {
  const client = getSupabaseClient();
  if (client) {
    const { data, error } = await client.from('app_users').select('*').order('created_at', { ascending: false });
    if (!error && Array.isArray(data)) {
      return data.map((entry) => normalizeUser(entry as Record<string, unknown>));
    }
    console.error('Supabase user list failed:', error);
  }

  const users = await getCloudUsers();
  return users.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function deleteUser(id: number): Promise<boolean> {
  const client = getSupabaseClient();
  if (client) {
    const { error } = await client.from('app_users').delete().eq('id', id);
    if (!error) {
      await client.from('conversations').delete().eq('user_id', id);
      await client.from('comments').delete().eq('user_id', id);
      return true;
    }
    console.error('Supabase user delete failed:', error);
  }

  const users = await getCloudUsers();
  const index = users.findIndex((user) => user.id === id);
  if (index === -1) return false;

  users.splice(index, 1);
  await saveCloudUsers(users);

  const conversations = await getCloudConversations();
  const filteredConversations = conversations.filter((conversation) => conversation.userId !== id);
  if (filteredConversations.length !== conversations.length) {
    await saveCloudConversations(filteredConversations);
  }

  const comments = await getCloudComments();
  const filteredComments = comments.filter((comment) => comment.userId !== id);
  if (filteredComments.length !== comments.length) {
    await saveCloudComments(filteredComments);
  }

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
  if (client) {
    const { data, error } = await client.from('conversations').select('*').eq('user_id', userId).limit(1);
    if (!error && Array.isArray(data) && data[0]) {
      return normalizeConversation(data[0] as Record<string, unknown>);
    }
    if (error) {
      console.error('Supabase conversation lookup failed:', error);
    }

    const nextId = (await listConversations()).length + 1;
    const conversation: Conversation = {
      id: nextId,
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

    if (!insertError) {
      return conversation;
    }

    console.error('Supabase conversation insert failed:', insertError);
  }

  const conversations = await getCloudConversations();
  const existing = conversations.find((conversation) => conversation.userId === userId);
  if (existing) return existing;

  const nextId = conversations.length > 0 ? Math.max(...conversations.map((item) => item.id)) + 1 : 1;
  const conversation: Conversation = {
    id: nextId,
    userId,
    username,
    createdAt: new Date().toISOString(),
    messages: [],
  };

  conversations.push(conversation);
  await saveCloudConversations(conversations);
  return conversation;
}

export async function getConversationByUserId(userId: number): Promise<Conversation | null> {
  const client = getSupabaseClient();
  if (client) {
    const { data, error } = await client.from('conversations').select('*').eq('user_id', userId).limit(1);
    if (!error && Array.isArray(data) && data[0]) {
      return normalizeConversation(data[0] as Record<string, unknown>);
    }
    console.error('Supabase conversation lookup failed:', error);
  }

  const conversations = await getCloudConversations();
  return conversations.find((conversation) => conversation.userId === userId) ?? null;
}

export async function listConversations(): Promise<Conversation[]> {
  const client = getSupabaseClient();
  if (client) {
    const { data, error } = await client.from('conversations').select('*').order('created_at', { ascending: false });
    if (!error && Array.isArray(data)) {
      return data.map((entry) => normalizeConversation(entry as Record<string, unknown>));
    }
    console.error('Supabase conversation list failed:', error);
  }

  const conversations = await getCloudConversations();
  return conversations.sort((a, b) => {
    const aTime = a.messages[a.messages.length - 1]?.createdAt ?? a.createdAt;
    const bTime = b.messages[b.messages.length - 1]?.createdAt ?? b.createdAt;
    return new Date(bTime).getTime() - new Date(aTime).getTime();
  });
}

export async function sendMessageToConversation(
  conversationId: number,
  sender: 'user' | 'ag',
  message: string,
  userId?: number,
): Promise<ChatMessage> {
  const client = getSupabaseClient();
  if (client) {
    const conversationResult = await client.from('conversations').select('*').eq('id', conversationId).limit(1);
    const existingConversation = conversationResult.data?.[0] as Record<string, unknown> | undefined;
    if (!existingConversation) {
      throw new Error('CONVERSATION_NOT_FOUND');
    }

    const messages = Array.isArray(existingConversation.messages) ? (existingConversation.messages as unknown[]) : [];
    const nextId = messages.length > 0 ? Math.max(...messages.map((item) => Number((item as Record<string, unknown>).id ?? 0))) + 1 : 1;
    const chatMessage: ChatMessage = {
      id: nextId,
      sender,
      userId,
      message,
      createdAt: new Date().toISOString(),
    };

    const { error } = await client.from('conversations').update({
      messages: [...messages, chatMessage],
    }).eq('id', conversationId);

    if (!error) {
      return chatMessage;
    }

    console.error('Supabase conversation update failed:', error);
  }

  const conversations = await getCloudConversations();
  const conversation = conversations.find((item) => item.id === conversationId);
  if (!conversation) {
    throw new Error('CONVERSATION_NOT_FOUND');
  }

  const nextId = conversation.messages.length > 0 ? Math.max(...conversation.messages.map((item) => item.id)) + 1 : 1;
  const chatMessage: ChatMessage = {
    id: nextId,
    sender,
    userId,
    message,
    createdAt: new Date().toISOString(),
  };

  conversation.messages.push(chatMessage);
  await saveCloudConversations(conversations);
  return chatMessage;
}

export async function clearConversationMessages(conversationId: number): Promise<boolean> {
  const client = getSupabaseClient();
  if (client) {
    const { error } = await client.from('conversations').update({ messages: [] }).eq('id', conversationId);
    if (!error) {
      return true;
    }
    console.error('Supabase conversation clear failed:', error);
  }

  const conversations = await getCloudConversations();
  const conversation = conversations.find((item) => item.id === conversationId);
  if (!conversation) return false;

  conversation.messages = [];
  await saveCloudConversations(conversations);
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
  if (client) {
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

    if (!error) {
      return comment;
    }

    console.error('Supabase comment insert failed:', error);
  }

  const comments = await getCloudComments();
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

  comments.push(comment);
  await saveCloudComments(comments);
  return comment;
}

export async function listCommentsForQuote(quoteId: number): Promise<Comment[]> {
  const client = getSupabaseClient();
  if (client) {
    const { data, error } = await client.from('comments').select('*').eq('quote_id', quoteId).order('created_at', { ascending: false });
    if (!error && Array.isArray(data)) {
      return data.map((entry) => normalizeComment(entry as Record<string, unknown>));
    }
    console.error('Supabase comment list failed:', error);
  }

  const comments = await getCloudComments();
  return comments
    .filter((comment) => comment.quoteId === quoteId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function listAllComments(): Promise<Comment[]> {
  const client = getSupabaseClient();
  if (client) {
    const { data, error } = await client.from('comments').select('*').order('created_at', { ascending: false });
    if (!error && Array.isArray(data)) {
      return data.map((entry) => normalizeComment(entry as Record<string, unknown>));
    }
    console.error('Supabase comment list failed:', error);
  }

  const comments = await getCloudComments();
  return comments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
  if (client) {
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
    if (!error) {
      return reply;
    }

    console.error('Supabase reply insert failed:', error);
  }

  const comments = await getCloudComments();
  const comment = comments.find((item) => item.id === commentId);
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

  if (typeof parentReplyId === 'number' && parentReplyId > 0) {
    const added = addReplyToThread(comment.replies, parentReplyId, reply);
    if (!added) {
      throw new Error('REPLY_NOT_FOUND');
    }
  } else {
    comment.replies.push(reply);
  }

  await saveCloudComments(comments);
  return reply;
}

export async function deleteComment(commentId: number): Promise<boolean> {
  const client = getSupabaseClient();
  if (client) {
    const { error } = await client.from('comments').delete().eq('id', commentId);
    if (!error) {
      return true;
    }
    console.error('Supabase comment delete failed:', error);
  }

  const comments = await getCloudComments();
  const index = comments.findIndex((comment) => comment.id === commentId);
  if (index === -1) return false;

  comments.splice(index, 1);
  await saveCloudComments(comments);
  return true;
}
