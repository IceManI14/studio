

'use client';

import { useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { findCompanyAction } from '@/app/actions';
import { Loader2, Map, MapPin, Phone, Clock, PlusSquare, Mic } from 'lucide-react';
import type { Visit, Territory, FoundPlace } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface FindCompanyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAddAsVisit: (visitData: Partial<Visit>) => void;
    onAddHotLeads: (places: FoundPlace[]) => void;
    destinationCities: string[];
    territory?: Territory[];
}

export default function FindCompanyModal({ isOpen, onClose, onAddAsVisit, onAddHotLeads, destinationCities, territory }: FindCompanyModalProps) {
    const [companyName, setCompanyName] = useState('');
    const [city, setCity] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [foundPlaces, setFoundPlaces] = useState<FoundPlace[]>([]);
    const { toast } = useToast();
    const [recordingField, setRecordingField] = useState<'company' | 'city' | null>(null);
    const recognitionRef = useRef<SpeechRecognition | null>(null);

    const handleToggleVoice = useCallback((field: 'company' | 'city') => {
        const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            toast({ variant: 'destructive', title: 'Voice Recognition Not Supported' });
            return;
        }

        if (recordingField && recognitionRef.current) {
            recognitionRef.current.stop();
            return;
        }

        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;

        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            setRecordingField(field);
            toast({ title: `Listening for ${field}...` });
        };

        recognition.onend = () => {
            setRecordingField(null);
            recognitionRef.current = null;
        };
        
        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            toast({ variant: 'destructive', title: 'Voice Error', description: event.error });
            setRecordingField(null);
            recognitionRef.current = null;
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            if (transcript) {
                if (field === 'company') {
                    setCompanyName(transcript);
                } else if (field === 'city') {
                    setCity(transcript);
                }
                toast({ title: `${field.charAt(0).toUpperCase() + field.slice(1)} Updated` });
            }
        };

        try {
            recognition.start();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Could not start recording', description: e.message });
        }

    }, [recordingField, toast]);

    const handleSearch = async () => {
        if (!companyName.trim()) {
            toast({ variant: 'destructive', title: "Company name required" });
            return;
        }
        setIsSearching(true);
        setFoundPlaces([]);
        try {
            const result = await findCompanyAction({ 
                companyName, 
                city: city.trim() ? city.trim() : undefined,
                territoryCities: destinationCities,
                territory: territory
            });
            if (result.error) {
                toast({ variant: 'destructive', title: "Search Failed", description: result.error });
            } else if (result.places && result.places.length > 0) {
                setFoundPlaces(result.places);
                onAddHotLeads(result.places);
                toast({ title: `${result.places.length} lead(s) found`, description: "They have been added to the Bonnie List." });
            } else {
                 toast({ title: "No Results Found", description: "No companies found with that name in the specified area." });
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Error", description: error.message });
        } finally {
            setIsSearching(false);
        }
    };

    const handleAddVisit = (place: FoundPlace) => {
        if (place) {
            const visitData: Partial<Visit> = {
                companyName: place.companyName,
                city: place.city,
                latitude: place.latitude,
                longitude: place.longitude,
                notes: `Address: ${place.address}`,
                decisionMakerContact: place.phone
            };
            onAddAsVisit(visitData);
            handleClose();
        }
    };
    
    const handleClose = () => {
        setCompanyName('');
        setCity('');
        setFoundPlaces([]);
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
        onClose();
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Find a Company for Bonnie's List</DialogTitle>
                    <DialogDescription>
                        Search for all branches of a company within your territory. You can optionally narrow the search to a specific city. Found leads are added to the Bonnie List.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="company-name-search">Company Name</Label>
                        <div className="relative flex items-center">
                            <Input
                                id="company-name-search"
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                                placeholder="e.g., Optimum Water Solutions"
                                className="pr-10"
                                disabled={!!recordingField}
                            />
                             <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleToggleVoice('company')}
                                className="absolute right-1 h-8 w-8"
                                aria-label="Dictate company name"
                            >
                                {recordingField === 'company' ? (
                                    <Mic className="h-4 w-4 text-red-500 animate-pulse" />
                                ) : (
                                    <Mic className="h-4 w-4 text-foreground" />
                                )}
                            </Button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="city-search">City (Optional)</Label>
                         <div className="relative flex items-center">
                            <Input
                                id="city-search"
                                value={city}
                                onChange={(e) => setCity(e.target.value)}
                                placeholder="Leave blank to search entire territory"
                                className="pr-10"
                                disabled={!!recordingField}
                            />
                             <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleToggleVoice('city')}
                                className="absolute right-1 h-8 w-8"
                                aria-label="Dictate city"
                            >
                                {recordingField === 'city' ? (
                                    <Mic className="h-4 w-4 text-red-500 animate-pulse" />
                                ) : (
                                    <Mic className="h-4 w-4 text-foreground" />
                                )}
                            </Button>
                        </div>
                    </div>
                    <Button onClick={handleSearch} disabled={isSearching || !!recordingField} className="w-full">
                        {isSearching ? <Loader2 className="animate-spin" /> : 'Search & Add to Bonnie List'}
                    </Button>
                </div>
                {foundPlaces.length > 0 && (
                     <ScrollArea className="mt-4 max-h-60">
                        <div className="space-y-2 pr-4">
                            {foundPlaces.map((place, index) => (
                                <Card key={index} className="w-full">
                                    <CardHeader className="pb-2 pt-3">
                                        <CardTitle className="text-base">{place.companyName}</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-1 text-xs pb-3">
                                        <p className="flex items-start"><MapPin className="mr-2 h-3 w-3 mt-0.5 shrink-0" /> {place.address}</p>
                                        {place.phone && <p className="flex items-center"><Phone className="mr-2 h-3 w-3 shrink-0" /> {place.phone}</p>}
                                        {place.openingHours && (
                                            <div className="flex items-start mt-1">
                                                <Clock className="mr-2 h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
                                                <div className="text-xs text-muted-foreground">
                                                    {place.openingHours.map((h, i) => <div key={i}>{h}</div>)}
                                                </div>
                                            </div>
                                        )}
                                        <div className="flex items-center justify-between pt-2">
                                            <Button size="sm" className="h-7 text-xs" onClick={() => handleAddVisit(place)}>
                                                <PlusSquare className="mr-1 h-3 w-3" />
                                                Add Future Visit
                                            </Button>
                                            {place.latitude && place.longitude ? (
                                                <Button variant="link" asChild className="p-0 h-auto text-xs">
                                                    <a href={`https://www.google.com/maps?q=${place.latitude},${place.longitude}`} target="_blank" rel="noopener noreferrer">
                                                        <Map className="mr-1 h-3 w-3" /> View on Map
                                                    </a>
                                                </Button>
                                            ) : <div />}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </ScrollArea>
                )}
                <DialogFooter>
                    <Button variant="outline" onClick={handleClose}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

