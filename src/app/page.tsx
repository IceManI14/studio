'use client';

import { useState, useEffect } from 'react';
import type { Visit } from '@/lib/types';
import { Button } from '@/components/ui/button';
import MapPlaceholder from '@/components/map-placeholder';
import VisitForm from '@/components/visit-form';
import VisitCard from '@/components/visit-card';
import ExportButton from '@/components/export-button';
import { PlusCircle, ListChecks } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function HomePage() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [isVisitFormOpen, setIsVisitFormOpen] = useState(false);
  const [currentEditingVisit, setCurrentEditingVisit] = useState<Visit | undefined>(undefined);
  const { toast } = useToast();

  // Load visits from localStorage on initial mount (client-side only)
  useEffect(() => {
    const storedVisits = localStorage.getItem('trailblazerVisits');
    if (storedVisits) {
      try {
        const parsedVisits = JSON.parse(storedVisits).map((visit: any) => ({
          ...visit,
          timestamp: new Date(visit.timestamp) // Ensure timestamp is a Date object
        }));
        setVisits(parsedVisits);
      } catch (error) {
        console.error("Failed to parse visits from localStorage", error);
        localStorage.removeItem('trailblazerVisits'); // Clear corrupted data
      }
    }
  }, []);

  // Save visits to localStorage whenever they change
  useEffect(() => {
    if (visits.length > 0 || localStorage.getItem('trailblazerVisits')) { // Avoid writing empty array if never existed
        localStorage.setItem('trailblazerVisits', JSON.stringify(visits));
    }
  }, [visits]);

  const handleOpenAddVisitForm = () => {
    setCurrentEditingVisit(undefined);
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

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-10">
        <header className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <h1 className="text-3xl sm:text-4xl font-headline font-bold text-primary drop-shadow-sm">
            Optimum Trailblazer
          </h1>
          <Button onClick={handleOpenAddVisitForm} size="lg" className="shadow-md hover:shadow-lg transition-shadow">
            <PlusCircle className="mr-2 h-5 w-5" /> Hit New Door
          </Button>
        </header>

        <section aria-labelledby="map-section-title" className="p-6 bg-card rounded-xl shadow-xl">
          <h2 id="map-section-title" className="text-2xl font-headline font-semibold mb-4 text-foreground">
            Daily Route Overview
          </h2>
          <MapPlaceholder visits={visits} />
        </section>

        <section aria-labelledby="visits-section-title">
          <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
            <h2 id="visits-section-title" className="text-2xl font-headline font-semibold flex items-center text-foreground">
              <ListChecks className="mr-3 h-7 w-7 text-primary" /> Logged Company Visits
            </h2>
            <ExportButton visits={visits} />
          </div>
          {visits.length === 0 ? (
            <div className="text-center py-10 bg-card rounded-lg shadow">
              <p className="text-xl text-muted-foreground mb-4">No visits logged yet.</p>
              <Button onClick={handleOpenAddVisitForm} variant="secondary">
                Click "Hit New Door" to get started!
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
        </section>

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
        <p>&copy; {new Date().getFullYear()} Optimum Trailblazer. Built with passion.</p>
      </footer>
    </div>
  );
}
