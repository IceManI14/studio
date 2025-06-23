
'use client';

import type { Visit } from '@/lib/types';
import { GoogleMap, InfoWindowF, MarkerF, useJsApiLoader } from '@react-google-maps/api';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, MapPin, AlertTriangle } from 'lucide-react';

interface GoogleMapComponentProps {
  visits: Visit[];
}

interface GoogleMapLoaderProps {
  visits: Visit[];
  apiKey: string;
}

const mapContainerStyle = {
  width: '100%',
  height: '400px',
  borderRadius: '0.5rem',
  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
};

const defaultCenter = {
  lat: 39.8283,
  lng: -98.5795,
};

const GoogleMapLoader: React.FC<GoogleMapLoaderProps> = ({ visits, apiKey }) => {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    libraries: ['marker'],
  });

  const [activeMarker, setActiveMarker] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [zoomLevel, setZoomLevel] = useState(4);

  const validVisits = useMemo(() =>
    visits.filter(visit => typeof visit.latitude === 'number' && typeof visit.longitude === 'number'),
    [visits]
  );

  useEffect(() => {
    if (validVisits.length > 0) {
      const latestVisit = validVisits.reduce((latest, current) => {
        return new Date(current.timestamp) > new Date(latest.timestamp) ? current : latest;
      });

      if (latestVisit.latitude !== undefined && latestVisit.longitude !== undefined) {
        setMapCenter({ lat: latestVisit.latitude, lng: latestVisit.longitude });
        setZoomLevel(20);
      } else {
        const firstValidVisitWithCoords = validVisits.find(v => v.latitude !== undefined && v.longitude !== undefined);
        if (firstValidVisitWithCoords) {
          setMapCenter({ lat: firstValidVisitWithCoords.latitude!, lng: firstValidVisitWithCoords.longitude! });
          setZoomLevel(20);
        } else {
          setMapCenter(defaultCenter);
          setZoomLevel(4);
        }
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
    const isApiTargetBlockedError = loadError.message &&
      (loadError.message.includes('ApiTargetBlockedMapError') ||
        loadError.message.includes('API target is not authorized'));

    return (
      <div className="flex flex-col items-center justify-center h-96 bg-destructive/10 border border-destructive rounded-lg p-4 text-destructive text-center">
        <AlertTriangle className="w-12 h-12 mb-4" />
        <p className="text-lg font-semibold">Error loading Google Maps.</p>

        {isApiTargetBlockedError ? (
          <>
            <p className="text-sm mt-2 font-medium">
              This is likely an API key configuration issue (`ApiTargetBlockedMapError` or similar).
            </p>
            <p className="text-xs mt-2">Please check the following in your Google Cloud Console for the API key used in `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`:</p>
            <ul className="text-xs list-disc list-inside text-left mt-2 space-y-1">
              <li><strong>API Restrictions:</strong> Ensure "Maps JavaScript API" is enabled for this key.</li>
              <li><strong>Application Restrictions (HTTP referrers):</strong> If enabled, make sure your current website URL (e.g., `localhost:3000`, your Cloud Workstations URL, or your production domain) is added to the list of allowed referrers. Common patterns for development: `localhost:*` or `YOUR_DOMAIN.cloudworkstations.dev/*`.</li>
              <li>Ensure "Maps JavaScript API" is enabled in your Google Cloud project under "APIs & Services" &gt; "Library".</li>
              <li>Verify billing is enabled for the Google Cloud project.</li>
            </ul>
          </>
        ) : (
          <>
            <p className="text-sm mt-2">
              This can happen for several reasons:
            </p>
            <ul className="text-xs list-disc list-inside text-left mt-2 space-y-1">
              <li>The Google Maps API key might be incorrect or not yet propagated.</li>
              <li>The "Maps JavaScript API" might not be enabled in your Google Cloud Console for your project.</li>
              <li>Billing might not be enabled for the Google Cloud project associated with the API key.</li>
              <li>API key restrictions (HTTP referrers or API service restrictions) might be misconfigured.</li>
            </ul>
          </>
        )}
        <p className="text-sm mt-3">
          For more specific details, open your browser's developer console (F12) and check for error messages.
        </p>
        {loadError.message && <p className="text-xs mt-2 italic">Reported library error: {loadError.message}</p>}
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
                pixelOffset: typeof window !== 'undefined' && window.google ? new window.google.maps.Size(0, -30) : undefined
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


const GoogleMapComponent: React.FC<GoogleMapComponentProps> = ({ visits }) => {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey || apiKey.trim() === '' || apiKey === 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
    const reason = !apiKey || apiKey.trim() === '' ? 'missing' : 'a placeholder';
    return (
        <div className="flex flex-col items-center justify-center h-96 bg-secondary/10 border border-amber-500 rounded-lg p-4 text-amber-700 dark:text-amber-400 text-center">
            <MapPin className="w-12 h-12 mb-4" />
            <p className="text-lg font-semibold">Google Maps API Key is {reason}.</p>
            {reason === 'missing' ? (
              <p className="text-sm mt-2">Please add your `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` to your .env file.</p>
            ) : (
              <p className="text-sm mt-2">Please replace the placeholder value for `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in your .env file with a valid key.</p>
            )}
            <p className="text-xs mt-2">After updating the .env file, you may need to restart your development server and do a hard refresh of this page.</p>
            <p className="text-xs mt-2">Also ensure the key is enabled for the "Maps JavaScript API" in your Google Cloud Console and that billing is active for the project.</p>
        </div>
    );
  }

  return <GoogleMapLoader visits={visits} apiKey={apiKey} />;
};


export default GoogleMapComponent;
