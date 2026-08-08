import { randomBytes, pbkdf2Sync, timingSafeEqual } from 'crypto';
import { getSupabaseClient } from './supabase';
import { getQuoteTimezone } from './dates';

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
  userId?: number;
  userName?: string;
  streak?: number;
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
  streak?: number;
}

export interface AccountStreakSummary {
  key: string;
  displayName: string;
  userId?: number;
  currentStreak: number;
  bestStreak: number;
  lastActiveDate: string;
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
    userId: typeof reply.userId === 'number' ? reply.userId : (typeof reply.user_id === 'number' ? reply.user_id : undefined),
    userName: typeof reply.userName === 'string' ? reply.userName : (typeof reply.user_name === 'string' ? reply.user_name : undefined),
    streak: typeof reply.streak === 'number' ? reply.streak : undefined,
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
    streak: typeof row.streak === 'number' ? row.streak : undefined,
  };
}

function toDateKey(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: getQuoteTimezone(),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function calculateStreaksForDates(dates: string[]): { currentStreak: number; bestStreak: number; lastActiveDate: string } {
  const sortedDates = [...new Set(dates)].sort();
  if (sortedDates.length === 0) {
    return { currentStreak: 0, bestStreak: 0, lastActiveDate: '' };
  }

  let bestStreak = 1;
  let currentStreak = 1;
  let previousDate: Date | null = null;

  for (const dateKey of sortedDates) {
    const currentDate = new Date(`${dateKey}T12:00:00Z`);
    if (!previousDate) {
      previousDate = currentDate;
      continue;
    }

    const diffDays = Math.round((currentDate.getTime() - previousDate.getTime()) / 86_400_000);
    if (diffDays === 1) {
      currentStreak += 1;
      bestStreak = Math.max(bestStreak, currentStreak);
    } else {
      currentStreak = 1;
    }

    previousDate = currentDate;
  }

  let streakCursor = new Date();
  let activeToday = 0;
  while (sortedDates.includes(toDateKey(streakCursor))) {
    activeToday += 1;
    streakCursor = new Date(streakCursor.getTime() - 86_400_000);
  }

  return {
    currentStreak: activeToday,
    bestStreak,
    lastActiveDate: sortedDates[sortedDates.length - 1] ?? '',
  };
}

export function enrichCommentsWithStreaks(comments: Comment[]): { comments: Comment[]; streaks: AccountStreakSummary[] } {
  const activityByAccount = new Map<string, { displayName: string; userId?: number; dates: Set<string> }>();
  // store overrides as { value, dateKey } where dateKey is the day the override was set (in quote timezone)
  const manualStreakOverrides = new Map<string, { value: number; dateKey: string }>();

  const getActivityKey = (userId: number | undefined, userName: string | undefined) => {
    const normalizedName = userName?.trim() || 'User';
    return typeof userId === 'number' && userId > 0 ? `user:${userId}` : `name:${normalizedName.toLowerCase()}`;
  };

  const registerActivity = (
    entry: { createdAt: string; userId?: number; userName?: string; isAnonymous?: boolean },
    fallbackName: string,
  ) => {
    if (entry.isAnonymous) return;

    const normalizedName = entry.userName?.trim() || fallbackName;
    const userId = typeof entry.userId === 'number' && entry.userId > 0 ? entry.userId : undefined;
    const isAdminComment = !userId && normalizedName === 'AG';
    if (isAdminComment) return;

    const key = getActivityKey(userId, normalizedName);
    const existing = activityByAccount.get(key);
    const nextEntry = existing ?? { displayName: normalizedName, userId, dates: new Set<string>() };
    nextEntry.displayName = normalizedName;
    nextEntry.userId = userId;
    nextEntry.dates.add(toDateKey(entry.createdAt));
    activityByAccount.set(key, nextEntry);
  };

  const registerManualStreakOverride = (
    entry: { userId?: number; userName?: string; streak?: number; createdAt?: string },
    fallbackName: string,
  ) => {
    if (typeof entry.streak !== 'number' || entry.streak < 0) return;
    const userId = typeof entry.userId === 'number' && entry.userId > 0 ? entry.userId : undefined;
    const normalizedName = entry.userName?.trim() || fallbackName;
    const key = getActivityKey(userId, normalizedName);
    const dateKey = entry.createdAt ? toDateKey(entry.createdAt) : toDateKey(new Date());
    manualStreakOverrides.set(key, { value: entry.streak, dateKey });
  };

  const walkComment = (comment: Comment) => {
    registerActivity(comment, comment.userName || 'User');
    registerManualStreakOverride(comment, comment.userName || 'User');
    comment.replies.forEach((reply) => {
      registerActivity(reply, reply.authorName || reply.userName || 'User');
      registerManualStreakOverride(reply, reply.authorName || reply.userName || 'User');
      if (reply.replies && reply.replies.length > 0) {
        reply.replies.forEach((nestedReply) => {
          registerActivity(nestedReply, nestedReply.authorName || nestedReply.userName || 'User');
          registerManualStreakOverride(nestedReply, nestedReply.authorName || nestedReply.userName || 'User');
        });
      }
    });
  };

  comments.forEach(walkComment);

  const streaks = Array.from(activityByAccount.entries()).map(([key, entry]) => {
    const stats = calculateStreaksForDates([...entry.dates]);
    const override = manualStreakOverrides.get(key);

    let computedCurrent = stats.currentStreak;

    if (override) {
      // compute how many consecutive days the user has been active after the override date
      const sortedDates = [...entry.dates].sort();
      let consecutiveAfterOverride = 0;
      try {
        const cursorDate = new Date(override.dateKey + 'T12:00:00Z');
        const next = new Date(cursorDate.getTime() + 86_400_000);
        let check = toDateKey(next);
        // count consecutive active days starting the day after override
        while (sortedDates.includes(check)) {
          consecutiveAfterOverride += 1;
          next.setTime(next.getTime() + 86_400_000);
          check = toDateKey(next);
        }
        } catch {
          // fallback: don't increment
          consecutiveAfterOverride = 0;
        }

      const adjusted = override.value + consecutiveAfterOverride;
      // prefer the larger of computed activity streak and adjusted override
      computedCurrent = Math.max(computedCurrent, adjusted);
    }

    return {
      key,
      displayName: entry.displayName,
      userId: entry.userId,
      currentStreak: computedCurrent,
      bestStreak: stats.bestStreak,
      lastActiveDate: stats.lastActiveDate,
    } satisfies AccountStreakSummary;
  }).sort((a, b) => b.currentStreak - a.currentStreak || b.bestStreak - a.bestStreak || a.displayName.localeCompare(b.displayName));

  const streakLookup = new Map(streaks.map((streak) => [streak.key, streak]));

  const assignStreak = (entry: { userId?: number; userName?: string; isAnonymous?: boolean; streak?: number }, fallbackName: string) => {
    if (entry.isAnonymous) {
      return;
    }

    const normalizedName = entry.userName?.trim() || fallbackName;
    const userId = typeof entry.userId === 'number' && entry.userId > 0 ? entry.userId : undefined;
    const key = userId ? `user:${userId}` : `name:${normalizedName.toLowerCase()}`;
    const summary = streakLookup.get(key);
    if (summary) {
      entry.streak = summary.currentStreak;
    }
  };

  const walkAndAssign = (comment: Comment) => {
    assignStreak(comment, comment.userName || 'User');
    comment.replies.forEach((reply) => {
      assignStreak(reply, reply.authorName || reply.userName || 'User');
      if (reply.replies && reply.replies.length > 0) {
        reply.replies.forEach((nestedReply) => assignStreak(nestedReply, nestedReply.authorName || nestedReply.userName || 'User'));
      }
    });
  };

  comments.forEach(walkAndAssign);

  // Persist computed streaks to Supabase in the background (best-effort)
  void (async () => {
    try {
      const client = getSupabaseClient();
      if (!client) return;

      const payload = streaks.map((s) => ({
        key: s.key,
        user_id: s.userId ?? null,
        display_name: s.displayName,
        current_streak: s.currentStreak,
        best_streak: s.bestStreak,
        last_active_date: s.lastActiveDate || null,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await client.from('account_streaks').upsert(payload);
      if (error) {
        console.error('Supabase upsert account_streaks failed:', error);
      }
    } catch (err) {
      console.error('Account streak persistence failed:', err);
    }
  })();

  return { comments, streaks };
}

// Persist computed streak summaries to Supabase (best-effort, non-blocking)
;(function persistStreaks() {
  try {
    const client = getSupabaseClient();
    if (!client) return;

    // We will call this function only when the module is loaded and when enrichCommentsWithStreaks is called.
    // To avoid making enrichCommentsWithStreaks async (and changing its callers), callers rely on the side-effect
    // below which is invoked inside enrichCommentsWithStreaks after computing the `streaks` array.
  } catch (err) {
    console.error('Streak persistence initialization failed:', err);
  }
})();

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

function normalizePrivateMessage(row: Record<string, unknown>): ChatMessage {
  return {
    id: Number(row.id ?? 0),
    sender: String(row.sender ?? 'user') === 'ag' ? 'ag' : 'user',
    userId: typeof row.user_id === 'number' ? row.user_id : (typeof row.userId === 'number' ? row.userId : undefined),
    message: String(row.message ?? ''),
    createdAt: String(row.created_at ?? row.createdAt ?? new Date().toISOString()),
  };
}

async function getPrivateMessagesForConversation(client: ReturnType<typeof getSupabaseClient>, conversationId: number): Promise<ChatMessage[]> {
  if (!client) return [];

  const { data, error } = await client.from('private_messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: true });
  if (error) {
    console.error('Supabase private message fetch failed:', error);
    return [];
  }

  return Array.isArray(data) ? data.map((entry) => normalizePrivateMessage(entry as Record<string, unknown>)) : [];
}

async function getConversationMessages(client: ReturnType<typeof getSupabaseClient>, conversation: Conversation): Promise<ChatMessage[]> {
  if (!conversation.messages.length) {
    const fallbackMessages = await getPrivateMessagesForConversation(client, conversation.id);
    return fallbackMessages;
  }

  return conversation.messages;
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

  const [usersResult, conversationsResult, commentsResult] = await Promise.all([
    client.from('app_users').select('*').order('created_at', { ascending: false }),
    client.from('conversations').select('*').order('created_at', { ascending: false }),
    client.from('comments').select('*').order('created_at', { ascending: false }),
  ]);

  const users: User[] = [];
  const seenIds = new Set<number>();

  if (!usersResult.error && Array.isArray(usersResult.data)) {
    usersResult.data.forEach((entry) => {
      const user = normalizeUser(entry as Record<string, unknown>);
      if (user.id > 0) {
        users.push(user);
        seenIds.add(user.id);
      }
    });
  } else if (usersResult.error) {
    console.error('Supabase user list failed:', usersResult.error);
  }

  if (!conversationsResult.error && Array.isArray(conversationsResult.data)) {
    conversationsResult.data.forEach((entry) => {
      const conversation = entry as Record<string, unknown>;
      const userId = Number(conversation.user_id ?? conversation.userId ?? 0);
      const username = String(conversation.username ?? 'User');
      const createdAt = String(conversation.created_at ?? conversation.createdAt ?? new Date().toISOString());
      if (userId > 0 && !seenIds.has(userId)) {
        users.push({
          id: userId,
          username,
          passwordHash: '',
          passwordSalt: '',
          createdAt,
        });
        seenIds.add(userId);
      }
    });
  } else if (conversationsResult.error) {
    console.error('Supabase conversation user list failed:', conversationsResult.error);
  }

  if (!commentsResult.error && Array.isArray(commentsResult.data)) {
    commentsResult.data.forEach((entry) => {
      const comment = entry as Record<string, unknown>;
      const userId = Number(comment.user_id ?? comment.userId ?? 0);
      const username = String(comment.user_name ?? comment.userName ?? 'User');
      const createdAt = String(comment.created_at ?? comment.createdAt ?? new Date().toISOString());
      if (userId > 0 && !seenIds.has(userId)) {
        users.push({
          id: userId,
          username,
          passwordHash: '',
          passwordSalt: '',
          createdAt,
        });
        seenIds.add(userId);
      }
    });
  } else if (commentsResult.error) {
    console.error('Supabase comment user list failed:', commentsResult.error);
  }

  return users.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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

  const { data: existingConversationRow, error } = await client.from('conversations').select('*').eq('user_id', userId).maybeSingle();
  if (!error && existingConversationRow) {
    const conversation = normalizeConversation(existingConversationRow as Record<string, unknown>);
    conversation.messages = await getConversationMessages(client, conversation);
    return conversation;
  }

  if (error) {
    console.error('Supabase conversation lookup failed:', error);
  }

  const createdAt = new Date().toISOString();
  const conversation: Conversation = {
    id: Date.now(),
    userId,
    username,
    createdAt,
    messages: [],
  };

  const { data: insertedConversationRow, error: insertError } = await client.from('conversations').insert({
    user_id: conversation.userId,
    username: conversation.username,
    created_at: conversation.createdAt,
    messages: [],
  }).select('*').single();

  if (insertError || !insertedConversationRow) {
    console.error('Supabase conversation insert failed:', insertError);
    throw new Error(insertError?.message || 'Could not create conversation');
  }

  return normalizeConversation(insertedConversationRow as Record<string, unknown>);
}

export async function getConversationByUserId(userId: number): Promise<Conversation | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data, error } = await client.from('conversations').select('*').eq('user_id', userId).limit(1);
  if (error) {
    console.error('Supabase conversation lookup failed:', error);
    return null;
  }

  if (!Array.isArray(data) || !data[0]) return null;

  const conversation = normalizeConversation(data[0] as Record<string, unknown>);
  conversation.messages = await getConversationMessages(client, conversation);
  return conversation;
}

export async function listConversations(): Promise<Conversation[]> {
  const client = getSupabaseClient();
  if (!client) return [];

  const { data, error } = await client.from('conversations').select('*').order('created_at', { ascending: false });
  if (error) {
    console.error('Supabase conversation list failed:', error);
    return [];
  }

  if (!Array.isArray(data)) return [];

  const conversations = await Promise.all(data.map(async (entry) => {
    const conversation = normalizeConversation(entry as Record<string, unknown>);
    conversation.messages = await getConversationMessages(client, conversation);
    return conversation;
  }));

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
  if (!client) {
    throw new Error('Supabase is not configured');
  }

  const { data, error } = await client.from('conversations').select('*').eq('id', conversationId).limit(1);
  if (error || !Array.isArray(data) || !data[0]) {
    throw new Error('CONVERSATION_NOT_FOUND');
  }

  const existingConversation = data[0] as Record<string, unknown>;
  const existingMessages = Array.isArray(existingConversation.messages) ? (existingConversation.messages as unknown[]) : [];
  const nextId = existingMessages.length > 0 ? Math.max(...existingMessages.map((item) => Number((item as Record<string, unknown>).id ?? 0))) + 1 : 1;
  const chatMessage: ChatMessage = {
    id: nextId,
    sender,
    userId,
    message,
    createdAt: new Date().toISOString(),
  };

  const nextMessages = [...existingMessages, chatMessage];
  const { error: updateError } = await client.from('conversations').update({
    messages: nextMessages,
  }).eq('id', conversationId).select('*').single();

  if (updateError) {
    console.error('Supabase conversation update failed:', updateError);
    throw new Error(updateError.message || 'Could not save message');
  }

  const { error: insertError } = await client.from('private_messages').insert({
    conversation_id: conversationId,
    sender: chatMessage.sender,
    user_id: chatMessage.userId ?? null,
    message: chatMessage.message,
    created_at: chatMessage.createdAt,
  });

  if (insertError) {
    console.error('Supabase private message insert failed:', insertError);
  }

  return chatMessage;
}

export async function clearConversationMessages(conversationId: number): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  const { error: deleteError } = await client.from('private_messages').delete().eq('conversation_id', conversationId);
  if (deleteError) {
    console.error('Supabase private message clear failed:', deleteError);
    return false;
  }

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

export async function setUserStreakOverride(userId: number | undefined, username: string, streak: number): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  if (streak < 0) return false;

  const comments = await listAllComments();
  const normalizedName = username.trim();
  const comment = comments.find((entry) => {
    if (typeof userId === 'number' && userId > 0 && entry.userId === userId) {
      return true;
    }
    return entry.userName === normalizedName;
  });

  if (!comment) {
    return false;
  }

  // persist the override value on the chosen comment and its created_at date (we rely on created_at for override date)
  const { error } = await client.from('comments').update({ streak, created_at: comment.createdAt }).eq('id', comment.id);
  if (error) {
    console.error('Supabase streak override update failed:', error);
    return false;
  }

  return true;
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
  userId?: number,
  userName?: string,
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
    userId: typeof userId === 'number' && userId > 0 ? userId : undefined,
    userName: userName?.trim() || authorName?.trim() || undefined,
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
