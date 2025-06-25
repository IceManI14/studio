
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
        const response = await client.reverseGeocode({
            params: {
                latlng: { latitude, longitude },
                key: apiKey,
                result_type: [PlaceType2.establishment, PlaceType2.point_of_interest, PlaceType2.street_address],
                location_type: 'ROOFTOP'
            },
        });

        if (response.data.results && response.data.results.length > 0) {
            const businessResult = response.data.results.find(r => 
                r.types.includes(PlaceType2.establishment) || 
                r.types.includes(PlaceType2.point_of_interest)
            );

            const result = businessResult || response.data.results[0];

            if (result.place_id) {
                const detailsResponse = await client.placeDetails({
                    params: {
                        place_id: result.place_id,
                        key: apiKey,
                        fields: ['name', 'formatted_address', 'address_components', 'formatted_phone_number'],
                    },
                });

                const placeDetails = detailsResponse.data.result;

                if (placeDetails) {
                    const city = getBestEffortCity(placeDetails.address_components);

                    return {
                        suggestedCompanyName: placeDetails.name || '',
                        address: placeDetails.formatted_address || result.formatted_address,
                        city: city,
                        phone: placeDetails.formatted_phone_number || '',
                    };
                }
            }

            const address_components = response.data.results[0].address_components;
            const city = getBestEffortCity(address_components);

            return {
                suggestedCompanyName: '',
                address: response.data.results[0].formatted_address,
                city: city,
                phone: '',
            };
        }

        return null;
    } catch (error: any) {
        console.error('Error fetching data from Google Places API:', error);
        if (error.response) {
            console.error('API Error Data:', error.response.data);
        }
        return null;
    }
}
