
'use client';
// This entire component is effectively disabled because the page now uses MapPlaceholder.
// The code is left here for potential re-enabling in the future.

import type { Visit } from '@/lib/types';
import { MapPin } from 'lucide-react';

const GoogleMapComponent: React.FC = () => {
    return (
        <div className="flex flex-col items-center justify-center h-96 bg-secondary/10 border border-amber-500 rounded-lg p-4 text-amber-700 dark:text-amber-400 text-center">
            <MapPin className="w-12 h-12 mb-4" />
            <p className="text-lg font-semibold">Google Maps is Currently Disabled</p>
            <p className="text-sm mt-2">The Google Maps API key is not configured, so this feature is unavailable.</p>
        </div>
    );
};

export default GoogleMapComponent;
