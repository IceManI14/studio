
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
  address: z.string().optional().describe("The full street address of the company, if found."),
  city: z.string().optional().describe("The city of the location, if found."),
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
  prompt: `You are a highly accurate reverse geocoding expert. Your primary task is to identify the business AND the corresponding city for the given GPS coordinates. It is critical that you return the city name.

GPS Coordinates:
Latitude: {{{latitude}}}
Longitude: {{{longitude}}}

Using your knowledge of global mapping data, perform the following steps:
1. Identify the most likely business or public establishment at these exact coordinates.
2. Determine the full mailing address for this location.
3. Extract the **city** from the address.

Your final output must be a JSON object that adheres strictly to the output schema. Populate all fields, especially the 'city'.

- **suggestedCompanyName**: The full name of the business. If it's a residential area or no business can be found, return an empty string.
- **address**: The full street address.
- **city**: The city where the coordinates are located. This field is mandatory. If you can determine an address, you must be able to determine a city.
- **phone**: The primary contact phone number for the business, if available.
- **confidenceScore**: A score from 0.0 to 1.0 indicating your confidence in the identification.
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
      return { suggestedCompanyName: '', confidenceScore: 0.0, address: 'Could not determine address.', city: '', phone: '' };
    }
    
    return output;
  }
);
