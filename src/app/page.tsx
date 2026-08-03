'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { Visit, ChatMessage, Salesperson, ManagedFile, HotLead, CompanyDoc } from '@/lib/types';
import { Button } from '@/components/ui/button';
import VisitForm from '@/components/visit-form';
import VisitCard from '@/components/visit-card';
import GoogleMapComponent from '@/components/google-map';
import { 
  PlusCircle, 
  MapPin, 
  TrendingUp, 
  CheckCircle2, 
  Target, 
  History, 
  UserPlus, 
  CalendarIcon, 
  User, 
  Loader2,
  Compass,
  ArrowRight,
  BarChart3,
  CalendarDays
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { format, isToday, startOfDay, addDays, isSameDay } from 'date-fns';
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { UiCard, UiCardContent, UiCardHeader, UiCardTitle } from '@/components/ui/card';
import { ScrollArea } from "@/components/ui/scroll-area";
import { getAiChatResponseAction, saveVisitAction, deleteVisitAction } from '@/app/actions';
import FindCompanyModal from '@/components/find-company-modal';
import { cn } from '@/lib/utils';
import { db } from '@/lib/firebase';
import { useToast } from "@/hooks/use-toast";
import { collection, onSnapshot, query, Timestamp } from 'firebase/firestore';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Progress } from '@/components/ui/progress';

const salespeople: Salesperson[] = [
    { 
        id: '1', 
        name: 'Lyman', 
        territory: [
            { name: 'NH/ME Seacoast', bounds: { minLat: 42.85, maxLat: 43.40, minLng: -71.00, maxLng: -70.50 } }
        ] 
    }
];

