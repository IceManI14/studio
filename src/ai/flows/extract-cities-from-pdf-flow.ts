
'use server';
/**
 * @fileOverview An AI flow to extract a list of cities and towns from a PDF document.
 *
 * - extractCitiesFromPdf - A function that takes a PDF and returns a list of cities.
 * - ExtractCitiesFromPdfInput - The input type for the function.
 * - ExtractCitiesFromPdfOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

export const ExtractCitiesFromPdfInputSchema = z.object({
  pdfDataUri: z.string().describe("A territory PDF document, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:application/pdf;base64,<encoded_data>'."),
});
export type ExtractCitiesFromPdfInput = z.infer<typeof ExtractCitiesFromPdfInputSchema>;

export const ExtractCitiesFromPdfOutputSchema = z.object({
  cities: z.array(z.string()).describe('A list of all unique cities and towns found in the document. Each entry should be in "City, ST" format, e.g., "Boston, MA". Do not include duplicates.'),
});
export type ExtractCitiesFromPdfOutput = z.infer<typeof ExtractCitiesFromPdfOutputSchema>;

export async function extractCitiesFromPdf(input: ExtractCitiesFromPdfInput): Promise<ExtractCitiesFromPdfOutput> {
  return extractCitiesFromPdfFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractCitiesFromPdfPrompt',
  input: {schema: ExtractCitiesFromPdfInputSchema},
  output: {schema: ExtractCitiesFromPdfOutputSchema},
  prompt: `You are a data extraction specialist. Your task is to analyze the provided PDF document, which outlines a sales territory.
  
Identify and list all unique cities and towns mentioned in the document.
Format each entry as "City, State Abbreviation" (e.g., "Boston, MA", "Providence, RI").
Ensure the list contains no duplicate entries.

PDF for analysis:
{{{media url=pdfDataUri}}}`,
});

const extractCitiesFromPdfFlow = ai.defineFlow(
  {
    name: 'extractCitiesFromPdfFlow',
    inputSchema: ExtractCitiesFromPdfInputSchema,
    outputSchema: ExtractCitiesFromPdfOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    if (!output) {
      throw new Error('The AI could not extract cities from the provided PDF. Please ensure the document is clear and contains city/town names.');
    }
    // Sort the cities alphabetically for a better user experience
    output.cities.sort();
    return output;
  }
);
