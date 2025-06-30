
// Next.js automatically loads .env files.
// Manual loading with `dotenv` is not needed and can cause conflicts.

// Check if the GOOGLE_API_KEY is set and log its status
if (process.env.GOOGLE_API_KEY && process.env.GOOGLE_API_KEY !== "YOUR_GOOGLE_API_KEY_HERE" && process.env.GOOGLE_API_KEY.trim() !== "") {
  console.log('\n✅ Genkit Dev Server: GOOGLE_API_KEY is set (length: ' + process.env.GOOGLE_API_KEY.length + '). Initializing Genkit with Google AI plugin...\n');
} else if (process.env.GOOGLE_API_KEY === "YOUR_GOOGLE_API_KEY_HERE" || process.env.GOOGLE_API_KEY === "" ) {
  console.error('\n❌ Genkit Dev Server: CRITICAL ERROR - GOOGLE_API_KEY is set to the placeholder "YOUR_GOOGLE_API_KEY_HERE" or is empty in your .env file. You MUST replace it with your actual Google API key. Genkit AI features will fail.\n');
} else {
  console.error('\n❌ Genkit Dev Server: CRITICAL ERROR - GOOGLE_API_KEY is NOT SET in your .env file. Genkit AI features will likely fail. Please set it and restart.\n');
}

import '@/ai/flows/scrape-contact-info.ts';
import '@/ai/flows/summarize-visit-notes.ts';
import '@/ai/flows/chat-with-visits-flow.ts';
import '@/ai/flows/find-optimal-parking-flow.ts';
import '@/ai/flows/extract-cities-from-pdf-flow.ts';
import '@/ai/flows/extract-visit-details-flow.ts';

