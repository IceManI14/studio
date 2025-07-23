
'use server';
/**
 * @fileOverview A service for interacting with the Google Maps Places API.
 * This service is currently disabled.
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

const DISABLED_ERROR_MESSAGE = "Google Places API has been disabled by the administrator.";

export async function findPlaceFromLatLng(latitude: number, longitude: number): Promise<PlaceDetails | null> {
    console.warn(DISABLED_ERROR_MESSAGE);
    throw new Error(DISABLED_ERROR_MESSAGE);
}

export async function findPlacesFromText(query: string, bounds?: SearchBounds): Promise<PlaceDetails[]> {
    console.warn(DISABLED_ERROR_MESSAGE);
    throw new Error(DISABLED_ERROR_MESSAGE);
}
