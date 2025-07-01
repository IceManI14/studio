
'use client';

import type { Visit } from '@/lib/types';
import { GoogleMap, InfoWindowF, MarkerF, useJsApiLoader } from '@react-google-maps/api';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, MapPin, AlertTriangle, Clock, Phone, UserSearch, Navigation } from 'lucide-react';
import { Button } from './ui/button';
import { getCompanyIntelAction } from '@/app/actions';
import type { GetCompanyIntelOutput } from '@/ai/flows/get-company-intel-flow';


interface GoogleMapComponentProps {
  visits: Visit[];
  userLatitude?: number;
  userLongitude?: number;
}

interface GoogleMapLoaderProps {
  visits: Visit[];
  apiKey: string;
  userLatitude?: number;
  userLongitude?: number;
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

const GoogleMapLoader: React.FC<GoogleMapLoaderProps> = ({ visits, apiKey, userLatitude, userLongitude }) => {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    libraries: ['marker'],
  });

  const [activeMarker, setActiveMarker] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [zoomLevel, setZoomLevel] = useState(4);
  const [intel, setIntel] = useState<Record<string, GetCompanyIntelOutput | 'loading' | 'error'>>({});

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
        setZoomLevel(16);
      }
    } else if (userLatitude && userLongitude) {
        setMapCenter({ lat: userLatitude, lng: userLongitude });
        setZoomLevel(16);
    } else {
      setMapCenter(defaultCenter);
      setZoomLevel(4);
    }
  }, [validVisits, userLatitude, userLongitude]);

  const handleMarkerClick = useCallback((visitId: string) => {
    setActiveMarker(visitId);
  }, []);

  const handleInfoWindowClose = useCallback(() => {
    setActiveMarker(null);
  }, []);

  const handleGetIntel = useCallback(async (visit: Visit) => {
    if (!visit.latitude || !visit.longitude) return;
    setIntel(prev => ({ ...prev, [visit.id]: 'loading' }));
    
    const result = await getCompanyIntelAction({
      companyName: visit.companyName,
      latitude: visit.latitude,
      longitude: visit.longitude,
    });

    if (result.error || !result.details) {
      console.error("Failed to get company intel:", result.error);
      setIntel(prev => ({ ...prev, [visit.id]: 'error' }));
    } else {
      setIntel(prev => ({ ...prev, [visit.id]: result.details! }));
    }
  }, []);

  if (loadError) {
    const isApiTargetBlockedError = loadError.message?.includes('ApiTargetBlockedMapError') || loadError.message?.includes('API target is not authorized');
    const isExpiredKeyError = loadError.message?.includes('ExpiredKeyMapError');

    return (
      <div className="flex flex-col items-center justify-center h-96 bg-destructive/10 border border-destructive rounded-lg p-4 text-destructive text-center">
        <AlertTriangle className="w-12 h-12 mb-4" />
        <p className="text-lg font-semibold">Error loading Google Maps.</p>

        {isExpiredKeyError ? (
          <>
            <p className="text-sm mt-2 font-medium">
              Your Google Maps API Key has expired.
            </p>
            <p className="text-sm mt-2">To fix this, you must generate a new key from your Google Cloud Console.</p>
            <div className="text-left mt-4 bg-background/50 p-4 rounded-lg border border-destructive/50">
              <h3 className="font-semibold text-base mb-2">Action Required:</h3>
              <ol className="text-sm list-decimal list-inside space-y-2">
                <li>Go to the <a href="https://console.cloud.google.com/google/maps-apis/credentials" target="_blank" rel="noopener noreferrer" className="underline font-semibold">Google Cloud Console Credentials page</a>.</li>
                <li>Create a new API key (or regenerate the existing one).</li>
                <li>Copy the new key.</li>
                <li>Paste it into your <strong>.env</strong> file for the `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` variable.</li>
                <li>Restart your application server.</li>
              </ol>
            </div>
          </>
        ) : isApiTargetBlockedError ? (
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
      {isLoaded && userLatitude && userLongitude && (
          <MarkerF
            position={{ lat: userLatitude, lng: userLongitude }}
            title="Your Location"
            icon={{
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: "#4285F4",
              fillOpacity: 1,
              strokeColor: "white",
              strokeWeight: 2,
            }}
          />
      )}
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
              <div className="p-1 max-w-xs">
                <h4 className="font-semibold text-sm text-primary">{visit.companyName}</h4>
                <p className="text-xs text-muted-foreground">
                  Confidence: {visit.partnershipConfidence ? `${visit.partnershipConfidence}/5` : 'N/A'}
                </p>

                {intel[visit.id] === 'loading' && (
                    <div className="mt-2 flex items-center justify-center">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        <p className="ml-2 text-xs text-muted-foreground">Getting intel...</p>
                    </div>
                )}
                
                {intel[visit.id] && intel[visit.id] !== 'loading' && intel[visit.id] !== 'error' && (() => {
                    const companyIntel = intel[visit.id] as GetCompanyIntelOutput;
                    return (
                        <div className="mt-2 text-xs space-y-1 border-t pt-2">
                            {companyIntel.phone && (
                                <div className="flex items-center">
                                    <Phone className="w-3 h-3 mr-2 text-muted-foreground flex-shrink-0" />
                                    <span>{companyIntel.phone}</span>
                                </div>
                            )}
                            {companyIntel.hours && companyIntel.hours.length > 0 && (
                                <div className="flex items-start">
                                    <Clock className="w-3 h-3 mr-2 mt-0.5 text-muted-foreground flex-shrink-0" />
                                    <div>
                                        {companyIntel.hours.map(h => <div key={h}>{h}</div>)}
                                    </div>
                                </div>
                            )}
                            {companyIntel.decisionMaker && (
                                 <div className="flex items-start">
                                    <UserSearch className="w-3 h-3 mr-2 mt-0.5 text-muted-foreground flex-shrink-0" />
                                    <span>{companyIntel.decisionMaker}</span>
                                </div>
                            )}
                             {(!companyIntel.phone && !companyIntel.hours && !companyIntel.decisionMaker) && (
                                <p className="text-muted-foreground">No additional details found.</p>
                             )}
                        </div>
                    );
                })()}

                {intel[visit.id] === 'error' && (
                    <p className="text-xs text-destructive mt-2">Could not retrieve details.</p>
                )}

                <div className="mt-2 flex items-center justify-between border-t pt-2">
                    <Button
                        size="sm"
                        variant="link"
                        className="p-0 h-auto text-xs"
                        onClick={() => handleGetIntel(visit)}
                        disabled={intel[visit.id] === 'loading'}
                    >
                        {intel[visit.id] && intel[visit.id] !== 'loading' ? 'Refresh Intel' : 'Get More Info'}
                    </Button>
                    <Button
                        asChild
                        size="sm"
                        variant="link"
                        className="p-0 h-auto text-xs"
                    >
                        <a href={`https://www.google.com/maps/dir/?api=1&destination=${visit.latitude},${visit.longitude}`} target="_blank" rel="noopener noreferrer">
                            <Navigation className="w-3 h-3 mr-1" />
                            Directions
                        </a>
                    </Button>
                </div>
              </div>
            </InfoWindowF>
          )}
        </MarkerF>
      ))}
    </GoogleMap>
  );
};


const GoogleMapComponent: React.FC<GoogleMapComponentProps> = ({ visits, userLatitude, userLongitude }) => {
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

  return <GoogleMapLoader visits={visits} apiKey={apiKey} userLatitude={userLatitude} userLongitude={userLongitude} />;
};


export default GoogleMapComponent;
