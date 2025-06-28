
'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { findCompanyAction } from '@/app/actions';
import { Loader2, Map, MapPin, Phone } from 'lucide-react';
import type { Visit } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface FoundPlace {
    companyName: string;
    address: string;
    city: string;
    phone: string;
    latitude?: number;
    longitude?: number;
}

interface FindCompanyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAddAsVisit: (visitData: Partial<Visit>) => void;
    destinationCities: string[];
}

export default function FindCompanyModal({ isOpen, onClose, onAddAsVisit, destinationCities }: FindCompanyModalProps) {
    const [companyName, setCompanyName] = useState('');
    const [city, setCity] = useState(destinationCities[0] || '');
    const [isSearching, setIsSearching] = useState(false);
    const [foundPlace, setFoundPlace] = useState<FoundPlace | null>(null);
    const { toast } = useToast();

    const handleSearch = async () => {
        if (!companyName.trim()) {
            toast({ title: "Company name required", variant: "destructive" });
            return;
        }
        setIsSearching(true);
        setFoundPlace(null);
        try {
            const result = await findCompanyAction({ companyName, city });
            if (result.error) {
                toast({ title: "Search Failed", description: result.error, variant: "destructive" });
            } else if (result.place) {
                setFoundPlace(result.place);
            }
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsSearching(false);
        }
    };

    const handleAddVisit = () => {
        if (foundPlace) {
            const visitData: Partial<Visit> = {
                companyName: foundPlace.companyName,
                latitude: foundPlace.latitude,
                longitude: foundPlace.longitude,
                notes: `Address: ${foundPlace.address}`,
                decisionMakerContact: foundPlace.phone
            };
            onAddAsVisit(visitData);
            handleClose();
        }
    };
    
    const handleClose = () => {
        setCompanyName('');
        setFoundPlace(null);
        onClose();
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Find a Company</DialogTitle>
                    <DialogDescription>
                        Search for a company to get its address and add it as a potential visit.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="company-name-search">Company Name</Label>
                        <Input
                            id="company-name-search"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            placeholder="e.g., Optimum Water Solutions"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="city-search">City / Area</Label>
                        <Input
                            id="city-search"
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            placeholder="e.g., Boston, MA"
                        />
                    </div>
                    <Button onClick={handleSearch} disabled={isSearching} className="w-full">
                        {isSearching ? <Loader2 className="animate-spin" /> : 'Search'}
                    </Button>
                </div>
                {foundPlace && (
                    <Card className="mt-4">
                        <CardHeader>
                            <CardTitle>{foundPlace.companyName}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            <p className="flex items-center"><MapPin className="mr-2 h-4 w-4" /> {foundPlace.address}</p>
                            {foundPlace.phone && <p className="flex items-center"><Phone className="mr-2 h-4 w-4" /> {foundPlace.phone}</p>}
                            {foundPlace.latitude && foundPlace.longitude && (
                                <Button variant="link" asChild className="p-0 h-auto">
                                    <a href={`https://www.google.com/maps?q=${foundPlace.latitude},${foundPlace.longitude}`} target="_blank" rel="noopener noreferrer">
                                        <Map className="mr-2 h-4 w-4" /> View on Map
                                    </a>
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                )}
                <DialogFooter>
                    <Button variant="outline" onClick={handleClose}>Cancel</Button>
                    <Button onClick={handleAddVisit} disabled={!foundPlace}>Add as Visit</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