const VisitCardAccordionItem = ({ visit, onEdit, onDelete, onUpdateDealClosed, setZoomedVisit, isOnCallList }: {
  visit: Visit;
  onEdit: (visit: Visit) => void;
  onDelete: (visitId: string) => void;
  onUpdateDealClosed: (visitId: string, dealClosed: boolean) => void;
  setZoomedVisit: (visit: Visit | null) => void;
  isOnCallList: boolean;
}) => {
  const itemRef = useRef<HTMLDivElement>(null);

  const handleAccordionScroll = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (e.currentTarget.getAttribute('data-state') === 'closed') {
      setTimeout(() => {
        itemRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    }
  };

  const coolerCount = visit.interestedUnits?.length || 0;

  return (
    <AccordionItem ref={itemRef} value={visit.id} className={cn("border bg-card rounded-xl overflow-hidden mb-3 shadow-sm", visit.dealClosed ? "border-green-500/50" : "border-primary/10")}>
      <AccordionTrigger onClick={handleAccordionScroll} className="px-4 py-3 hover:no-underline w-full text-left border-none">
        <div className="flex flex-1 items-center justify-between min-w-0 gap-4">
          <div className="flex flex-1 flex-col min-w-0">
             <h4 className="font-bold text-foreground truncate">{visit.companyName}</h4>
             <span className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> {visit.city}</span>
          </div>
          <div className="flex items-center gap-2">
            {coolerCount > 0 && (
                <Badge variant={visit.dealClosed ? 'default' : 'secondary'} className={cn(visit.dealClosed && "bg-green-600")}>
                    {coolerCount} {coolerCount === 1 ? 'unit' : 'units'}
                </Badge>
            )}
            {visit.dealClosed && <CheckCircle2 className="h-5 w-5 text-green-500" />}
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="p-0 border-t border-primary/5">
        <VisitCard
          visit={visit}
          onEdit={onEdit}
          onDelete={onDelete}
          onUpdateDealClosed={onUpdateDealClosed}
          onZoom={setZoomedVisit}
          isOnCallList={isOnCallList}
          onToggleCallList={() => {}}
        />
      </AccordionContent>
    </AccordionItem>
  );
};

export default function HomePage() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [hotLeads, setHotLeads] = useState<HotLead[]>([]);
  const [isVisitFormOpen, setIsVisitFormOpen] = useState(false);
  const [currentEditingVisit, setCurrentEditingVisit] = useState<Visit | undefined>(undefined);
  const [zoomedVisit, setZoomedVisit] = useState<Visit | null>(null);
  const [activeTab, setActiveTab] = useState('field-day');
  const [isFindCompanyModalOpen, setIsFindCompanyModalOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState<Date | null>(null);
  
  const { toast } = useToast();
  const timeZone = 'America/New_York';

  // Metrics
  const todaysVisits = useMemo(() => visits.filter(v => isToday(new Date(v.timestamp))), [visits]);
  
  const totalContractsSold = useMemo(() => {
    return visits.filter(v => v.dealClosed).reduce((acc, v) => {
        const coolers = v.interestedUnits?.length || 1; 
        return acc + coolers;
    }, 0);
  }, [visits]);

  const salesByLocation = useMemo(() => {
    const locations: Record<string, number> = {};
    visits.filter(v => v.dealClosed).forEach(v => {
        if (v.city) {
            const count = v.interestedUnits?.length || 1;
            locations[v.city] = (locations[v.city] || 0) + count;
        }
    });
    return Object.entries(locations).sort((a, b) => b[1] - a[1]);
  }, [visits]);

  const pastVisitsByDay = useMemo(() => {
    const today = startOfDay(new Date());
    const grouped: { [key: string]: Visit[] } = {};
    visits.filter(v => startOfDay(new Date(v.timestamp)) < today).forEach(v => {
        const key = startOfDay(new Date(v.timestamp)).toISOString().split('T')[0];
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(v);
    });
    return Object.entries(grouped).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());
  }, [visits]);

  useEffect(() => {
    setCurrentDate(new Date());
    if (!db) return;
    const q = query(collection(db, 'visits'));
    const unsub = onSnapshot(q, (snap) => {
        const cloudVisits = snap.docs.map(d => ({ 
          ...d.data(), 
          id: d.id, 
          timestamp: (d.data().timestamp as Timestamp).toDate(),
          futureMeetingDateTime: d.data().futureMeetingDateTime ? (d.data().futureMeetingDateTime as Timestamp).toDate() : undefined,
          freeTrialStartDate: d.data().freeTrialStartDate ? (d.data().freeTrialStartDate as Timestamp).toDate() : undefined,
        } as Visit));
        setVisits(cloudVisits.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()));
    });
    return () => unsub();
  }, []);

  const handleQuickLog = useCallback(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setCurrentEditingVisit({ id: `temp_${crypto.randomUUID()}`, timestamp: new Date(), companyName: '', latitude, longitude } as Visit);
          setIsVisitFormOpen(true);
        },
        () => {
          setCurrentEditingVisit({ id: `temp_${crypto.randomUUID()}`, timestamp: new Date(), companyName: '' } as Visit);
          setIsVisitFormOpen(true);
        }
      );
    } else {
      setCurrentEditingVisit({ id: `temp_${crypto.randomUUID()}`, timestamp: new Date(), companyName: '' } as Visit);
      setIsVisitFormOpen(true);
    }
  }, []);

  const handleSaveVisit = async (payload: any) => {
    const res = await saveVisitAction(payload);
    if (res.error) {
      toast({ variant: 'destructive', title: 'Error', description: res.error });
      throw new Error(res.error);
    }
    toast({ title: 'Success', description: 'Visit details saved.' });
    return res.visit as Visit;
  };

  const handleDeleteVisit = async (id: string) => {
    const res = await deleteVisitAction(id);
    if (res.error) toast({ variant: 'destructive', title: 'Error', description: res.error });
    else toast({ title: 'Visit Deleted' });
  };

  const handleUpdateDealClosed = async (id: string, closed: boolean) => {
    const res = await saveVisitAction({ id, dealClosed: closed } as any);
    if (res.error) toast({ variant: 'destructive', title: 'Error', description: res.error });
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-body pb-20">
      <div className="container mx-auto px-4 py-8 space-y-8 max-w-6xl">
        <header className="flex flex-col items-center justify-center space-y-4">
          <h1 className="text-5xl sm:text-7xl font-black aurora-text tracking-tighter text-center">Optimum Trailblazer</h1>
          <div className="flex items-center gap-4 text-sm font-medium">
             <Badge variant="outline" className="bg-primary/10 border-primary/20"><User className="mr-1 h-3 w-3" /> Lyman</Badge>
             <Badge variant="outline" className="bg-primary/10 border-primary/20"><CalendarIcon className="mr-1 h-3 w-3" /> {currentDate ? format(currentDate, 'MMM d, yyyy') : 'Loading...'}</Badge>
          </div>
        </header>

        {/* DASHBOARD */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <div className="bg-card aurora-glow border-2 border-primary/10 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-2">
                 <span className="text-sm font-bold text-muted-foreground flex items-center uppercase tracking-wider"><Target className="mr-2 h-4 w-4 text-primary" /> Daily Progress</span>
                 <Badge variant="outline" className="text-primary border-primary/20">{todaysVisits.length} / 15</Badge>
              </div>
              <div className="text-4xl font-black mb-4">{todaysVisits.length} <span className="text-lg font-normal text-muted-foreground">visits</span></div>
              <Progress value={(todaysVisits.length / 15) * 100} className="h-2" />
           </div>

           <div className="bg-card aurora-glow border-2 border-green-500/10 rounded-2xl p-6">
              <div className="text-sm font-bold text-muted-foreground flex items-center uppercase tracking-wider mb-2"><CheckCircle2 className="mr-2 h-4 w-4 text-green-500" /> Total Closed Contracts</div>
              <div className="text-4xl font-black mb-1">{totalContractsSold}</div>
              <div className="text-xs text-muted-foreground">Individual units across all closed deals.</div>
           </div>

           <div className="bg-card aurora-glow border-2 border-orange-500/10 rounded-2xl p-6">
              <div className="text-sm font-bold text-muted-foreground flex items-center uppercase tracking-wider mb-2"><MapPin className="mr-2 h-4 w-4 text-orange-500" /> Top Sales Locations</div>
              <ScrollArea className="h-[60px]">
                <div className="space-y-1">
                    {salesByLocation.slice(0, 3).map(([city, count]) => (
                        <div key={city} className="flex justify-between text-sm">
                            <span className="font-medium">{city}</span>
                            <span className="font-bold text-orange-500">{count} {count === 1 ? 'unit' : 'units'}</span>
                        </div>
                    ))}
                    {salesByLocation.length === 0 && <p className="text-xs text-muted-foreground italic">No sales logged yet.</p>}
                </div>
              </ScrollArea>
           </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-3 sm:grid-cols-6 h-auto p-1 bg-card border-2 border-primary/10 rounded-xl">
             <TabsTrigger value="field-day" className="rounded-lg py-2 font-bold">Field Day</TabsTrigger>
             <TabsTrigger value="planner" className="rounded-lg py-2 font-bold">Planner</TabsTrigger>
             <TabsTrigger value="call-day" className="rounded-lg py-2 font-bold">Call Day</TabsTrigger>
             <TabsTrigger value="visits" className="rounded-lg py-2 font-bold">Map</TabsTrigger>
             <TabsTrigger value="ai-chat" className="rounded-lg py-2 font-bold">Debbie AI</TabsTrigger>
             <TabsTrigger value="about" className="rounded-lg py-2 font-bold">Info</TabsTrigger>
          </TabsList>

          <TabsContent value="field-day" className="space-y-6 pt-6">
             <div className="flex justify-center gap-4">
                <Button size="lg" onClick={handleQuickLog} className="bg-primary hover:bg-primary/90 text-white font-black px-10 rounded-full shadow-xl hover:scale-105 transition-transform"><PlusCircle className="mr-2 h-6 w-6" /> Quicklog Visit</Button>
                <Button size="lg" variant="secondary" onClick={() => setIsFindCompanyModalOpen(true)} className="font-bold px-10 rounded-full shadow-lg border-2 border-primary/5 hover:bg-primary/5"><UserPlus className="mr-2 h-6 w-6" /> Hot Leads</Button>
             </div>

             <div className="space-y-4">
                <h3 className="text-2xl font-black flex items-center tracking-tight text-primary"><TrendingUp className="mr-3 h-6 w-6" /> Today's Pipeline</h3>
                {todaysVisits.length === 0 ? (
                  <div className="bg-card/50 border-2 border-dashed border-primary/10 rounded-2xl p-10 text-center space-y-2">
                    <p className="font-bold text-muted-foreground">No visits logged for today yet.</p>
                    <Button variant="link" onClick={handleQuickLog}>Start your first visit <ArrowRight className="ml-1 h-4 w-4" /></Button>
                  </div>
                ) : (
                  <Accordion type="multiple" className="space-y-4">
                    {todaysVisits.map(v => (
                      <VisitCardAccordionItem 
                        key={v.id} 
                        visit={v} 
                        onEdit={setCurrentEditingVisit as any} 
                        onDelete={handleDeleteVisit} 
                        onUpdateDealClosed={handleUpdateDealClosed} 
                        setZoomedVisit={setZoomedVisit} 
                        isOnCallList={false} 
                      />
                    ))}
                  </Accordion>
                )}
             </div>

             <div className="space-y-4 pt-10">
                <h3 className="text-2xl font-black flex items-center tracking-tight text-muted-foreground"><History className="mr-3 h-6 w-6" /> Recent Visit History</h3>
                {pastVisitsByDay.map(([day, visitsOnDay]) => (
                   <Accordion key={day} type="single" collapsible>
                      <AccordionItem value={day} className="border-none mb-4">
                         <AccordionTrigger className="bg-card/30 p-5 rounded-2xl hover:no-underline border-2 border-primary/5 data-[state=open]:border-primary/20 transition-all">
                            <div className="flex justify-between w-full pr-6 items-center">
                               <div className="flex flex-col items-start">
                                  <span className="font-black text-lg">{format(addDays(new Date(day), 1), 'eeee')}</span>
                                  <span className="text-sm text-muted-foreground">{format(addDays(new Date(day), 1), 'MMMM d, yyyy')}</span>
                               </div>
                               <Badge variant="secondary" className="px-3 py-1">{visitsOnDay.length} visits</Badge>
                            </div>
                         </AccordionTrigger>
                         <AccordionContent className="pt-4 space-y-4">
                            {visitsOnDay.map(v => (
                               <VisitCardAccordionItem 
                                 key={v.id} 
                                 visit={v} 
                                 onEdit={setCurrentEditingVisit as any} 
                                 onDelete={handleDeleteVisit} 
                                 onUpdateDealClosed={handleUpdateDealClosed} 
                                 setZoomedVisit={setZoomedVisit} 
                                 isOnCallList={false} 
                               />
                            ))}
                         </AccordionContent>
                      </AccordionItem>
                   </Accordion>
                ))}
             </div>
          </TabsContent>

          <TabsContent value="visits" className="pt-6">
            <div className="bg-card border-2 border-primary/10 rounded-2xl overflow-hidden shadow-2xl h-[600px]">
              <GoogleMapComponent visits={visits} />
            </div>
          </TabsContent>
          
          <TabsContent value="about" className="pt-6 space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-card border-2 border-primary/10 p-8 rounded-2xl space-y-4 shadow-lg">
                    <h3 className="text-2xl font-black text-primary flex items-center"><BarChart3 className="mr-3 h-6 w-6" /> Performance Metrics</h3>
                    <p className="text-muted-foreground leading-relaxed">Your progress is tracked by individual <strong>Cooler Units</strong>. Every cooler added to a closed visit counts as a separate contract on your dashboard.</p>
                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 space-y-2">
                        <div className="flex justify-between text-sm"><span>Goal: 50 Units/Mo</span> <span className="font-bold">{Math.round((totalContractsSold/50)*100)}%</span></div>
                        <Progress value={(totalContractsSold / 50) * 100} className="h-2" />
                    </div>
                </div>
                <div className="bg-card border-2 border-primary/10 p-8 rounded-2xl space-y-4 shadow-lg">
                    <h3 className="text-2xl font-black text-orange-500 flex items-center"><CalendarDays className="mr-3 h-6 w-6" /> Visit Strategies</h3>
                    <p className="text-muted-foreground leading-relaxed">Use the <strong>Deal Confidence</strong> system (1-5 stars) to prioritize your call list. 4 and 5-star prospects are your primary follow-up targets for Call Days.</p>
                </div>
             </div>
          </TabsContent>
        </Tabs>
      </div>

      <VisitForm 
        isOpen={isVisitFormOpen} 
        onClose={() => setIsVisitFormOpen(false)} 
        onSave={handleSaveVisit as any} 
        initialData={currentEditingVisit} 
        salesperson={salespeople[0]} 
      />
      
      <FindCompanyModal 
        isOpen={isFindCompanyModalOpen} 
        onClose={() => setIsFindCompanyModalOpen(false)} 
        onAddHotLeads={(leads) => setHotLeads(p => [...p, ...leads])} 
        hotLeads={hotLeads} 
        onDeleteHotLead={(id) => setHotLeads(p => p.filter(l => l.id !== id))} 
        onUpdateHotLeadNotes={(id, n) => setHotLeads(p => p.map(l => l.id === id ? { ...l, notes: n } : l))} 
        convertedHotLeads={new Set()} 
        onAddHotLeadAsVisit={()=>{}} 
      />
      
      {zoomedVisit && (
          <Dialog open={!!zoomedVisit} onOpenChange={() => setZoomedVisit(null)}>
              <DialogContent className="max-w-2xl bg-card p-0 overflow-hidden border-2 border-primary/20">
                <VisitCard 
                  visit={zoomedVisit} 
                  isZoomedView 
                  onEdit={()=>{}} 
                  onDelete={()=>{}} 
                  onUpdateDealClosed={()=>{}} 
                  isOnCallList={false} 
                  onToggleCallList={()=>{}} 
                />
              </DialogContent>
          </Dialog>
      )}
    </div>
  );
}