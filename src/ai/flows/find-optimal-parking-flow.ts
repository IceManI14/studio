'use server';
/**
 * @fileOverview An AI flow to determine the optimal parking location in a city for a salesperson.
 *
 * - findOptimalParking - A function that takes a city name and returns a suggested parking location.
 * - FindOptimalParkingInput - The input type for the findOptimalParking function.
 * - FindOptimalParkingOutput - The return type for the findOptimalParking function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const FindOptimalParkingInputSchema = z.object({
  city: z.string().describe('The city and state, e.g., "Boston, MA", for which to find an optimal parking spot.'),
});
export type FindOptimalParkingInput = z.infer<typeof FindOptimalParkingInputSchema>;

const FindOptimalParkingOutputSchema = z.object({
  latitude: z.number().describe('The latitude of the suggested parking location.'),
  longitude: z.number().describe('The longitude of the suggested parking location.'),
  locationDescription: z.string().describe('A brief description of the suggested area or address for parking.'),
});
export type FindOptimalParkingOutput = z.infer<typeof FindOptimalParkingOutputSchema>;

export async function findOptimalParking(input: FindOptimalParkingInput): Promise<FindOptimalParkingOutput> {
  return findOptimalParkingFlow(input);
}

const prompt = ai.definePrompt({
  name: 'findOptimalParkingPrompt',
  input: {schema: FindOptimalParkingInputSchema},
  output: {schema: FindOptimalParkingOutputSchema},
  prompt: `You are a logistics and sales operations expert for a water cooler company.
Your task is to find the best starting point for a salesperson in a given city to maximize their efficiency when visiting businesses on foot.

For the city of {{{city}}}, identify the downtown area, which is typically the most commercially dense district.

Your primary goal is to find the nearest **free public parking** spot or area (like on-street parking) to the center of this downtown/commercial district. If no free parking is reasonably available, suggest the most cost-effective and centrally-located public parking garage or lot.

This location must be within the United States of America. This location should serve as an optimal starting point for a day of sales visits on foot.

Provide the exact latitude and longitude for this parking location and a short description of why it's a good spot (e.g., "On-street parking near City Hall, free for 2 hours" or "Municipal Garage, central to downtown businesses").`,
});

const findOptimalParkingFlow = ai.defineFlow(
  {
    name: 'findOptimalParkingFlow',
    inputSchema: FindOptimalParkingInputSchema,
    outputSchema: FindOptimalParkingOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if (!output) {
      throw new Error('The AI could not determine an optimal parking location. Please try a different city or check the AI service status.');
    }
    return output;
  }
);
