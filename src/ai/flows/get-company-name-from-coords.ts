
'use server';
/**
 * @fileOverview A flow to get company details from GPS coordinates using Google Places API.
 *
 * - getCompanyNameFromCoords - A function that suggests a company name from latitude and longitude.
 * - GetCompanyNameFromCoordsInput - The input type for the getCompanyNameFromCoords function.
 * - GetCompanyNameFromCoordsOutput - The return type for the getCompanyNameFromCoords function.
 */

import { z } from 'genkit';
import { findPlaceFromLatLng } from '@/services/google-places';

const GetCompanyNameFromCoordsInputSchema = z.object({
  latitude: z.number().describe('The latitude of the location.'),
  longitude: z.number().describe('The longitude of the location.'),
});
export type GetCompanyNameFromCoordsInput = z.infer<typeof GetCompanyNameFromCoordsInputSchema>;

const GetCompanyNameFromCoordsOutputSchema = z.object({
  suggestedCompanyName: z.string().describe('The suggested company name found at the coordinates. Empty if none found.'),
  confidenceScore: z.number().describe('A score between 0.0 and 1.0 indicating the confidence in the suggestion.'),
  address: z.string().optional().describe("The full street address of the company, if found."),
  city: z.string().optional().describe("The city or fallback address of the location, if found."),
  phone: z.string().optional().describe("A contact phone number for the company, if found."),
});
export type GetCompanyNameFromCoordsOutput = z.infer<typeof GetCompanyNameFromCoordsOutputSchema>;

export async function getCompanyNameFromCoords(input: GetCompanyNameFromCoordsInput): Promise<GetCompanyNameFromCoordsOutput> {
  const placeDetails = await findPlaceFromLatLng(input.latitude, input.longitude);

  if (placeDetails) {
    // Combine city and state for a cleaner display, e.g., "Boston, MA".
    const displayCity = placeDetails.city && placeDetails.state
      ? `${placeDetails.city}, ${placeDetails.state}`
      : placeDetails.city || placeDetails.address;
    
    return {
      suggestedCompanyName: placeDetails.suggestedCompanyName,
      confidenceScore: placeDetails.suggestedCompanyName ? 1.0 : 0.5,
      address: placeDetails.address,
      city: displayCity,
      phone: placeDetails.phone,
    };
  }

  return {
    suggestedCompanyName: '',
    confidenceScore: 0.0,
    address: 'Could not determine address.',
    city: 'Location could not be determined', // Specific message for when no details are found
    phone: '',
  };
}
