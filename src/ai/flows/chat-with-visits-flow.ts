
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
import { readFromDropboxLinkTool } from './dropbox-tool';

const ChatWithVisitsInputSchema = z.object({
  chatHistory: z.string().describe('The conversation history between the user and AI, with each turn on a new line, prefixed by "User:" or "AI:".'),
  userMessage: z.string().describe('The latest message from the user.'),
  visitsContext: z.string().describe('A summary of recent company visits relevant to the conversation. Each visit is separated by "---".'),
  modelName: z.string().describe('The specific Genkit AI model to use (e.g., "googleai/gemini-1.5-flash-latest").'),
  pdfUrl: z.string().optional().describe("An optional URL or Data URI to a PDF document for analysis for the current query. Expected format: 'data:<mimetype>;base64,<encoded_data>', or a publicly accessible https URL."),
  csvData: z.string().optional().describe('An optional string containing data from a CSV file for analysis.'),
  territoryPdfUrl: z.string().optional().describe("A URL or Data URI for the salesperson's territory PDF, providing overarching context."),
  managedFiles: z.array(z.object({
    name: z.string(),
    url: z.string(),
  })).optional().describe('A list of persistently uploaded files (PDFs or CSVs) to use as long-term context.'),
  newsItems: z.array(z.string()).optional().describe('A list of recent company news items to provide context for advice.'),
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
  tools: [readFromDropboxLinkTool],
  prompt: `You are Debbie, a friendly and highly knowledgeable sales assistant for Optimum, a company specializing in water solutions (filtration, bottle-free coolers, etc.).
Your goal is to help the salesperson plan their day, analyze visit data, and strategize.

{{#if newsItems}}
IMPORTANT: You MUST consider the following recent company news items when providing advice. These are critical, time-sensitive updates.
{{#each newsItems}}
- {{this}}
{{/each}}

{{/if}}
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
The user has provided their sales territory file. This document defines their official sales boundaries. Use this as the primary source of truth for their geographic area, boundaries, and key locations.
Territory Document:
{{{media url=territoryPdfUrl}}}
{{/if}}

{{#if managedFiles}}
The user has provided the following persistent files for long-term context. Analyze their content and incorporate relevant information into your response:
{{#each managedFiles}}
- {{this.name}}: {{{media url=this.url}}}
{{/each}}
{{/if}}

{{#if pdfUrl}}
The user has also attached the following PDF document for additional context for this specific query. Please analyze its content and incorporate relevant information into your response:
{{{media url=pdfUrl}}}
{{/if}}

{{#if csvData}}
The user has also attached the following CSV data (e.g., a client list) for analysis for this specific query. Analyze its content and incorporate relevant information into your response.
CSV Data:
\`\`\`csv
{{{csvData}}}
\`\`\`
{{/if}}

Based on the conversation, the visit data, and any attached file(s), provide a helpful and concise response to the user.
If visit data is relevant, incorporate it naturally into your response.

{{#if csvData}}
{{#if territoryPdfUrl}}
**Crucial Instruction:** When analyzing the attached CSV data, you MUST cross-reference it with the user's sales territory PDF. Any analysis, suggestions, or summaries based on the CSV should be strictly limited to clients or locations that fall WITHIN the boundaries defined in the territory document. Explicitly mention if you are filtering the CSV data based on the territory.

**Target Identification Task:** If the user asks for companies to target, follow these steps:
1. Analyze the CSV of partners and clients. Look for a column indicating their status (e.g., "Status", "Contract", "Service Level").
2. Filter this list to only include locations within the user's sales territory, as defined by the attached territory PDF.
3. From the filtered list, identify companies that are NOT yet active clients. These might be marked as "Prospect", "Lead", have no status, or a similar indicator. Assume any company without a clear "Active" or "Partner" status is a potential target.
4. Present these companies to the salesperson as a list of potential targets to visit.
{{else}}
When analyzing the attached CSV data, provide insights based on its content.
{{/if}}
{{/if}}

**File Handling Instructions:**
- For PDFs or CSVs attached via the app's upload feature, their content is already available to you under the "Managed Files", "Territory Document", or temporary PDF/CSV sections.
- If the user provides a Dropbox link in their message, you MUST use the \`readFromDropboxLink\` tool to fetch its content. Analyze the retrieved content to answer the user's query.

Always consider the territory information and any managed files when providing recommendations about locations or planning.
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
        threshold: 'BLOCK_NONE',
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
    const { chatHistory, userMessage, visitsContext, modelName, pdfUrl, csvData, territoryPdfUrl, managedFiles, newsItems } = input;
    
    const { output } = await prompt(
        { chatHistory, userMessage, visitsContext, pdfUrl, csvData, territoryPdfUrl, managedFiles, newsItems }, 
        { model: modelName } 
    );

    if (!output) {
      console.error('ChatWithVisitsPrompt did not return an output for input:', userMessage);
      return { aiResponse: "I'm sorry, I couldn't process that request. Please try rephrasing." };
    }
    return output;
  }
);
