import { put, head } from '@vercel/blob';

// The interface structure for your website's quotes
export interface Quote {
  id: number;
  text: string;
  scheduledDate: string; // Expected format: YYYY-MM-DD
}

const BLOB_FILENAME = 'quotes.json';

// Helper function to pull the latest quotes array from the cloud
async function getCloudQuotes(): Promise<Quote[]> {
  try {
    const fileHead = await head(BLOB_FILENAME);
    const response = await fetch(fileHead.url, { cache: 'no-store' });
    return await response.json();
  } catch {
    return [];
  }
}

// Helper function to save the quotes array back up to the cloud
async function saveCloudQuotes(quotes: Quote[]): Promise<void> {
  const jsonString = JSON.stringify(quotes, null, 2);
  await put(BLOB_FILENAME, jsonString, {
    access: 'private',
    allowOverwrite: true,
    addRandomSuffix: false, 
  });
}

// 1. Fetch all quotes asynchronously
export async function listQuotes(): Promise<Quote[]> {
  return await getCloudQuotes();
}

// 2. Create and push a new quote to cloud storage
export async function createQuote(text: string, scheduledDate: string): Promise<Quote> {
  const quotes = await getCloudQuotes();

  const duplicate = quotes.find(q => q.scheduledDate === scheduledDate);
  if (duplicate) {
    throw new Error("DUPLICATE_DATE");
  }

  const nextId = quotes.length > 0 ? Math.max(...quotes.map(q => q.id)) + 1 : 1;

  const newQuote: Quote = { id: nextId, text, scheduledDate };
  quotes.push(newQuote);

  await saveCloudQuotes(quotes);
  return newQuote;
}

// 3. Delete a quote from cloud storage by its ID
export async function deleteQuote(id: number): Promise<boolean> {
  const quotes = await getCloudQuotes();
  const index = quotes.findIndex(q => q.id === id);

  if (index === -1) return false;

  quotes.splice(index, 1);
  await saveCloudQuotes(quotes);
  return true;
}

// 4. Get a specific quote for a designated date
export async function getQuoteForDate(dateStr: string): Promise<Quote | null> {
  const quotes = await getCloudQuotes();
  return quotes.find(q => q.scheduledDate === dateStr) || null;
}

// 5. Get the newest quote scheduled on or before a given date
export async function getLatestQuoteOnOrBefore(dateStr: string): Promise<Quote | null> {
  const quotes = await getCloudQuotes();
  
  // Filter quotes to find ones on or before today's target date
  const pastQuotes = quotes.filter(q => q.scheduledDate <= dateStr);
  
  if (pastQuotes.length === 0) return null;
  
  // Sort them so the closest date to today comes first
  pastQuotes.sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate));
  return pastQuotes[0];
}
