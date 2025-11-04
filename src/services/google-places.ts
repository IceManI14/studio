
'use server';
/**
 * @fileOverview A service for interacting with location services.
 * This service uses a free reverse geocoding API.
 */

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

export interface SearchBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

const FREE_GEOCODER_URL = "https://nominatim.openstreetmap.org";

async function reverseGeocode(lat: number, lon: number): Promise<any> {
  try {
    const response = await fetch(`${FREE_GEOCODER_URL}/reverse?format=json&lat=${lat}&lon=${lon}`);
    if (!response.ok) return {};
    return await response.json();
  } catch (error) {
    console.error("Reverse geocoding failed:", error);
    return {};
  }
}

async function searchGeocode(query: string, bounds?: SearchBounds): Promise<any[]> {
    try {
        let url = `${FREE_GEOCODER_URL}/search?format=json&q=${encodeURIComponent(query)}`;
        if (bounds) {
            url += `&viewbox=${bounds.minLng},${bounds.maxLat},${bounds.maxLng},${bounds.minLat}&bounded=1`;
        }
        const response = await fetch(url);
        if (!response.ok) return [];
        return await response.json();
    } catch (error) {
        console.error("Search geocoding failed:", error);
        return [];
    }
}


export async function findPlaceFromLatLng(latitude: number, longitude: number): Promise<PlaceDetails | null> {
    const data = await reverseGeocode(latitude, longitude);
    if (!data || !data.place_id) return null;
    
    return {
        placeId: data.place_id,
        suggestedCompanyName: data.display_name.split(',')[0],
        address: data.display_name,
        city: data.address?.city || data.address?.town || data.address?.village || '',
        state: data.address?.state || '',
        phone: '', 
        latitude,
        longitude,
    };
}

export async function findPlacesFromText(query: string, bounds?: SearchBounds): Promise<PlaceDetails[]> {
    const results = await searchGeocode(query, bounds);
    
    return results.map(place => ({
        placeId: place.place_id,
        suggestedCompanyName: place.display_name.split(',')[0],
        address: place.display_name,
        city: place.address?.city || place.address?.town || place.address?.village || '',
        state: place.address?.state || '',
        phone: '',
        latitude: parseFloat(place.lat),
        longitude: parseFloat(place.lon),
    }));
}
