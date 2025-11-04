
'use server';
/**
 * @fileOverview A flow to get company details from GPS coordinates using a free reverse geocoding service.
 *
 * - getCompanyNameFromCoords - A function that suggests a company name from latitude and longitude.
 * - GetCompanyNameFromCoordsInput - The input type for the getCompanyNameFromCoords function.
 * - GetCompanyNameFromCoordsOutput - The return type for the getCompanyNameFromCoords function.
 */

import { z } from 'genkit';

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

// Simple, free reverse geocoder (example using OpenStreetMap Nominatim)
async function reverseGeocode(lat: number, lon: number): Promise<{ address?: string; city?: string; }> {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
    if (!response.ok) return {};
    const data = await response.json();
    
    const addressParts = data.address;
    if (!addressParts) return {};

    const street = addressParts.road || '';
    const houseNumber = addressParts.house_number || '';
    const city = addressParts.city || addressParts.town || addressParts.village || '';
    const state = addressParts.state || '';
    const postcode = addressParts.postcode || '';

    const fullAddress = `${houseNumber} ${street}`.trim();

    return {
      address: fullAddress ? `${fullAddress}, ${city}, ${state} ${postcode}` : `${city}, ${state}`,
      city: city && state ? `${city}, ${state}`: city || state
    };
  } catch (error) {
    console.error("Reverse geocoding failed:", error);
    return {};
  }
}

export async function getCompanyNameFromCoords(input: GetCompanyNameFromCoordsInput): Promise<GetCompanyNameFromCoordsOutput> {
  const geoDetails = await reverseGeocode(input.latitude, input.longitude);

  return {
    suggestedCompanyName: '', // We can't get company name from free service
    confidenceScore: 0.5,
    address: geoDetails.address || 'Could not determine address.',
    city: geoDetails.city || 'Location could not be determined',
    phone: '',
  };
}
