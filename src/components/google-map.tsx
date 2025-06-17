
'use client';

import type { Visit } from '@/lib/types';
import { GoogleMap, InfoWindowF, MarkerF, useJsApiLoader } from '@react-google-maps/api';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';

interface GoogleMapComponentProps {
  visits: Visit[];
}

const mapContainerStyle = {
  width: '100%',
  height: '400px', // You can adjust this
  borderRadius: '0.5rem', // Matches ShadCN's rounded-lg
  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)', // Matches shadow-md
};

// A default center (e.g., center of the US)
const defaultCenter = {
  lat: 39.8283,
  lng: -98.5795,
};

const GoogleMapComponent: React.FC<GoogleMapComponentProps> = ({ visits }) => {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey || '',
    libraries: ['marker'], // Only 'marker' library needed for InfoWindowF with MarkerF
  });

  const [activeMarker, setActiveMarker] = useState<string | null>(null); // Store ID of active visit
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [zoomLevel, setZoomLevel] = useState(4); // Default zoom for a broad view

  const validVisits = useMemo(() => 
    visits.filter(visit => typeof visit.latitude === 'number' && typeof visit.longitude === 'number')
  , [visits]);

  useEffect(() => {
    if (validVisits.length > 0) {
      const latitudes = validVisits.map(v => v.latitude!);
      const longitudes = validVisits.map(v => v.longitude!);

      const avgLat = latitudes.reduce((sum, lat) => sum + lat, 0) / latitudes.length;
      const avgLng = longitudes.reduce((sum, lng) => sum + lng, 0) / longitudes.length;
      setMapCenter({ lat: avgLat, lng: avgLng });

      if (validVisits.length === 1) {
        setZoomLevel(12); // Zoom in more for a single point
      } else {
        // Basic logic to adjust zoom; could be more sophisticated with bounds calculation
        const latDiff = Math.max(...latitudes) - Math.min(...latitudes);
        const lngDiff = Math.max(...longitudes) - Math.min(...longitudes);
        const maxDiff = Math.max(latDiff, lngDiff);

        if (maxDiff < 0.1) setZoomLevel(12);
        else if (maxDiff < 0.5) setZoomLevel(10);
        else if (maxDiff < 2) setZoomLevel(8);
        else if (maxDiff < 5) setZoomLevel(6);
        else setZoomLevel(4);
      }
    } else {
      setMapCenter(defaultCenter);
      setZoomLevel(4);
    }
  }, [validVisits]);

  const handleMarkerClick = useCallback((visitId: string) => {
    setActiveMarker(visitId);
  }, []);

  const handleInfoWindowClose = useCallback(() => {
    setActiveMarker(null);
  }, []);

  if (loadError) {
    return (
        <div className="flex flex-col items-center justify-center h-96 bg-destructive/10 border border-destructive rounded-lg p-4 text-destructive text-center">
            <MapPin className="w-12 h-12 mb-4" />
            <p className="text-lg font-semibold">Error loading Google Maps.</p>
            <p className="text-sm mt-2">
              Please ensure your API key (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`) is correct in the `.env` file, 
              the "Maps JavaScript API" is enabled in your Google Cloud Console,
              and your API key restrictions (e.g., HTTP referrers, API restrictions) are correctly configured for your domain.
            </p>
            <p className="text-xs mt-3">
              For more details, open your browser's developer console (usually by pressing F12) and look for error messages from Google Maps.
            </p>
            {loadError.message && <p className="text-xs mt-2 italic">Reported error: {loadError.message}</p>}
        </div>
    );
  }

  if (!isLoaded) {
    return (
        <div className="flex items-center justify-center h-96 bg-secondary/50 rounded-lg shadow-md border">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <p className="ml-4 text-lg text-muted-foreground">Loading Map...</p>
        </div>
    );
  }
  
  if (!apiKey) {
    return (
        <div className="flex flex-col items-center justify-center h-96 bg-secondary/10 border border-amber-500 rounded-lg p-4 text-amber-700 dark:text-amber-400 text-center">
            <MapPin className="w-12 h-12 mb-4" />
            <p className="text-lg font-semibold">Google Maps API Key is missing.</p>
            <p className="text-sm mt-2">Please add your `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` to your .env file and restart the server.</p>
        </div>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={mapContainerStyle}
      center={mapCenter}
      zoom={zoomLevel}
      options={{
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
      }}
    >
      {validVisits.map((visit) => (
        <MarkerF
          key={visit.id}
          position={{ lat: visit.latitude!, lng: visit.longitude! }}
          onClick={() => handleMarkerClick(visit.id)}
          title={visit.companyName}
        >
          {activeMarker === visit.id && (
            <InfoWindowF
              position={{ lat: visit.latitude!, lng: visit.longitude! }}
              onCloseClick={handleInfoWindowClose}
              options={{
                pixelOffset: typeof window !== 'undefined' && window.google ? new window.google.maps.Size(0, -30) : undefined // Adjust as needed
              }}
            >
              <div className="p-1">
                <h4 className="font-semibold text-sm text-primary">{visit.companyName}</h4>
                <p className="text-xs text-muted-foreground">
                  Confidence: {visit.partnershipConfidence ? `${visit.partnershipConfidence}/5` : 'N/A'}
                </p>
              </div>
            </InfoWindowF>
          )}
        </MarkerF>
      ))}
    </GoogleMap>
  );
};

export default GoogleMapComponent;
