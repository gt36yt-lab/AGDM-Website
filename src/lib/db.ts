import { randomBytes, pbkdf2Sync, timingSafeEqual } from 'crypto';
import { put, get } from '@vercel/blob';

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

async function getCloudJson<T>(filename: string, fallback: T): Promise<T> {
  try {
    const blob = await get(filename, {
      access: 'private',
      useCache: false,
    });

    if (!blob || blob.stream === null) {
      return fallback;
    }

    const response = new Response(blob.stream, {
      headers: {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });

    return await response.json();
  } catch (error) {
    console.error(`getCloudJson failed for ${filename}:`, error);
    return fallback;
  }
}

async function saveCloudJson(filename: string, data: unknown): Promise<void> {
  const jsonString = JSON.stringify(data, null, 2);
  await put(filename, jsonString, {
    access: 'private',
    allowOverwrite: true,
    addRandomSuffix: false,
  });
}

// Fetch the quotes array directly from Vercel Blob, bypassing stale metadata and CDN caches
async function getCloudQuotes(): Promise<Quote[]> {
  return await getCloudJson<Quote[]>(QUOTES_BLOB_FILENAME, []);
}

// Save the quotes array back up to the cloud securely
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

// 1. Fetch all quotes asynchronously
export async function listQuotes(): Promise<Quote[]> {
  return await getCloudQuotes();
}

// 2. Create and push a new quote to cloud storage
export async function createQuote(text: string, scheduledDate: string): Promise<Quote> {
  const quotes = await getCloudQuotes();

  const duplicate = quotes.find((q) => q.scheduledDate === scheduledDate);
  if (duplicate) {
    throw new Error('DUPLICATE_DATE');
  }

  const nextId = quotes.length > 0 ? Math.max(...quotes.map((q) => q.id)) + 1 : 1;

  const newQuote: Quote = { id: nextId, text, scheduledDate };
  quotes.push(newQuote);

  await saveCloudQuotes(quotes);
  return newQuote;
}

// 3. Delete a quote from cloud storage by its ID
export async function deleteQuote(id: number): Promise<boolean> {
  const quotes = await getCloudQuotes();
  const index = quotes.findIndex((q) => q.id === id);

  if (index === -1) return false;

  quotes.splice(index, 1);
  await saveCloudQuotes(quotes);
  return true;
}

// 4. Get a specific quote for a designated date
export async function getQuoteForDate(dateStr: string): Promise<Quote | null> {
  const quotes = await getCloudQuotes();
  return quotes.find((q) => q.scheduledDate === dateStr) || null;
}

// 5. Get the newest quote scheduled on or before a given date
export async function getLatestQuoteOnOrBefore(dateStr: string): Promise<Quote | null> {
  const quotes = await getCloudQuotes();

  // Filter quotes to find ones on or before today's target date
  const pastQuotes = quotes.filter((q) => q.scheduledDate <= dateStr);

  if (pastQuotes.length === 0) return null;

  // Sort them so the closest date to today comes first
  pastQuotes.sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate));
  return pastQuotes[0]; // Returns the single closest quote object
}

export async function createUser(username: string, password: string): Promise<User> {
  const normalizedUsername = username.trim().toLowerCase();
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
  const users = await getCloudUsers();
  return users.find((user) => user.username === normalizedUsername) ?? null;
}

export async function getUserById(id: number): Promise<User | null> {
  const users = await getCloudUsers();
  return users.find((user) => user.id === id) ?? null;
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
  const conversations = await getCloudConversations();
  return conversations.find((conversation) => conversation.userId === userId) ?? null;
}

export async function listConversations(): Promise<Conversation[]> {
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

export async function createComment(
  quoteId: number,
  userId: number,
  message: string,
  isAnonymous: boolean,
  userName: string,
): Promise<Comment> {
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
  const comments = await getCloudComments();
  return comments
    .filter((comment) => comment.quoteId === quoteId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function listAllComments(): Promise<Comment[]> {
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

export async function createReply(
  commentId: number,
  message: string,
  author: 'ag' | 'user' = 'ag',
  parentReplyId?: number,
): Promise<CommentReply> {
  const comments = await getCloudComments();
  const comment = comments.find((item) => item.id === commentId);
  if (!comment) {
    throw new Error('COMMENT_NOT_FOUND');
  }

  const nextReplyId = comment.replies.length > 0 ? Math.max(...comment.replies.map((reply) => reply.id)) + 1 : 1;
  const reply: CommentReply = {
    id: nextReplyId,
    message,
    createdAt: new Date().toISOString(),
    author,
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
  const comments = await getCloudComments();
  const index = comments.findIndex((comment) => comment.id === commentId);
  if (index === -1) return false;

  comments.splice(index, 1);
  await saveCloudComments(comments);
  return true;
}
