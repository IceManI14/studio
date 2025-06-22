
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

const mockReverseGeocodeTool = ai.defineTool(
  {
    name: 'mockReverseGeocodeTool',
    description: 'Mocks a reverse geocoding lookup to get address and place details from GPS coordinates. In a real app, this would call a geocoding API.',
    inputSchema: GetCompanyNameFromCoordsInputSchema,
    outputSchema: z.object({
      locationDescription: z.string().describe('A textual description of the location, potentially including address, phone numbers, and nearby points of interest or company names.'),
    }),
  },
  async ({ latitude, longitude }) => {
    // Simulate different responses based on coordinates for variety
    if (latitude > 40 && longitude < -100) { // e.g., West USA
      return { locationDescription: `Area around 123 Innovation Drive, Tech City, CA. Contact: (555) 555-0101. Primary business: "Future Systems Inc.". Also nearby: "Cafe Bytes".` };
    } else if (latitude < 30 && longitude > -90) { // e.g., Southeast USA
      return { locationDescription: `Vicinity of 456 Commerce St, Business Hub, FL. Tel: (555) 555-0102. Known establishments: "Ocean Breeze Logistics".` };
    } else { // Generic
      return { locationDescription: `Location at coordinates ${latitude.toFixed(4)}, ${longitude.toFixed(4)}. Potential business: "Local Services Co." at 100 Main Street. Phone: (555) 555-0103. May be residential.`};
    }
  }
);

const prompt = ai.definePrompt({
  name: 'getCompanyNameFromCoordsPrompt',
  input: { schema: z.object({ locationDescription: z.string() }) },
  output: { schema: GetCompanyNameFromCoordsOutputSchema },
  tools: [mockReverseGeocodeTool], // Though the tool is called by the flow directly, listing it can be good practice if the prompt needed to decide
  prompt: `You are an expert at identifying company names and their contact details from location descriptions.
Given the following location information: {{{locationDescription}}}

Extract the most likely primary company name, its address, and its phone number.
- If a clear company name is present, provide it.
- If the location seems residential or no specific company is identifiable, return an empty string for 'suggestedCompanyName'.
- If an address or phone number is present, extract it. Otherwise, leave the fields blank.
- Provide a confidence score (a number between 0.0 for no confidence and 1.0 for high confidence) for your identification.

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
    const geocodeResult = await mockReverseGeocodeTool(input);
    
    const { output } = await prompt({ locationDescription: geocodeResult.locationDescription });
    
    if (!output) {
        return { suggestedCompanyName: '', confidenceScore: 0.1 };
    }
    return output;
  }
);
