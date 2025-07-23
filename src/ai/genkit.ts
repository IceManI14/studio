import {genkit, type GenkitPlugin} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

const googleApiKey = process.env.GOOGLE_API_KEY;
// Force disable by setting isGenkitConfigured to false
const isGenkitConfigured = false; 

const plugins: GenkitPlugin[] = [];
if (isGenkitConfigured) {
    plugins.push(googleAI());
} else {
    console.warn("\n⚠️ Genkit is not configured with a Google API key. AI features will be disabled. Please set GOOGLE_API_KEY in your .env file.\n")
}


export const ai = genkit({
  plugins: plugins,
  model: 'googleai/gemini-1.5-flash-latest',
});
