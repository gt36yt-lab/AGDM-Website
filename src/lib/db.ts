import { put, head } from '@vercel/blob';

// The interface structure for your website's quotes
interface Quote {
  id: number;
  text: string;
  scheduledDate: string;
}

const BLOB_FILENAME = 'quotes.json';

// Helper function to pull the latest quotes array from the cloud
async function getCloudQuotes(): Promise<Quote[]> {
  try {
    // Check if the file already exists in your cloud bucket
    const fileHead = await head(BLOB_FILENAME);
    const response = await fetch(fileHead.url, { cache: 'no-store' });
    return await response.json();
  } catch {
    // If the file doesn't exist yet in the cloud, start with an empty list
    return [];
  }
}

// Helper function to save the quotes array back up to the cloud
async function saveCloudQuotes(quotes: Quote[]): Promise<void> {
  const jsonString = JSON.stringify(quotes, null, 2);
  await put(BLOB_FILENAME, jsonString, {
    access: 'public',
    addRandomSuffix: false, // Keeps the filename exactly 'quotes.json'
  });
}

// 1. Fetch all quotes asynchronously (We wrap it in a function wrapper)
export async function listQuotes(): Promise<Quote[]> {
  return await getCloudQuotes();
}

// 2. Create and push a new quote to cloud storage
export async function createQuote(text: string, scheduledDate: string): Promise<Quote> {
  const quotes = await getCloudQuotes();

  // Check for duplicate date constraints
  const duplicate = quotes.find(q => q.scheduledDate === scheduledDate);
  if (duplicate) {
    throw new Error("DUPLICATE_DATE");
  }

  // Auto-increment the id
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