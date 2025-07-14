
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Visit, Salesperson, HotLead } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Calendar, User, MapPin, Plus, Folder, ListChecks, Info, Flame, DollarSign, PackageCheck, AlertTriangle } from 'lucide-react';
import { format, startOfToday } from 'date-fns';

const DUMMY_SALESPERSON: Salesperson = {
  id: 'lyman-1',
  name: 'Lyman',
  territory: [],
};

const DUMMY_VISITS: Visit[] = [
    { id: 'visit-1', companyName: "Future Meeting Co.", timestamp: new Date('2025-07-15T10:00:00'), futureMeetingSet: true, futureMeetingDateTime: new Date('2025-07-15T10:00:00') },
    { id: 'visit-2', companyName: "Another Future Meeting", timestamp: new Date('2025-07-18T14:00:00'), futureMeetingSet: true, futureMeetingDateTime: new Date('2025-07-18T14:00:00') },
    { id: 'visit-3', companyName: "Unscheduled Prospect", timestamp: new Date('2025-07-11T11:00:00'), partnershipConfidence: 4 },
    { id: 'visit-4', companyName: "Hotspot Inc.", timestamp: new Date('2025-07-10T09:30:00'), notes: 'Flagged as a hotspot.' },
    { id: 'visit-5', companyName: "Trial Systems", timestamp: new Date('2025-07-09T15:00:00'), freeTrial: true, freeTrialStartDate: new Date('2025-07-09') },
    { id: 'visit-6', companyName: "Closed Deal Corp", timestamp: new Date('2025-07-08T13:00:00'), dealClosed: true, dealClosedDate: new Date('2025-07-08') },
];

const DUMMY_HOT_LEADS: HotLead[] = [
    { id: 'lead-1', companyName: "Urgent Prospect", address: "123 Main St", city: "Lynn, MA", phone: "555-1234", addedAt: new Date() },
    { id: 'lead-2', companyName: "High Priority Target", address: "456 Oak Ave", city: "Lynn, MA", phone: "555-5678", addedAt: new Date() },
]

export default function HomePage() {
  const [salesperson, setSalesperson] = useState<Salesperson>(DUMMY_SALESPERSON);
  const [currentDate, setCurrentDate] = useState<Date | null>(null);
  const [currentLocation, setCurrentLocation] = useState("Lynn, MA");

  useEffect(() => {
    setCurrentDate(new Date('2025-07-10'));
  }, []);

  const { futureMeetings, futureVisits, flaggedHotspots, activeTrials, closedDeals } = useMemo(() => {
    const today = startOfToday();
    return {
      futureMeetings: DUMMY_VISITS.filter(v => v.futureMeetingDateTime && new Date(v.futureMeetingDateTime) >= today),
      futureVisits: DUMMY_VISITS.filter(v => !v.futureMeetingDateTime && !v.dealClosed && new Date(v.timestamp) >= today),
      flaggedHotspots: DUMMY_HOT_LEADS,
      activeTrials: DUMMY_VISITS.filter(v => v.freeTrial && !v.dealClosed),
      closedDeals: DUMMY_VISITS.filter(v => v.dealClosed),
    };
  }, []);

  const AccordionSection = ({ title, icon, count, children, defaultOpen = false }: { title: string, icon: React.ReactNode, count: number, children: React.ReactNode, defaultOpen?: boolean }) => (
    <AccordionItem value={title.toLowerCase().replace(' ', '-')} className="bg-gray-800/50 rounded-lg border-gray-700/50 px-4">
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


  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col p-4 font-sans">
      <header className="text-center py-4">
        <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 text-transparent bg-clip-text">
          Optimum Trailblazer
        </h1>
        <p className="text-lg text-purple-300 font-light mt-1">Navigator</p>
        <div className="flex items-center justify-center gap-2 mt-2 text-gray-300">
          <MapPin size={16} />
          <span>Currently Located: {currentLocation}</span>
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
            <span className="font-semibold">{currentDate ? format(currentDate, 'MMM dd, yyyy') : 'Loading...'}</span>
          </div>
        </div>

        <div className="bg-gray-800/50 rounded-full p-2 flex justify-around items-center border border-gray-700/50">
          <Button variant="ghost" size="icon" className="rounded-full bg-purple-600/50 text-white w-12 h-12"><Plus size={24} /></Button>
          <Button variant="ghost" size="icon" className="rounded-full"><Folder size={24} /></Button>
          <Button variant="ghost" size="icon" className="rounded-full"><ListChecks size={24} /></Button>
          <Button variant="ghost" size="icon" className="rounded-full"><MapPin size={24} /></Button>
          <Button variant="ghost" size="icon" className="rounded-full"><Info size={24} /></Button>
        </div>
        
        <Accordion type="multiple" defaultValue={['future-meetings']} className="w-full space-y-3">
          <AccordionSection title="Future Meetings" icon={<Calendar size={24} className="text-purple-400"/>} count={futureMeetings.length} defaultOpen>
            <div className="space-y-2">
              {futureMeetings.map(visit => <VisitItem key={visit.id} item={visit} />)}
            </div>
          </AccordionSection>

          <AccordionSection title="Future Visits (Unscheduled)" icon={<Folder size={24} className="text-blue-400"/>} count={futureVisits.length}>
             <div className="space-y-2">
                {futureVisits.map(visit => <VisitItem key={visit.id} item={visit} />)}
             </div>
          </AccordionSection>

          <AccordionSection title="Flagged Hotspots" icon={<AlertTriangle size={24} className="text-orange-400"/>} count={flaggedHotspots.length}>
            <div className="space-y-2">
              {flaggedHotspots.map(lead => <VisitItem key={lead.id} item={lead} />)}
            </div>
          </AccordionSection>

          <AccordionSection title="Active Free Trials" icon={<PackageCheck size={24} className="text-teal-400"/>} count={activeTrials.length}>
            <div className="space-y-2">
                {activeTrials.map(visit => <VisitItem key={visit.id} item={visit} />)}
            </div>
          </AccordionSection>

          <AccordionSection title="Deals Closed" icon={<DollarSign size={24} className="text-green-400"/>} count={closedDeals.length}>
            <div className="space-y-2">
              {closedDeals.map(visit => <VisitItem key={visit.id} item={visit} />)}
            </div>
          </AccordionSection>
        </Accordion>
      </main>
      
      <div className="fixed bottom-6 right-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" className="w-16 h-16 rounded-full bg-purple-600 shadow-lg shadow-purple-600/50">
          <Flame size={32} className="text-white"/>
        </Button>
      </div>

       <footer className="h-16">
        {/* Placeholder for bottom nav if needed */}
      </footer>
    </div>
  );
}
