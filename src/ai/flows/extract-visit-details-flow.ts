'use server';
/**
 * @fileOverview An AI flow to extract structured details from unstructured visit notes.
 *
 * - extractVisitDetails - A function that takes visit notes and returns structured data.
 * - ExtractVisitDetailsInput - The input type for the function.
 * - ExtractVisitDetailsOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractVisitDetailsInputSchema = z.object({
  notes: z.string().describe('The unstructured text notes from a sales visit.'),
  currentDate: z.string().describe('The current date in YYYY-MM-DD format, to provide context for relative dates like "next Tuesday".'),
});
export type ExtractVisitDetailsInput = z.infer<typeof ExtractVisitDetailsInputSchema>;

const ExtractVisitDetailsOutputSchema = z.object({
  hasBusinessCard: z.boolean().optional().describe("Set to true if the notes mention collecting, receiving, or having a business card."),
  competitorName: z.string().optional().describe("The name of any competitor company mentioned (e.g., Culligan, WB Mason, Ready Refresh)."),
  decisionMakerName: z.string().optional().describe("The name of the decision-maker or contact person mentioned."),
  decisionMakerTitle: z.string().optional().describe("The job title of the decision-maker (e.g., Office Manager, CEO)."),
  tdsValue: z.number().optional().describe("The numerical TDS (Total Dissolved Solids) value if mentioned in the notes (e.g., 'TDS was 150')."),
  interestedUnit: z.string().optional().describe("The specific water cooler model or type the client is interested in."),
  futureMeetingSet: z.boolean().optional().describe("Set to true if the notes mention that a future meeting or follow-up was scheduled or booked."),
  futureMeetingDateTime: z.string().optional().describe("If a future meeting is set, extract the specific date and time. Return in a machine-readable format like 'YYYY-MM-DDTHH:mm:ss'. If only a date is mentioned, assume 9:00 AM local time."),
  freeTrial: z.boolean().optional().describe("Set to true if a free trial was discussed, agreed upon, or set up."),
});
export type ExtractVisitDetailsOutput = z.infer<typeof ExtractVisitDetailsOutputSchema>;

export async function extractVisitDetails(input: ExtractVisitDetailsInput): Promise<ExtractVisitDetailsOutput> {
  return extractVisitDetailsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractVisitDetailsPrompt',
  input: {schema: ExtractVisitDetailsInputSchema},
  output: {schema: ExtractVisitDetailsOutputSchema},
  prompt: `You are an intelligent assistant that analyzes sales visit notes and extracts structured information.
  
The current date is {{{currentDate}}}. Use this for context when interpreting relative dates (e.g., "next Tuesday", "July 8th").

Analyze the following notes. Based ONLY on the text provided, extract the specified fields.
- If the notes say they got a business card, set hasBusinessCard to true.
- If a competitor is mentioned by name, extract it.
- If a person's name and/or title is mentioned as a contact or decision-maker, extract them.
- If a specific TDS parts-per-million (PPM) value is mentioned, extract the number.
- If they are interested in a specific unit, extract its name.
- If a future meeting was booked or scheduled, set futureMeetingSet to true and extract the date/time into futureMeetingDateTime. If no specific time is mentioned, default to 9:00 AM.
- If a free trial was set up, set freeTrial to true.

Do not infer or make up information that isn't explicitly in the notes. If a piece of information is not present, omit its key from the output.

Notes:
{{{notes}}}`,
});

const extractVisitDetailsFlow = ai.defineFlow(
  {
    name: 'extractVisitDetailsFlow',
    inputSchema: ExtractVisitDetailsInputSchema,
    outputSchema: ExtractVisitDetailsOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    if (!output) {
      throw new Error('The AI could not extract any details from the provided notes.');
    }
    return output;
  }
);
