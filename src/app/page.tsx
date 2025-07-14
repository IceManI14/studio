
'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Visit, Salesperson, HotLead, Territory, FoundPlace } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Calendar, User, MapPin, Plus, Folder, ListChecks, Info, Flame, DollarSign, PackageCheck, AlertTriangle, UserCheck, Settings, BrainCircuit, FileUp, Search, LogOut, ChevronRight, BarChart, HardDrive, Map as MapIcon, Mic } from 'lucide-react';
import { format, startOfToday, subDays } from 'date-fns';
import { db, firebaseConfigured } from '@/lib/firebase';
import { collection, query, where, getDocs, onSnapshot, Timestamp } from 'firebase/firestore';
import VisitCard from '@/components/visit-card';
import VisitForm from '@/components/visit-form';
import SalespersonSelectorModal from '@/components/salesperson-selector-modal';
import TerritoryUploadModal from '@/components/territory-upload-modal';
import GoogleMapComponent from '@/components/google-map';
import FindCompanyModal from '@/components/find-company-modal';
import ManageFilesModal from '@/components/manage-files-modal';
import { saveVisitAction, deleteVisitAction, updateDealClosedAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

// Dummy data for initial display before real data loads
const DUMMY_SALESPEOPLE: Salesperson[] = [
  { id: 'lyman-1', name: 'Lyman', territory: [] },
  { id: 'john-d', name: 'John D', territory: [] },
  { id: 'dev-test', name: 'Dev Tester', territory: [] },
];

export default function HomePage() {
  const [salesperson, setSalesperson] = useState<Salesperson | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [hotLeads, setHotLeads] = useState<HotLead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [currentLocation, setCurrentLocation] = useState("Determining location...");
  const [userLatitude, setUserLatitude] = useState<number | undefined>();
  const [userLongitude, setUserLongitude] = useState<number | undefined>();

  const [isVisitFormOpen, setIsVisitFormOpen] = useState(false);
  const [isFindCompanyModalOpen, setIsFindCompanyModalOpen] = useState(false);
  const [isManageFilesModalOpen, setIsManageFilesModalOpen] = useState(false);
  const [editingVisit, setEditingVisit] = useState<Visit | undefined>(undefined);
  const [isSalespersonSelectorOpen, setIsSalespersonSelectorOpen] = useState(true);
  const [isTerritoryUploadOpen, setIsTerritoryUploadOpen] = useState(false);

  const [zoomedVisit, setZoomedVisit] = useState<Visit | null>(null);
  const [startDictationOnOpen, setStartDictationOnOpen] = useState(false);
  const [isFutureVisit, setIsFutureVisit] = useState(false);

  const { toast } = useToast();
  const lastKnownVisitsRef = useRef<Visit[]>([]);

  // Location handling
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLatitude(position.coords.latitude);
          setUserLongitude(position.coords.longitude);
          // Reverse geocode to get a location name (simplified)
          fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${position.coords.latitude},${position.coords.longitude}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`)
            .then(res => res.json())
            .then(data => {
              if (data.results && data.results[0]) {
                const addressComponents = data.results[0].address_components;
                const city = addressComponents.find((c: any) => c.types.includes('locality'))?.long_name;
                const state = addressComponents.find((c: any) => c.types.includes('administrative_area_level_1'))?.short_name;
                if (city && state) {
                  setCurrentLocation(`${city}, ${state}`);
                }
              }
            }).catch(() => setCurrentLocation("Location unavailable"));
        },
        () => setCurrentLocation("Location access denied"),
        { enableHighAccuracy: true }
      );
    } else {
      setCurrentLocation("Geolocation not supported");
    }
  }, []);
  
  // Data fetching from Firebase
  useEffect(() => {
    if (!firebaseConfigured || !salesperson) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const visitsQuery = query(collection(db, 'visits'));
    
    const unsubscribe = onSnapshot(visitsQuery, (querySnapshot) => {
      const fetchedVisits: Visit[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        fetchedVisits.push({
          ...data,
          id: doc.id,
          timestamp: (data.timestamp as Timestamp).toDate(),
          futureMeetingDateTime: data.futureMeetingDateTime ? (data.futureMeetingDateTime as Timestamp).toDate() : undefined,
          freeTrialStartDate: data.freeTrialStartDate ? (data.freeTrialStartDate as Timestamp).toDate() : undefined,
          dealClosedDate: data.dealClosedDate ? (data.dealClosedDate as Timestamp).toDate() : undefined,
        } as Visit);
      });

      fetchedVisits.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      const newVisits = fetchedVisits.filter(fv => !lastKnownVisitsRef.current.some(lkv => lkv.id === fv.id));
      if (newVisits.length > 0 && lastKnownVisitsRef.current.length > 0) {
        const newVisit = newVisits[0]; // Assuming one new visit at a time for simplicity
        toast({
          title: `New Visit Logged: ${newVisit.companyName}`,
          description: `Logged at ${format(newVisit.timestamp, 'p')}`,
        });
      }
      
      setVisits(fetchedVisits);
      lastKnownVisitsRef.current = fetchedVisits;
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching visits: ", error);
      toast({ variant: "destructive", title: "Error", description: "Could not fetch visits from the database." });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [salesperson, toast]);


  const handleSelectSalesperson = (selected: Salesperson) => {
    setSalesperson(selected);
    setIsSalespersonSelectorOpen(false);
    localStorage.setItem('salesperson', JSON.stringify(selected));
    // Check if territory file is needed
    const territoryUploaded = localStorage.getItem('territoryPdfUploaded');
    if (!territoryUploaded) {
      setIsTerritoryUploadOpen(true);
    }
  };

  const handleEditVisit = useCallback((visitToEdit: Visit) => {
    setEditingVisit(visitToEdit);
    setIsFutureVisit(false);
    setStartDictationOnOpen(false);
    setIsVisitFormOpen(true);
  }, []);

  const handleAddVisit = useCallback(() => {
    setEditingVisit(undefined);
    setIsFutureVisit(false);
    setStartDictationOnOpen(false);
    setIsVisitFormOpen(true);
  }, []);
  
  const handleDictateNotes = useCallback((visitToDictate: Visit) => {
    setEditingVisit(visitToDictate);
    setIsFutureVisit(false);
    setStartDictationOnOpen(true);
    setIsVisitFormOpen(true);
  }, []);

  const handleLogFollowUp = useCallback((baseVisit: Visit) => {
    const followUpVisit: Partial<Visit> = {
      companyName: baseVisit.companyName,
      city: baseVisit.city,
      latitude: baseVisit.latitude,
      longitude: baseVisit.longitude,
      visitNumber: (baseVisit.visitNumber || 1) + 1,
      partnershipConfidence: baseVisit.partnershipConfidence
    };
    setEditingVisit(followUpVisit as Visit);
    setIsFutureVisit(false);
    setStartDictationOnOpen(false);
    setIsVisitFormOpen(true);
  }, []);

  const handleDeleteVisit = useCallback(async (visitId: string) => {
    try {
      await deleteVisitAction(visitId);
      setVisits(prev => prev.filter(v => v.id !== visitId));
      if (zoomedVisit?.id === visitId) {
        setZoomedVisit(null);
      }
      toast({ title: 'Visit Deleted', description: 'The visit has been successfully removed.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Deletion Failed', description: error.message });
    }
  }, [toast, zoomedVisit]);
  
  const handleUpdateDealClosed = useCallback(async (visitId: string, dealClosed: boolean, dealClosedDate?: Date) => {
    try {
      await updateDealClosedAction(visitId, dealClosed, dealClosedDate);
      toast({ title: "Deal Status Updated" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Update Failed", description: error.message });
    }
  }, [toast]);

  const handleSaveVisit = async (payload: Omit<Visit, 'id'> & { id?: string }, options?: { andClose?: boolean; expandOnClose?: boolean; }): Promise<Visit> => {
    const result = await saveVisitAction(payload);
    if (result.error) {
      toast({ variant: 'destructive', title: 'Save Failed', description: result.error });
      throw new Error(result.error);
    }
    
    if (result.visit) {
        toast({ title: `Visit ${result.isNewVisit ? 'Logged' : 'Updated'}`, description: `Details for ${result.visit.companyName} have been saved.` });
        if(options?.andClose) {
           setIsVisitFormOpen(false);
           setEditingVisit(undefined);
           if (options?.expandOnClose) {
             setZoomedVisit(result.visit);
           }
        }
        return result.visit;
    }
    throw new Error('Save action did not return a visit.');
  };

  const handleAddHotLeads = useCallback((places: FoundPlace[]) => {
    const newLeads = places.map((place): HotLead => ({
        id: `hl-${place.latitude}-${place.longitude}`,
        companyName: place.companyName,
        address: place.address,
        city: place.city,
        phone: place.phone,
        latitude: place.latitude,
        longitude: place.longitude,
        addedAt: new Date(),
    }));

    setHotLeads(prev => {
        const existingLeadIds = new Set(prev.map(p => p.id));
        const filteredNewLeads = newLeads.filter(nl => !existingLeadIds.has(nl.id));
        return [...prev, ...filteredNewLeads];
    });

    toast({ title: `${newLeads.length} Hot Leads Added`, description: "Companies have been added to your 'Flagged Hotspots' list." });

  }, [toast]);


  const { futureMeetings, futureVisits, flaggedHotspots, activeTrials, closedDeals } = useMemo(() => {
    if (isLoading) return { futureMeetings: [], futureVisits: [], flaggedHotspots: [], activeTrials: [], closedDeals: [] };
    const today = startOfToday();
    return {
      futureMeetings: visits.filter(v => v.futureMeetingDateTime && new Date(v.futureMeetingDateTime) >= today),
      futureVisits: visits.filter(v => !v.futureMeetingDateTime && !v.dealClosed && new Date(v.timestamp) >= today),
      flaggedHotspots: hotLeads,
      activeTrials: visits.filter(v => v.freeTrial && !v.dealClosed),
      closedDeals: visits.filter(v => v.dealClosed),
    };
  }, [visits, hotLeads, isLoading]);
  
  if (!salesperson) {
    return <SalespersonSelectorModal salespeople={DUMMY_SALESPEOPLE} onSelectSalesperson={handleSelectSalesperson} />;
  }

  if (isTerritoryUploadOpen) {
    return <TerritoryUploadModal isOpen={isTerritoryUploadOpen} onClose={() => setIsTerritoryUploadOpen(false)} />;
  }

  const AccordionSection = ({ title, icon, count, children, defaultOpen = false }: { title: string, icon: React.ReactNode, count: number, children: React.ReactNode, defaultOpen?: boolean }) => (
    <AccordionItem value={title.toLowerCase().replace(/[^a-z0-9]/g, '-')} className="bg-gray-800/50 rounded-lg border-gray-700/50 px-4">
      <AccordionTrigger className="hover:no-underline">
        <div className="flex items-center gap-4">
          {icon}
          <span className="text-lg font-semibold text-white">{title}</span>
          <span className="text-sm font-normal text-gray-400">({count})</span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="pt-2 pb-4">
        {children}
      </AccordionContent>
    </AccordionItem>
  );
  
  const VisitItem = ({ item }: { item: Visit | HotLead }) => (
      <div className="p-3 bg-gray-900/60 rounded-md border border-gray-700/50">
          <p className="font-semibold text-white">{item.companyName}</p>
          {'address' in item && <p className="text-sm text-gray-400">{item.address}, {item.city}</p>}
      </div>
  );
  
  const renderVisitList = (list: Visit[]) => (
    <div className="space-y-2">
      {isLoading ? (
        Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="p-3 bg-gray-900/60 rounded-md border border-gray-700/50 space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))
      ) : list.length > 0 ? (
        list.map(visit => <VisitItem key={visit.id} item={visit} />)
      ) : (
        <p className="text-sm text-gray-400 text-center py-2">No items in this category.</p>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col p-4 font-sans">
      <header className="text-center py-4">
        <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 text-transparent bg-clip-text">
          Optimum Trailblazer
        </h1>
        <p className="text-lg text-purple-300 font-light mt-1">Navigator</p>
        <div className="flex items-center justify-center gap-2 mt-2 text-gray-300">
          <MapPin size={16} />
          <span>{currentLocation}</span>
        </div>
      </header>

      <main className="flex-grow space-y-4 pt-4">
        <div className="bg-gray-800/50 rounded-lg p-3 flex justify-between items-center border border-gray-700/50">
          <div className="flex items-center gap-2">
            <User size={20} className="text-purple-400" />
            <span className="font-semibold">{salesperson.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar size={20} className="text-purple-400" />
            <span className="font-semibold">{format(currentDate, 'MMM dd, yyyy')}</span>
          </div>
        </div>

        <div className="bg-gray-800/50 rounded-full p-2 flex justify-around items-center border border-gray-700/50">
          <Button variant="ghost" size="icon" className="rounded-full bg-purple-600/50 text-white w-12 h-12" onClick={handleAddVisit}><Plus size={24} /></Button>
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setIsFindCompanyModalOpen(true)}><Search size={24} /></Button>
          <Button variant="ghost" size="icon" className="rounded-full"><ListChecks size={24} /></Button>
          <Button variant="ghost" size="icon" className="rounded-full"><MapIcon size={24} /></Button>
          <Link href="/about" passHref>
            <Button variant="ghost" size="icon" className="rounded-full"><Info size={24} /></Button>
          </Link>
        </div>
        
        <Accordion type="multiple" defaultValue={['future-meetings']} className="w-full space-y-3">
          <AccordionSection title="Future Meetings" icon={<Calendar size={24} className="text-purple-400"/>} count={futureMeetings.length} defaultOpen>
            {renderVisitList(futureMeetings)}
          </AccordionSection>

          <AccordionSection title="Future Visits (Unscheduled)" icon={<Folder size={24} className="text-blue-400"/>} count={futureVisits.length}>
             {renderVisitList(futureVisits)}
          </AccordionSection>

          <AccordionSection title="Flagged Hotspots" icon={<AlertTriangle size={24} className="text-orange-400"/>} count={flaggedHotspots.length}>
            <div className="space-y-2">
              {isLoading ? (
                 Array.from({ length: 1 }).map((_, i) => (
                  <div key={i} className="p-3 bg-gray-900/60 rounded-md border border-gray-700/50 space-y-2">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ))
              ) : flaggedHotspots.length > 0 ? (
                 flaggedHotspots.map(lead => <VisitItem key={lead.id} item={lead} />)
              ) : (
                <p className="text-sm text-gray-400 text-center py-2">No hotspots flagged yet.</p>
              )}
            </div>
          </AccordionSection>

          <AccordionSection title="Active Free Trials" icon={<PackageCheck size={24} className="text-teal-400"/>} count={activeTrials.length}>
            {renderVisitList(activeTrials)}
          </AccordionSection>

          <AccordionSection title="Deals Closed" icon={<DollarSign size={24} className="text-green-400"/>} count={closedDeals.length}>
            {renderVisitList(closedDeals)}
          </AccordionSection>
        </Accordion>
      </main>
      
      <div className="fixed bottom-6 right-6 flex items-center gap-4 z-20">
        <Button variant="ghost" size="icon" className="w-16 h-16 rounded-full bg-purple-600 shadow-lg shadow-purple-600/50">
          <Flame size={32} className="text-white"/>
        </Button>
      </div>
      
       <footer className="h-16">
        {/* Placeholder for bottom nav if needed */}
      </footer>
      
      <VisitForm
          isOpen={isVisitFormOpen}
          onClose={() => {
              setIsVisitFormOpen(false);
              setEditingVisit(undefined);
              setStartDictationOnOpen(false);
          }}
          onSave={handleSaveVisit}
          initialData={editingVisit}
          salesperson={salesperson}
          startDictationOnOpen={startDictationOnOpen}
          isFutureVisit={isFutureVisit}
      />

      <FindCompanyModal
        isOpen={isFindCompanyModalOpen}
        onClose={() => setIsFindCompanyModalOpen(false)}
        onAddAsVisit={(visitData) => {
          setEditingVisit(visitData as Visit);
          setIsFutureVisit(true);
          setStartDictationOnOpen(false);
          setIsVisitFormOpen(true);
        }}
        onAddHotLeads={handleAddHotLeads}
        destinationCities={[]}
        territory={salesperson?.territory}
      />
      
    </div>
  );
}

    