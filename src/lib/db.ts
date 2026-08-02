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

const QUOTES_BLOB_FILENAME = 'quotes.json';
const USERS_BLOB_FILENAME = 'users.json';
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
