
'use server';
/**
 * @fileOverview A service for interacting with the Google Maps Places API.
 *
 * - findPlaceFromLatLng - A function to find business details from coordinates.
 * - findPlacesFromText - A function to find a list of business details from a text query.
 */

// This service now uses direct fetch calls to the Google Places API
// instead of the @googlemaps/google-maps-services-js library to avoid bundling issues.

export interface PlaceDetails {
  suggestedCompanyName: string;
  address: string;
  city: string;
  phone: string;
  latitude?: number;
  longitude?: number;
}

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
        const nearbySearchUrl = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
        nearbySearchUrl.searchParams.set('location', `${latitude},${longitude}`);
        nearbySearchUrl.searchParams.set('rankby', 'distance');
        // Prioritize commercial establishments to get better results.
        nearbySearchUrl.searchParams.set('type', 'establishment');
        nearbySearchUrl.searchParams.set('key', apiKey);

        const nearbySearchResponse = await fetch(nearbySearchUrl.toString());
        const nearbySearchData = await nearbySearchResponse.json();
        
        if (nearbySearchData.status !== 'OK' && nearbySearchData.status !== 'ZERO_RESULTS') {
            throw new Error(`Google Places API Error (Nearby Search): ${nearbySearchData.status} - ${nearbySearchData.error_message || 'Unknown error'}`);
        }

        // If we find a nearby place, use its place_id to get definitive details.
        if (nearbySearchData.results && nearbySearchData.results.length > 0) {
            // Find the first result that is not an undesirable type like a parking lot or intersection.
            const findBestPlace = (results: any[]) => {
                for (const place of results) {
                    const types = place.types || [];
                    const isParking = types.includes('parking');
                    const isGeographic = types.some((type: string) => ['locality', 'political', 'neighborhood', 'route', 'sublocality', 'intersection'].includes(type));
                    
                    // Skip if it's primarily a parking lot or a geographical area/intersection.
                    // We want actual businesses/venues.
                    if (!isParking && !isGeographic) {
                        return place; // This is a good candidate
                    }
                }
                // If no suitable candidates were found, return null. The logic will then fall back to reverse geocoding.
                return null;
            };
            
            const bestPlaceCandidate = findBestPlace(nearbySearchData.results);
            
            if (bestPlaceCandidate && bestPlaceCandidate.place_id) {
                 const detailsUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json');
                 detailsUrl.searchParams.set('place_id', bestPlaceCandidate.place_id);
                 detailsUrl.searchParams.set('fields', 'name,formatted_address,address_components,formatted_phone_number,geometry,types');
                 detailsUrl.searchParams.set('key', apiKey);

                 const detailsResponse = await fetch(detailsUrl.toString());
                 const detailsData = await detailsResponse.json();

                 if (detailsData.status !== 'OK') {
                    throw new Error(`Google Places API Error (Place Details): ${detailsData.status} - ${detailsData.error_message || 'Unknown error'}`);
                 }
                
                const placeDetails = detailsData.result;

                if (placeDetails) {
                    const isGeographicArea = placeDetails.types?.some((type: string) =>
                        [
                            'locality', 'political', 'administrative_area_level_1', 'administrative_area_level_2',
                            'country', 'postal_code', 'neighborhood'
                        ].includes(type)
                    );

                    const city = getBestEffortCity(placeDetails.address_components);
                    return {
                        suggestedCompanyName: isGeographicArea ? '' : (placeDetails.name || ''),
                        address: placeDetails.formatted_address || (city ? '' : 'No address found'),
                        city: city || "Unknown Location",
                        phone: placeDetails.formatted_phone_number || '',
                        latitude: placeDetails.geometry?.location?.lat,
                        longitude: placeDetails.geometry?.location?.lng,
                    };
                }
            }
        }
        
        // Step 2: If Nearby Search finds nothing, fall back to Reverse Geocode to get address info.
        const reverseGeocodeUrl = new URL('https://maps.googleapis.com/maps/api/geocode/json');
        reverseGeocodeUrl.searchParams.set('latlng', `${latitude},${longitude}`);
        reverseGeocodeUrl.searchParams.set('key', apiKey);

        const reverseGeocodeResponse = await fetch(reverseGeocodeUrl.toString());
        const reverseGeocodeData = await reverseGeocodeResponse.json();
        
        if (reverseGeocodeData.status !== 'OK' && reverseGeocodeData.status !== 'ZERO_RESULTS') {
            throw new Error(`Google Places API Error (Reverse Geocode): ${reverseGeocodeData.status} - ${reverseGeocodeData.error_message || 'Unknown error'}`);
        }

        if (reverseGeocodeData.results && reverseGeocodeData.results.length > 0) {
            const firstResult = reverseGeocodeData.results[0];
            const city = getBestEffortCity(firstResult.address_components);
            
            return {
                suggestedCompanyName: '', // Do not use address as a fallback for company name
                address: firstResult.formatted_address,
                city: city || "Unknown Location",
                phone: '',
                latitude: firstResult.geometry?.location?.lat,
                longitude: firstResult.geometry?.location?.lng,
            };
        }

        // If all methods fail to return anything.
        console.warn(`No results from Places API for lat: ${latitude}, lng: ${longitude}`);
        return null;

    } catch (error: any) {
        console.error('Error fetching data from Google Places API:', error);
        // Re-throw the error so the calling action can handle it and show a toast.
        throw error;
    }
}

export async function findPlacesFromText(query: string): Promise<PlaceDetails[]> {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey || apiKey.includes('YOUR_GOOGLE_MAPS_API_KEY_HERE')) {
        throw new Error("Google Maps API key is not configured correctly in .env file.");
    }

    try {
        const textSearchUrl = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
        textSearchUrl.searchParams.set('query', query);
        textSearchUrl.searchParams.set('key', apiKey);

        const textSearchResponse = await fetch(textSearchUrl.toString());
        const textSearchData = await textSearchResponse.json();

        if (textSearchData.status !== 'OK' && textSearchData.status !== 'ZERO_RESULTS') {
            throw new Error(`Google Places API Error (Text Search): ${textSearchData.status} - ${textSearchData.error_message || 'Unknown error'}`);
        }

        if (!textSearchData.results || textSearchData.results.length === 0) {
            return [];
        }

        // Using Promise.all to fetch details in parallel
        const detailPromises = textSearchData.results.map(async (candidate: any) => {
            if (!candidate.place_id) return null;

            const detailsUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json');
            detailsUrl.searchParams.set('place_id', candidate.place_id);
            detailsUrl.searchParams.set('fields', 'name,formatted_address,address_components,formatted_phone_number,geometry');
            detailsUrl.searchParams.set('key', apiKey);

            const detailsResponse = await fetch(detailsUrl.toString());
            const detailsData = await detailsResponse.json();

            if (detailsData.status === 'OK' && detailsData.result) {
                const placeDetails = detailsData.result;
                const city = getBestEffortCity(placeDetails.address_components);
                return {
                    suggestedCompanyName: placeDetails.name || '',
                    address: placeDetails.formatted_address || '',
                    city: city || "Unknown Location",
                    phone: placeDetails.formatted_phone_number || '',
                    latitude: placeDetails.geometry?.location?.lat,
                    longitude: placeDetails.geometry?.location?.lng,
                };
            }
            return null;
        });

        const places = (await Promise.all(detailPromises)).filter(p => p !== null) as PlaceDetails[];
        return places;

    } catch (error: any) {
        console.error('Error fetching data from Google Places API:', error);
        throw error;
    }
}
