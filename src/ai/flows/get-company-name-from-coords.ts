
'use server';
/**
 * @fileOverview AI flow to suggest a company name and pertinent details based on GPS coordinates.
 *
 * - getCompanyNameFromCoords - A function that suggests a company name from latitude and longitude.
 * - GetCompanyNameFromCoordsInput - The input type for the getCompanyNameFromCoords function.
 * - GetCompanyNameFromCoordsOutput - The return type for the getCompanyNameFromCoords function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GetCompanyNameFromCoordsInputSchema = z.object({
  latitude: z.number().describe('The latitude of the location.'),
  longitude: z.number().describe('The longitude of the location.'),
});
export type GetCompanyNameFromCoordsInput = z.infer<typeof GetCompanyNameFromCoordsInputSchema>;

const GetCompanyNameFromCoordsOutputSchema = z.object({
  suggestedCompanyName: z.string().describe('The suggested company name found at the coordinates. Empty if none found.'),
  confidenceScore: z.number().describe('A score between 0.0 and 1.0 indicating the confidence in the suggestion.'),
  address: z.string().optional().describe("The street address of the company, if found."),
  phone: z.string().optional().describe("A contact phone number for the company, if found."),
});
export type GetCompanyNameFromCoordsOutput = z.infer<typeof GetCompanyNameFromCoordsOutputSchema>;

export async function getCompanyNameFromCoords(input: GetCompanyNameFromCoordsInput): Promise<GetCompanyNameFromCoordsOutput> {
  return getCompanyNameFromCoordsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'getCompanyNameFromCoordsPrompt',
  input: { schema: GetCompanyNameFromCoordsInputSchema },
  output: { schema: GetCompanyNameFromCoordsOutputSchema },
  prompt: `You are an expert reverse geocoder. Your task is to identify the most likely business or public place located at the given GPS coordinates.
  
Latitude: {{{latitude}}}
Longitude: {{{longitude}}}

Based on these coordinates, please provide the following information:
1.  **suggestedCompanyName**: The name of the business or place. If it appears to be a residential area or no specific entity can be identified, return an empty string.
2.  **address**: The full street address of the location.
3.  **phone**: The primary phone number for the business, if available.
4.  **confidenceScore**: A score from 0.0 to 1.0 indicating your confidence in the identification. A high confidence score (e.g., >0.8) means you are very certain. A low score (e.g., <0.3) means it's likely a guess or a residential area.

Your response must be in the format specified by the output schema.
`,
});

const getCompanyNameFromCoordsFlow = ai.defineFlow(
  {
    name: 'getCompanyNameFromCoordsFlow',
    inputSchema: GetCompanyNameFromCoordsInputSchema,
    outputSchema: GetCompanyNameFromCoordsOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    
    if (!output) {
      console.error('getCompanyNameFromCoordsPrompt did not return an output for coordinates:', input);
      return { suggestedCompanyName: '', confidenceScore: 0.0, address: 'Could not determine address.', phone: '' };
    }
    
    return output;
  }
);
