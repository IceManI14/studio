
'use client';

import type { Visit } from '@/lib/types';
import { LoadScript, GoogleMap, Marker } from '@react-google-maps/api';
import { useMemo, useState } from 'react';

interface GoogleMapComponentProps {
  visits: Visit[];
}

const mapContainerStyle = {
  width: '100%',
  height: '100%',
  borderRadius: '0.5rem',
};

// A default center, will be overridden by fitBounds
const defaultCenter = {
  lat: 42.4,
  lng: -71.7,
};

const libraries: ('places' | 'drawing' | 'geometry' | 'localContext' | 'visualization')[] = ['places'];

// URLs for different colored markers
const MARKER_ICONS = {
  red: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
  green: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png',
  blue: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
  yellow: 'https://maps.google.com/mapfiles/ms/icons/yellow-dot.png',
  purple: 'https://maps.google.com/mapfiles/ms/icons/purple-dot.png',
};

const GoogleMapComponent: React.FC<GoogleMapComponentProps> = ({ visits }) => {
  const isGoogleMapsConfigured = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY !== 'YOUR_GOOGLE_MAPS_API_KEY_HERE';
  const [mapError, setMapError] = useState<string | null>(null);

  const { validVisits, firstVisitMap } = useMemo(() => {
    const filteredVisits = visits.filter(v => typeof v.latitude === 'number' && typeof v.longitude === 'number');
    
    const companyFirstVisit = new Map<string, Date>();
    filteredVisits.forEach(v => {
      if (v.companyName) {
        const existingDate = companyFirstVisit.get(v.companyName);
        if (!existingDate || new Date(v.timestamp) < existingDate) {
          companyFirstVisit.set(v.companyName, new Date(v.timestamp));
        }
      }
    });

    const visitIsFirst = new Map<string, boolean>();
    filteredVisits.forEach(v => {
        if (v.companyName) {
            const firstVisitDate = companyFirstVisit.get(v.companyName);
            if (firstVisitDate && new Date(v.timestamp).getTime() === firstVisitDate.getTime()) {
                visitIsFirst.set(v.id, true);
            } else {
                 visitIsFirst.set(v.id, false);
            }
        }
    });

    return { validVisits: filteredVisits, firstVisitMap: visitIsFirst };
  }, [visits]);

  const getMarkerIcon = (visit: Visit) => {
    if (visit.dealClosed) return MARKER_ICONS.green;
    if (visit.competitorName === 'Culligan-Quench') return MARKER_ICONS.red;
    if (visit.futureMeetingSet && visit.futureMeetingDateTime && new Date(visit.futureMeetingDateTime) > new Date()) return MARKER_ICONS.yellow;
    if (firstVisitMap.get(visit.id) === false) return MARKER_ICONS.blue; // It's a revisit
    return MARKER_ICONS.purple; // Default
  };

  const onMapLoad = (map: google.maps.Map) => {
    if (validVisits.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      validVisits.forEach(visit => {
        bounds.extend(new window.google.maps.LatLng(visit.latitude!, visit.longitude!));
      });
      map.fitBounds(bounds);

      // Add a bit of padding if there's only one marker
      if (validVisits.length === 1) {
          map.setZoom(14);
      }
    }
  };
  
  if (!isGoogleMapsConfigured) {
    return (
        <div 
          className="relative w-full h-64 md:h-96 bg-secondary/50 rounded-lg shadow-md flex flex-col items-center justify-center overflow-hidden border text-center p-4"
          aria-label="Map of visited locations is disabled"
        >
          <h3 className="text-lg font-semibold text-destructive">Google Maps Not Configured</h3>
          <p className="text-muted-foreground text-sm">
            Please add your `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` to the .env file to enable the map view.
          </p>
        </div>
    );
  }
  
  if (mapError) {
     return (
        <div 
          className="relative w-full h-64 md:h-96 bg-destructive/10 rounded-lg shadow-md flex flex-col items-center justify-center overflow-hidden border border-destructive/50 text-center p-4"
          aria-label="Map of visited locations error"
        >
          <h3 className="text-lg font-semibold text-destructive">{mapError}</h3>
          <p className="text-destructive/80 text-sm mt-2">
            The map cannot be loaded. Please ensure that the Google Maps JavaScript API is enabled and that billing is active for your Google Cloud project. You can fix this in the Google Cloud Console.
          </p>
        </div>
    );
  }

  return (
    <div 
      className="relative w-full h-64 md:h-96 rounded-lg shadow-md overflow-hidden border"
    >
      <LoadScript
        googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}
        libraries={libraries}
        loadingElement={<div className="h-full w-full flex items-center justify-center bg-muted"><p>Loading Map...</p></div>}
        onError={(error) => setMapError(error.message)}
        onLoad={() => {
            if (window.google && window.google.maps && window.google.maps.event) {
                // This listener checks for auth errors after the script loads
                window.google.maps.event.addDomListener(window, 'gm_authFailure', () => {
                    setMapError('Google Maps Authentication Failed.');
                });
            }
        }}
      >
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={defaultCenter}
          zoom={7}
          onLoad={onMapLoad}
          options={{
            disableDefaultUI: true,
            zoomControl: true,
            streetViewControl: false,
            mapTypeControl: false,
            styles: [ // Dark mode styles
              { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
              { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
              { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
              {
                featureType: "administrative.locality",
                elementType: "labels.text.fill",
                stylers: [{ color: "#d59563" }],
              },
              {
                featureType: "poi",
                elementType: "labels.text.fill",
                stylers: [{ color: "#d59563" }],
              },
              {
                featureType: "poi.park",
                elementType: "geometry",
                stylers: [{ color: "#263c3f" }],
              },
              {
                featureType: "poi.park",
                elementType: "labels.text.fill",
                stylers: [{ color: "#6b9a76" }],
              },
              {
                featureType: "road",
                elementType: "geometry",
                stylers: [{ color: "#38414e" }],
              },
              {
                featureType: "road",
                elementType: "geometry.stroke",
                stylers: [{ color: "#212a37" }],
              },
              {
                featureType: "road",
                elementType: "labels.text.fill",
                stylers: [{ color: "#9ca5b3" }],
              },
              {
                featureType: "road.highway",
                elementType: "geometry",
                stylers: [{ color: "#746855" }],
              },
              {
                featureType: "road.highway",
                elementType: "geometry.stroke",
                stylers: [{ color: "#1f2835" }],
              },
              {
                featureType: "road.highway",
                elementType: "labels.text.fill",
                stylers: [{ color: "#f3d19c" }],
              },
              {
                featureType: "transit",
                elementType: "geometry",
                stylers: [{ color: "#2f3948" }],
              },
              {
                featureType: "transit.station",
                elementType: "labels.text.fill",
                stylers: [{ color: "#d59563" }],
              },
              {
                featureType: "water",
                elementType: "geometry",
                stylers: [{ color: "#17263c" }],
              },
              {
                featureType: "water",
                elementType: "labels.text.fill",
                stylers: [{ color: "#515c6d" }],
              },
              {
                featureType: "water",
                elementType: "labels.text.stroke",
                stylers: [{ color: "#17263c" }],
              },
            ]
          }}
        >
          {validVisits.map(visit => (
            <Marker
              key={visit.id}
              position={{ lat: visit.latitude!, lng: visit.longitude! }}
              title={visit.companyName}
              icon={getMarkerIcon(visit)}
            />
          ))}
        </GoogleMap>
      </LoadScript>
    </div>
  );
};

export default GoogleMapComponent;
