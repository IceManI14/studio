
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
  placeId: string;
  suggestedCompanyName: string;
  address: string;
  city: string;
  state: string;
  phone: string;
  latitude?: number;
  longitude?: number;
  openingHours?: string[];
}

// New interface for search bounds
export interface SearchBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

// Helper to extract address components
const getAddressComponent = (components: any[], type: string, useShortName = false) => {
    const component = components.find(c => c.types.includes(type));
    if (!component) return '';
    return useShortName ? component.short_name : component.long_name;
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
        nearbySearchUrl.searchParams.set('region', 'us'); // Bias results to the US
        nearbySearchUrl.searchParams.set('key', apiKey);

        const nearbySearchResponse = await fetch(nearbySearchUrl.toString());
        const nearbySearchData = await nearbySearchResponse.json();
        
        if (nearbySearchData.status !== 'OK' && nearbySearchData.status !== 'ZERO_RESULTS') {
            throw new Error(`Google Places API Error (Nearby Search): ${nearbySearchData.status} - ${nearbySearchData.error_message || 'Unknown error'}`);
        }

        // If we find a nearby place, use its place_id to get definitive details.
        if (nearbySearchData.results && nearbySearchData.results.length > 0) {
            // Find the first result that is not an undesirable type like a park or intersection.
            const findBestPlace = (results: any[]) => {
                for (const place of results) {
                    const types = place.types || [];
                    // More comprehensive list of types to ignore.
                    const isUndesirable = types.some((type: string) => [
                        'park', 'parking', 'intersection', 'route', 
                        'locality', 'political', 'neighborhood', 'sublocality', 
                        'administrative_area_level_1', 'administrative_area_level_2',
                        'country', 'postal_code'
                    ].includes(type));
                    
                    // Skip if it's primarily a non-business entity.
                    if (!isUndesirable) {
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
                 detailsUrl.searchParams.set('fields', 'name,formatted_address,address_components,formatted_phone_number,geometry,types,opening_hours');
                 detailsUrl.searchParams.set('key', apiKey);

                 const detailsResponse = await fetch(detailsUrl.toString());
                 const detailsData = await detailsResponse.json();

                 if (detailsData.status !== 'OK') {
                    throw new Error(`Google Places API Error (Place Details): ${detailsData.status} - ${detailsData.error_message || 'Unknown error'}`);
                 }
                
                const placeDetails = detailsData.result;

                if (placeDetails) {
                    // A second, redundant check on the detailed types to ensure it's a business.
                    const isGeographicArea = placeDetails.types?.some((type: string) =>
                        [
                            'park', 'parking', // Explicitly add park/parking here too
                            'locality', 'political', 'administrative_area_level_1', 'administrative_area_level_2',
                            'country', 'postal_code', 'neighborhood', 'route', 'intersection'
                        ].includes(type)
                    );

                    // NEW check: if the name looks like a street address or intersection, it's not a company name.
                    const looksLikeAddress = (name: string | undefined): boolean => {
                        if (!name) return false;
                        // Checks for a number at the beginning of a string, or common intersection patterns.
                        // This helps filter out results like "123 Main St" or "Main St & 1st Ave".
                        return /^\d+\s/.test(name) || /\s(&|and|@|opp)\s/i.test(name);
                    };

                    // A name is considered invalid if it's a geographic area or looks like an address.
                    const companyNameIsInvalid = isGeographicArea || looksLikeAddress(placeDetails.name);

                    const city = getBestEffortCity(placeDetails.address_components);
                    const state = getAddressComponent(placeDetails.address_components, 'administrative_area_level_1', true);
                    return {
                        placeId: bestPlaceCandidate.place_id,
                        suggestedCompanyName: companyNameIsInvalid ? '' : (placeDetails.name || ''),
                        address: placeDetails.formatted_address || (city ? '' : 'No address found'),
                        city: city || "Unknown Location",
                        state: state,
                        phone: placeDetails.formatted_phone_number || '',
                        latitude: placeDetails.geometry?.location?.lat,
                        longitude: placeDetails.geometry?.location?.lng,
                        openingHours: placeDetails.opening_hours?.weekday_text,
                    };
                }
            }
        }
        
        // Step 2: If Nearby Search finds nothing, fall back to Reverse Geocode to get address info.
        const reverseGeocodeUrl = new URL('https://maps.googleapis.com/maps/api/geocode/json');
        reverseGeocodeUrl.searchParams.set('latlng', `${latitude},${longitude}`);
        reverseGeocodeUrl.searchParams.set('components', 'country:US'); // Restrict to USA
        reverseGeocodeUrl.searchParams.set('key', apiKey);

        const reverseGeocodeResponse = await fetch(reverseGeocodeUrl.toString());
        const reverseGeocodeData = await reverseGeocodeResponse.json();
        
        if (reverseGeocodeData.status !== 'OK' && reverseGeocodeData.status !== 'ZERO_RESULTS') {
            throw new Error(`Google Places API Error (Reverse Geocode): ${reverseGeocodeData.status} - ${reverseGeocodeData.error_message || 'Unknown error'}`);
        }

        if (reverseGeocodeData.results && reverseGeocodeData.results.length > 0) {
            const firstResult = reverseGeocodeData.results[0];
            const city = getBestEffortCity(firstResult.address_components);
            const state = getAddressComponent(firstResult.address_components, 'administrative_area_level_1', true);
            
            return {
                placeId: firstResult.place_id,
                suggestedCompanyName: '', // Do not use address as a fallback for company name
                address: firstResult.formatted_address,
                city: city || "Unknown Location",
                state: state,
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

// Updated function to accept optional bounds
export async function findPlacesFromText(query: string, bounds?: SearchBounds): Promise<PlaceDetails[]> {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey || apiKey.includes('YOUR_GOOGLE_MAPS_API_KEY_HERE')) {
        throw new Error("Google Maps API key is not configured correctly in .env file.");
    }

    try {
        const textSearchUrl = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
        textSearchUrl.searchParams.set('query', query);
        textSearchUrl.searchParams.set('region', 'us'); // Bias to USA
        
        // Add location bias if bounds are provided
        if (bounds) {
          textSearchUrl.searchParams.set('locationbias', `rectangle:${bounds.minLat},${bounds.minLng}|${bounds.maxLat},${bounds.maxLng}`);
        }
        
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
            detailsUrl.searchParams.set('fields', 'name,formatted_address,address_components,formatted_phone_number,geometry,opening_hours');
            detailsUrl.searchParams.set('key', apiKey);

            const detailsResponse = await fetch(detailsUrl.toString());
            const detailsData = await detailsResponse.json();

            if (detailsData.status === 'OK' && detailsData.result) {
                const placeDetails = detailsData.result;
                const city = getBestEffortCity(placeDetails.address_components);
                const state = getAddressComponent(placeDetails.address_components, 'administrative_area_level_1', true);
                return {
                    placeId: candidate.place_id,
                    suggestedCompanyName: placeDetails.name || '',
                    address: placeDetails.formatted_address || '',
                    city: city || "Unknown Location",
                    state: state,
                    phone: placeDetails.formatted_phone_number || '',
                    latitude: placeDetails.geometry?.location?.lat,
                    longitude: placeDetails.geometry?.location?.lng,
                    openingHours: placeDetails.opening_hours?.weekday_text,
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
