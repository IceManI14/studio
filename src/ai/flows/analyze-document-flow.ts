
'use server';
/**
 * @fileOverview An AI flow to analyze and summarize a document from a URL.
 *
 * - analyzeDocument - A function that takes a document URL and returns a summary.
 * - AnalyzeDocumentInput - The input type for the function.
 * - AnalyzeDocumentOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { readFromDropboxLinkTool } from './dropbox-tool';

const AnalyzeDocumentInputSchema = z.object({
  documentUrl: z.string().url().describe('The URL of the document to analyze. Must be a direct link to a file (e.g., from Dropbox).'),
});
export type AnalyzeDocumentInput = z.infer<typeof AnalyzeDocumentInputSchema>;

const AnalyzeDocumentOutputSchema = z.object({
  summary: z.string().describe('A concise summary of the document content.'),
});
export type AnalyzeDocumentOutput = z.infer<typeof AnalyzeDocumentOutputSchema>;

export async function analyzeDocument(input: AnalyzeDocumentInput): Promise<AnalyzeDocumentOutput> {
  return analyzeDocumentFlow(input);
}

const prompt = ai.definePrompt({
    name: 'summarizeDocumentFromUrlPrompt',
    tools: [readFromDropboxLinkTool],
    input: { schema: AnalyzeDocumentInputSchema },
    output: { schema: AnalyzeDocumentOutputSchema },
    prompt: `You are a document analysis agent.
    Your task is to read the content of a document from a given URL and provide a summary.
    
    1. Use the 'readFromDropboxLink' tool to fetch the content of the file at the URL: {{{documentUrl}}}
    2. Analyze the retrieved text.
    3. Provide a concise summary of the document's key points and takeaways.
    4. Populate the 'summary' field in the output with your summary.
    
    If the tool returns an error message, your summary should be: "I was unable to access or read the document. The tool reported the following error: [error message]".
    `,
});

const analyzeDocumentFlow = ai.defineFlow(
  {
    name: 'analyzeDocumentFlow',
    inputSchema: AnalyzeDocumentInputSchema,
    outputSchema: AnalyzeDocumentOutputSchema,
  },
  async ({ documentUrl }) => {
    const { output } = await prompt({ documentUrl });
    
    if (!output) {
      throw new Error('The AI could not generate a summary for the document.');
    }

    return output;
  }
);
