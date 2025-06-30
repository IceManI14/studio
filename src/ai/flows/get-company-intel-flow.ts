
'use server';
/**
 * @fileOverview An AI flow to get detailed intelligence on a company using its location.
 *
 * - getCompanyIntel - A function that takes a company name and location and returns details.
 * - GetCompanyIntelInput - The input type for the function.
 * - GetCompanyIntelOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {findPlaceFromLatLng} from '@/services/google-places';

const GetCompanyIntelInputSchema = z.object({
  companyName: z.string().describe('The name of the company.'),
  latitude: z.number().describe('The latitude of the company location.'),
  longitude: z.number().describe('The longitude of the company location.'),
});
export type GetCompanyIntelInput = z.infer<typeof GetCompanyIntelInputSchema>;

const GetCompanyIntelOutputSchema = z.object({
  phone: z.string().optional().describe('The main phone number found for the business.'),
  hours: z.array(z.string()).optional().describe('A list of weekly business hours (e.g., "Monday: 9:00 AM – 5:00 PM").'),
  decisionMaker: z.string().optional().describe('A brief summary identifying a potential decision-maker (e.g., owner, office manager), including their name and title if found.'),
});
export type GetCompanyIntelOutput = z.infer<typeof GetCompanyIntelOutputSchema>;

export async function getCompanyIntel(input: GetCompanyIntelInput): Promise<GetCompanyIntelOutput> {
  return getCompanyIntelFlow(input);
}

const decisionMakerPrompt = ai.definePrompt({
    name: 'findDecisionMakerPrompt',
    input: { schema: z.object({ companyName: z.string() }) },
    output: { schema: z.object({ decisionMaker: z.string().optional().describe('A brief summary identifying a potential decision-maker (e.g., owner, office manager), including their name and title if found.') }) },
    prompt: `You are a business intelligence expert. For the company named "{{companyName}}", perform a web search to identify a likely decision-maker. This could be an Owner, Founder, CEO, or Office Manager. Provide a concise summary with their name and title. If no clear person is found, state that it could not be determined.`,
});

const getCompanyIntelFlow = ai.defineFlow(
  {
    name: 'getCompanyIntelFlow',
    inputSchema: GetCompanyIntelInputSchema,
    outputSchema: GetCompanyIntelOutputSchema,
  },
  async ({ companyName, latitude, longitude }) => {
    // Using Promise.all to fetch from Google Places and AI concurrently
    const [placeDetails, decisionMakerResult] = await Promise.all([
      findPlaceFromLatLng(latitude, longitude),
      decisionMakerPrompt({ companyName }),
    ]);

    const decisionMakerOutput = decisionMakerResult.output;

    return {
      phone: placeDetails?.phone,
      hours: placeDetails?.openingHours,
      decisionMaker: decisionMakerOutput?.decisionMaker,
    };
  }
);
