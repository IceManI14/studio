
'use server';
/**
 * @fileOverview AI flow for a sales assistant chatbot that uses visit context and can analyze PDFs.
 *
 * - chatWithVisits - Function to get a chat response based on history, visit context, and an optional PDF.
 * - ChatWithVisitsInput - Input type for the chatWithVisits function.
 * - ChatWithVisitsOutput - Output type for the chatWithVisits function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ChatWithVisitsInputSchema = z.object({
  chatHistory: z.string().describe('The conversation history between the user and AI, with each turn on a new line, prefixed by "User:" or "AI:".'),
  userMessage: z.string().describe('The latest message from the user.'),
  visitsContext: z.string().describe('A summary of recent company visits relevant to the conversation. Each visit is separated by "---".'),
  modelName: z.string().describe('The specific Genkit AI model to use (e.g., "googleai/gemini-1.5-flash-latest").'),
  pdfUrl: z.string().optional().describe("An optional URL or Data URI to a PDF document for analysis for the current query. Expected format: 'data:<mimetype>;base64,<encoded_data>', or a publicly accessible https URL."),
  territoryPdfUrl: z.string().optional().describe("A URL or Data URI for the salesperson's territory PDF, providing overarching context."),
});
export type ChatWithVisitsInput = z.infer<typeof ChatWithVisitsInputSchema>;

const ChatWithVisitsOutputSchema = z.object({
  aiResponse: z.string().describe('The AI\'s response to the user.'),
});
export type ChatWithVisitsOutput = z.infer<typeof ChatWithVisitsOutputSchema>;

export async function chatWithVisits(input: ChatWithVisitsInput): Promise<ChatWithVisitsOutput> {
  return chatWithVisitsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'chatWithVisitsPrompt',
  input: {schema: ChatWithVisitsInputSchema.omit({modelName: true})}, // modelName is used by the flow, not the prompt template directly
  output: {schema: ChatWithVisitsOutputSchema},
  prompt: `You are Optimum Trailblazer AI, a friendly and highly knowledgeable sales assistant for Optimum, a company specializing in water solutions (filtration, bottle-free coolers, etc.).
Your goal is to help the salesperson plan their day, analyze visit data, and strategize.

Current Conversation:
{{{chatHistory}}}
User: {{{userMessage}}}

Recent Visit Data for Context (from the last 7 days):
{{#if visitsContext}}
{{{visitsContext}}}
{{else}}
No recent visits found in the last 7 days.
{{/if}}

{{#if territoryPdfUrl}}
The user has provided their sales territory file. Use this as a primary source of context for their geographic area, boundaries, and key locations.
Territory Document:
{{{media url=territoryPdfUrl}}}
{{/if}}

{{#if pdfUrl}}
The user has also attached the following PDF document for additional context for this specific query. Please analyze its content and incorporate relevant information into your response:
{{{media url=pdfUrl}}}
{{/if}}

Based on the conversation, the visit data, and any attached PDF(s), provide a helpful and concise response to the user.
If visit data is relevant, incorporate it naturally into your response.
If a PDF is provided, refer to its content when answering questions or providing analysis related to it.
Always consider the territory information when providing recommendations about locations or planning.
Keep your responses focused on sales strategy, visit planning, and analyzing customer interactions.
Be positive and encouraging.
AI:`,
  config: {
    safetySettings: [
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_ONLY_HIGH',
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_ONLY_HIGH',
      },
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_ONLY_HIGH',
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_ONLY_HIGH',
      },
    ],
  },
});

const chatWithVisitsFlow = ai.defineFlow(
  {
    name: 'chatWithVisitsFlow',
    inputSchema: ChatWithVisitsInputSchema,
    outputSchema: ChatWithVisitsOutputSchema,
  },
  async (input) => {
    const { chatHistory, userMessage, visitsContext, modelName, pdfUrl, territoryPdfUrl } = input;
    
    const { output } = await prompt(
        { chatHistory, userMessage, visitsContext, pdfUrl, territoryPdfUrl }, 
        { model: modelName } 
    );

    if (!output) {
      console.error('ChatWithVisitsPrompt did not return an output for input:', userMessage);
      return { aiResponse: "I'm sorry, I couldn't process that request. Please try rephrasing." };
    }
    return output;
  }
);
