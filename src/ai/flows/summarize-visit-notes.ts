
// Summarizes company visit notes using generative AI to provide users with key takeaways.

'use server';

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeVisitNotesInputSchema = z.object({
  notes: z.string().describe('The notes from the company visit to summarize.'),
});
export type SummarizeVisitNotesInput = z.infer<typeof SummarizeVisitNotesInputSchema>;

const SummarizeVisitNotesOutputSchema = z.object({
  summary: z.string().describe('A concise summary of the company visit notes.'),
});
export type SummarizeVisitNotesOutput = z.infer<typeof SummarizeVisitNotesOutputSchema>;

export async function summarizeVisitNotes(input: SummarizeVisitNotesInput): Promise<SummarizeVisitNotesOutput> {
  return summarizeVisitNotesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeVisitNotesPrompt',
  input: {schema: SummarizeVisitNotesInputSchema},
  output: {schema: SummarizeVisitNotesOutputSchema},
  prompt: `You are an expert summarizer, skilled at taking notes and providing a concise summary of the key takeaways.\n\nNotes: {{{notes}}}\n\nSummary:`,
});

const summarizeVisitNotesFlow = ai.defineFlow(
  {
    name: 'summarizeVisitNotesFlow',
    inputSchema: SummarizeVisitNotesInputSchema,
    outputSchema: SummarizeVisitNotesOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if (!output) {
      console.error('SummarizeVisitNotesPrompt did not return an output.');
      return { summary: "Could not summarize notes due to an internal error." };
    }
    return output;
  }
);
