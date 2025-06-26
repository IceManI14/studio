
'use server';
/**
 * @fileOverview A service for interacting with the Google Maps Places API.
 *
 * - findPlaceFromLatLng - A function to find business details from coordinates.
 */

import { Client, PlaceType2 } from '@googlemaps/google-maps-services-js';

export interface PlaceDetails {
  suggestedCompanyName: string;
  address: string;
  city: string;
  phone: string;
}

const client = new Client({});

// Helper to extract address components
const getAddressComponent = (components: any[], type: string) => {
    const component = components.find(c => c.types.includes(type));
    return component ? component.long_name : '';
};

const getBestEffortCity = (components: any[] | undefined): string => {
    if (!components) return '';
    // Tries to find the most specific location name available by checking multiple types.
    return getAddressComponent(components, 'locality') ||          // e.g., "Boston"
           getAddressComponent(components, 'postal_town') ||         // e.g., "Cambridge" (can cover multiple localities)
           getAddressComponent(components, 'sublocality_level_1') || // e.g., a specific borough or district
           getAddressComponent(components, 'administrative_area_level_2') || // e.g., "Suffolk County" as a fallback
           getAddressComponent(components, 'political'); // A general political entity, often a city or town
}

export async function findPlaceFromLatLng(latitude: number, longitude: number): Promise<PlaceDetails | null> {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey || apiKey.includes('YOUR_GOOGLE_MAPS_API_KEY_HERE')) {
        throw new Error("Google Maps API key is not configured correctly in .env file.");
    }

    try {
        // Step 1: Use Nearby Search to find the closest established place.
        // This is more effective for finding business names than reverse geocoding.
        const nearbySearchResponse = await client.nearbySearch({
            params: {
                location: { lat: latitude, lng: longitude },
                rankby: 'distance', // Prioritizes the very closest results
                key: apiKey,
            }
        });
        
        // If we find a nearby place, use its place_id to get definitive details.
        if (nearbySearchResponse.data.results && nearbySearchResponse.data.results.length > 0) {
            const closestPlace = nearbySearchResponse.data.results[0];

            if (closestPlace.place_id) {
                 const detailsResponse = await client.placeDetails({
                    params: {
                        place_id: closestPlace.place_id,
                        fields: ['name', 'formatted_address', 'address_components', 'formatted_phone_number'],
                        key: apiKey, // Added API key to placeDetails request
                    },
                });

                const placeDetails = detailsResponse.data.result;

                if (placeDetails) {
                    const city = getBestEffortCity(placeDetails.address_components);
                    return {
                        suggestedCompanyName: placeDetails.name || '',
                        address: placeDetails.formatted_address || (city ? '' : 'No address found'),
                        city: city || "Unknown Location",
                        phone: placeDetails.formatted_phone_number || '',
                    };
                }
            }
        }
        
        // Step 2: If Nearby Search finds nothing, fall back to Reverse Geocode.
        // This is good for getting a street address and city when no specific business is found.
        const reverseGeocodeResponse = await client.reverseGeocode({
            params: {
                latlng: { latitude, longitude },
                key: apiKey,
            },
        });

        if (reverseGeocodeResponse.data.results && reverseGeocodeResponse.data.results.length > 0) {
            const firstResult = reverseGeocodeResponse.data.results[0];
            const city = getBestEffortCity(firstResult.address_components);
            
            return {
                suggestedCompanyName: firstResult.formatted_address, // Use address as fallback name
                address: firstResult.formatted_address,
                city: city || "Unknown Location",
                phone: '',
            };
        }

        // If both methods fail to return anything.
        console.warn(`No results from Places API for lat: ${latitude}, lng: ${longitude}`);
        return null;

    } catch (error: any) {
        console.error('Error fetching data from Google Places API:', error);
        let userMessage = "An unknown error occurred while connecting to Google Places API.";
        if (error.response?.data?.error_message) {
            userMessage = `Google Places API Error: ${error.response.data.error_message}`;
        } else if (error.response?.data?.status) {
            userMessage = `Google Places API responded with status: ${error.response.data.status}. This may be an API key issue.`;
        } else if (error.message) {
            userMessage = error.message;
        }
        // Instead of returning null, throw an error that the action can catch.
        throw new Error(userMessage);
    }
}
