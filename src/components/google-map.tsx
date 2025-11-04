
'use client';

import type { Visit } from '@/lib/types';
import { MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';

interface GoogleMapComponentProps {
  visits: Visit[];
}

const GoogleMapComponent: React.FC<GoogleMapComponentProps> = ({ visits }) => {
  const [clientVisits, setClientVisits] = useState<Visit[]>([]);

  useEffect(() => {
    setClientVisits(visits);
  }, [visits]);

  // Basic placeholder for map bounds, can be improved
  const minLat = 25, maxLat = 49; // USA approx
  const minLng = -125, maxLng = -66; // USA approx

  const normalizeCoords = (lat?: number, lng?: number, mapWidth = 500, mapHeight = 300) => {
    if (lat === undefined || lng === undefined) return { x: 0, y: 0, valid: false };
    
    const x = ((lng - minLng) / (maxLng - minLng)) * mapWidth;
    const y = ((maxLat - lat) / (maxLat - minLat)) * mapHeight; // Y is inverted
    
    return { x, y, valid: true };
  };

  return (
    <div 
      className="relative w-full h-64 md:h-96 bg-secondary/50 rounded-lg shadow-md flex items-center justify-center overflow-hidden border"
      aria-label="Map of visited locations"
      data-ai-hint="map location"
    >
      <p className="text-muted-foreground font-medium text-lg z-10 bg-background/80 px-4 py-2 rounded">
        Map of Visited Locations
      </p>
      {clientVisits.map(visit => {
         const {x, y, valid} = normalizeCoords(visit.latitude, visit.longitude);
         if (!valid) return null;

         return (
            <MapPin 
              key={visit.id} 
              className="absolute text-primary h-6 w-6 transform -translate-x-1/2 -translate-y-full"
              style={{ left: `${x}px`, top: `${y}px`, filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.3))' }}
              aria-label={`Location of ${visit.companyName}`}
            />
         );
      })}
      <div 
        className="absolute pulse-dot bg-primary rounded-full w-3 h-3"
        style={{ left: '50%', top: '50%' }} 
        aria-hidden="true"
      />
    </div>
  );
};

export default GoogleMapComponent;
