
'use client';

import { useState, useEffect } from 'react';
import type { Visit, Salesperson } from '@/lib/types';
import { Button } from '@/components/ui/button';
import MapPlaceholder from '@/components/map-placeholder';
import VisitForm from '@/components/visit-form';
import VisitCard from '@/components/visit-card';
import ExportButton from '@/components/export-button';
import { PlusCircle, ListChecks, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import SalespersonSelectorModal from '@/components/salesperson-selector-modal';

// Updated salespeople list
const SALESPEOPLE: Salesperson[] = [
  { id: 'sales_1', name: 'Jim Karat' },
  { id: 'sales_2', name: 'Chris Canestrari' },
  { id: 'sales_3', name: 'Paul W. Lyman' },
  { id: 'sales_4', name: 'Sarah Kessel' },
  { id: 'sales_5', name: 'George Maroon' },
  { id: 'sales_6', name: 'Tom Brady' },
  { id: 'sales_7', name: 'Sam' },
];
const SELECTED_SALESPERSON_ID_KEY = 'optimumTrailblazerSelectedSalespersonId';


export default function HomePage() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [isVisitFormOpen, setIsVisitFormOpen] = useState(false);
  const [currentEditingVisit, setCurrentEditingVisit] = useState<Visit | undefined>(undefined);
  const [sessionAttemptNumber, setSessionAttemptNumber] = useState<number>(0);
  const [selectedSalesperson, setSelectedSalesperson] = useState<Salesperson | null>(null);
  const [userCurrentLatitude, setUserCurrentLatitude] = useState<number | undefined>();
  const [userCurrentLongitude, setUserCurrentLongitude] = useState<number | undefined>();
  const { toast } = useToast();

  const getVisitsStorageKey = (): string | null => {
    if (!selectedSalesperson) return null;
    return `trailblazerVisits_${selectedSalesperson.id}`;
  };

  // Effect to load selected salesperson
  useEffect(() => {
    const storedSalespersonId = localStorage.getItem(SELECTED_SALESPERSON_ID_KEY);
    if (storedSalespersonId) {
      const foundSalesperson = SALESPEOPLE.find(s => s.id === storedSalespersonId);
      if (foundSalesperson) {
        setSelectedSalesperson(foundSalesperson);
      } else {
        localStorage.removeItem(SELECTED_SALESPERSON_ID_KEY); // Clean up invalid ID
      }
    }
  }, []);

  // Effect to load visits AFTER salesperson is selected & get mock GPS
  useEffect(() => {
    if (!selectedSalesperson) {
      setVisits([]); // Clear visits if no salesperson is selected
      setSessionAttemptNumber(0);
      setUserCurrentLatitude(undefined);
      setUserCurrentLongitude(undefined);
      return;
    }
    const visitsStorageKey = getVisitsStorageKey();
    if (!visitsStorageKey) return;

    const storedVisits = localStorage.getItem(visitsStorageKey);
    if (storedVisits) {
      try {
        const parsedVisits = JSON.parse(storedVisits).map((visit: any) => ({
          ...visit,
          timestamp: new Date(visit.timestamp)
        }));
        setVisits(parsedVisits);
      } catch (error) {
        console.error("Failed to parse visits from localStorage", error);
        localStorage.removeItem(visitsStorageKey); // Clear corrupted data
        setVisits([]);
      }
    } else {
      setVisits([]); // No visits for this salesperson or first time
    }
    setSessionAttemptNumber(0); // Reset session attempts when salesperson changes or loads

    // Simulate getting current location
    const randomLat = parseFloat((Math.random() * (49 - 25) + 25).toFixed(6));
    const randomLng = parseFloat((Math.random() * (-66 - -125) + -125).toFixed(6));
    setUserCurrentLatitude(randomLat);
    setUserCurrentLongitude(randomLng);
    toast({
      title: "Mock Location Acquired",
      description: `App initialized with mock location: Lat: ${randomLat.toFixed(4)}, Lng: ${randomLng.toFixed(4)}`
    });

  }, [selectedSalesperson, toast]); // Added toast to dependencies

  // Effect to save visits
  useEffect(() => {
    if (!selectedSalesperson) return;
    const visitsStorageKey = getVisitsStorageKey();
    if (!visitsStorageKey) return;

    if (visits.length > 0 || localStorage.getItem(visitsStorageKey)) {
        localStorage.setItem(visitsStorageKey, JSON.stringify(visits));
    }
  }, [visits, selectedSalesperson]);


  const handleSelectSalesperson = (salesperson: Salesperson) => {
    setSelectedSalesperson(salesperson);
    localStorage.setItem(SELECTED_SALESPERSON_ID_KEY, salesperson.id);
    setIsVisitFormOpen(false);
    setCurrentEditingVisit(undefined);
    // sessionAttemptNumber will be reset by the useEffect dependent on selectedSalesperson
    toast({ title: `Profile Switched: ${salesperson.name}`, description: "Your view has been updated." });
  };
  
  const handleOpenAddVisitForm = () => {
    const newAttemptNumber = sessionAttemptNumber + 1;
    setSessionAttemptNumber(newAttemptNumber);

    const currentTime = new Date();
    const startTimeString = `Session Attempt #${newAttemptNumber}: Meeting started at ${format(currentTime, 'HH:mm')}.`;
    
    setCurrentEditingVisit({
      id: '', 
      timestamp: currentTime,
      companyName: '',
      notes: startTimeString,
      latitude: userCurrentLatitude, // Use app-level current location
      longitude: userCurrentLongitude, // Use app-level current location
      contactInfo: undefined,
      notesSummary: undefined,
      partnershipConfidence: undefined,
      hasBusinessCard: false,
      discussedCompetitors: false,
    });
    setIsVisitFormOpen(true);
  };

  const handleEditVisit = (visit: Visit) => {
    setCurrentEditingVisit(visit);
    setIsVisitFormOpen(true);
  };
  
  const handleUpdateVisitInList = (updatedVisit: Visit) => {
    setVisits(prevVisits => 
        prevVisits.map(v => v.id === updatedVisit.id ? updatedVisit : v)
    );
  };

  const handleSaveVisit = (visit: Visit) => {
    setVisits(prevVisits => {
      const existingVisitIndex = prevVisits.findIndex(v => v.id === visit.id);
      if (existingVisitIndex > -1) {
        const updatedVisits = [...prevVisits];
        updatedVisits[existingVisitIndex] = visit;
        return updatedVisits;
      }
      return [visit, ...prevVisits].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    });
  };

  const handleDeleteVisit = (visitId: string) => {
    setVisits(prevVisits => prevVisits.filter(v => v.id !== visitId));
    toast({ title: 'Visit Deleted', description: 'The visit log has been removed.' });
  };

  if (!selectedSalesperson) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <SalespersonSelectorModal
          salespeople={SALESPEOPLE}
          onSelectSalesperson={handleSelectSalesperson}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        <header className="sm:text-left">
          <h1
            className="text-5xl sm:text-6xl font-headline font-bold text-primary drop-shadow-sm text-center"
            style={{
              textShadow: [
                '-1px -1px 0 hsl(var(--accent))',
                '1px -1px 0 hsl(var(--accent))',
                '-1px 1px 0 hsl(var(--accent))',
                '1px 1px 0 hsl(var(--accent))',
              ].join(', '),
            }}
          >
            Optimum Trailblazer
          </h1>
          {selectedSalesperson && (
            <div className="flex items-center justify-center sm:justify-start text-sm text-muted-foreground mt-2 bg-card p-2 rounded-md shadow-sm">
              <User className="mr-2 h-4 w-4 text-primary" />
              Active User: <button onClick={() => setSelectedSalesperson(null)} className="font-semibold text-primary hover:underline ml-1 focus:outline-none">{selectedSalesperson.name} (Switch)</button>
            </div>
          )}
        </header>

        <Tabs defaultValue="field-day" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6 shadow-sm">
            <TabsTrigger value="field-day">Field Day</TabsTrigger>
            <TabsTrigger value="call-day">Call Day</TabsTrigger>
            <TabsTrigger value="daily-route">Daily Route Overview</TabsTrigger>
          </TabsList>

          <TabsContent value="field-day">
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-center items-center gap-2 mb-4 p-4 bg-card rounded-lg shadow">
                    <h2 className="text-xl font-semibold text-foreground text-center sm:text-left">
                      Welcome {selectedSalesperson.name}! Good Luck Today!
                    </h2>
                </div>
                <div className="flex justify-center items-center w-full">
                    <Button onClick={handleOpenAddVisitForm} size="lg" className="shadow-md hover:shadow-lg transition-shadow">
                        <PlusCircle className="mr-2 h-5 w-5" /> Hit New Door
                    </Button>
                </div>

                {visits.length === 0 && sessionAttemptNumber === 0 ? (
                    <div className="text-center py-10 bg-card rounded-lg shadow">
                    <p className="text-xl text-muted-foreground mb-4">No visits logged yet for field day.</p>
                    <Button onClick={handleOpenAddVisitForm} variant="secondary">
                        When you click "Hit New Door" this app will help you streamline your efforts
                    </Button>
                    </div>
                ) : (
                    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {visits.map(visit => (
                        <VisitCard 
                        key={visit.id} 
                        visit={visit} 
                        onEdit={handleEditVisit} 
                        onDelete={handleDeleteVisit}
                        onUpdateVisit={handleUpdateVisitInList} 
                        />
                    ))}
                    </div>
                )}
            </div>
          </TabsContent>

          <TabsContent value="call-day">
            <div className="p-6 bg-card rounded-xl shadow-xl min-h-[300px] flex flex-col items-center justify-center">
              <h2 className="text-2xl font-headline font-semibold mb-4 text-foreground">
                Call Day Activities
              </h2>
              <p className="text-muted-foreground text-center">
                This section is for logging calls, managing call lists, or viewing call-related analytics.
                <br />
                Content for Call Day will be implemented here.
              </p>
              <p className="mt-4 text-sm text-muted-foreground">Logged in as: {selectedSalesperson.name}</p>
            </div>
          </TabsContent>

          <TabsContent value="daily-route">
            <section aria-labelledby="map-section-title" className="p-6 bg-card rounded-xl shadow-xl space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div className="flex items-center gap-3">
                      <h2 id="visits-section-title" className="text-2xl font-headline font-semibold flex items-center text-foreground">
                          <ListChecks className="mr-3 h-7 w-7 text-primary" /> Logged Company Visits
                      </h2>
                      {visits.length > 0 && (
                          <Badge variant="secondary" className="text-sm font-medium">
                              Total Doors Knocked: {visits.length}
                          </Badge>
                      )}
                  </div>
                  <ExportButton visits={visits} />
              </div>
              <MapPlaceholder visits={visits} />
               <p className="mt-4 text-sm text-muted-foreground text-center">Route for: {selectedSalesperson.name}</p>
            </section>
          </TabsContent>
        </Tabs>

        <VisitForm
          isOpen={isVisitFormOpen}
          onClose={() => {
            setIsVisitFormOpen(false);
            setCurrentEditingVisit(undefined);
          }}
          onSave={handleSaveVisit}
          initialData={currentEditingVisit}
        />
      </main>
      <footer className="text-center py-8 text-muted-foreground text-sm border-t mt-12">
        <p>&copy; {new Date().getFullYear()} Optimum Trailblazer. Personalized for {selectedSalesperson.name}.</p>
      </footer>
    </div>
  );
}
