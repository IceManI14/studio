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
           getAddressComponent(components, 'administrative_area_level_2'); // e.g., "Suffolk County" as a fallback
}

export async function findPlaceFromLatLng(latitude: number, longitude: number): Promise<PlaceDetails | null> {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey || apiKey.includes('YOUR_GOOGLE_MAPS_API_KEY_HERE')) {
        console.error("Google Maps API key is not configured.");
        return null;
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
                        key: apiKey,
                        fields: ['name', 'formatted_address', 'address_components', 'formatted_phone_number'],
                    },
                });

                const placeDetails = detailsResponse.data.result;

                if (placeDetails) {
                    const city = getBestEffortCity(placeDetails.address_components);
                    return {
                        suggestedCompanyName: placeDetails.name || '',
                        address: placeDetails.formatted_address || '',
                        city: city,
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
                suggestedCompanyName: '', // No specific company, but we have an address
                address: firstResult.formatted_address,
                city: city,
                phone: '',
            };
        }

        // If both methods fail to return anything.
        console.warn(`No results from Places API for lat: ${latitude}, lng: ${longitude}`);
        return null;

    } catch (error: any) {
        console.error('Error fetching data from Google Places API:', error);
        if (error.response) {
            console.error('API Error Data:', error.response.data);
        }
        return null;
    }
}
