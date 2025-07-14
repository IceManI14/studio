
'use client';

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react';
import { db, firebaseConfigured } from '@/lib/firebase';
import { collection, onSnapshot, query, where, orderBy, Timestamp } from 'firebase/firestore';
import type { Visit, Salesperson, Territory, HotLead, ChatMessage, ManagedFile, CompanyDoc } from '@/lib/types';
import VisitCard from '@/components/visit-card';
import VisitForm from '@/components/visit-form';
import { Button } from '@/components/ui/button';
import { PlusCircle, UserCircle, Map as MapIcon, Loader2, List, LayoutGrid, BrainCircuit, Bot, Search, FileDown, FileUp, Settings, BarChart, Sun, Moon, Info, Calendar, Users, Briefcase, FileText, Download, Upload, Trash2, Mic, MapPin, LocateFixed, DollarSign, Edit, Navigation, AlertTriangle, Lightbulb } from 'lucide-react';
import dynamic from 'next/dynamic';
import SalespersonSelectorModal from '@/components/salesperson-selector-modal';
import TerritoryUploadModal from '@/components/territory-upload-modal';
import FindCompanyModal from '@/components/find-company-modal';
import { saveVisitAction, deleteVisitAction, getAiChatResponseAction, saveDailyReportAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, subDays, startOfDay, endOfDay, isToday, isWithinInterval } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from '@/components/ui/input';
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Line } from 'recharts';
import ExportPdfButton from '@/components/export-pdf-button';
import ExportButton from '@/components/export-button';
import ManageFilesModal from '@/components/manage-files-modal';
import { stateNameToAbbreviation } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import ExportHotLeadsPdfButton from '@/components/export-hot-leads-pdf-button';
import ExportHotLeadsCsvButton from '@/components/export-hot-leads-csv-button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

const GoogleMapComponent = dynamic(() => import('@/components/google-map'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-96 bg-secondary/50 rounded-lg shadow-md border"><Loader2 className="w-12 h-12 animate-spin text-primary" /><p className="ml-4 text-lg text-muted-foreground">Loading Map...</p></div>,
});
const MapPlaceholder = dynamic(() => import('@/components/map-placeholder'), { ssr: false });

const DUMMY_SALESPEOPLE: Salesperson[] = [
  {
    id: 'derek-h', name: 'Derek H', territory: [
      { name: 'Derek H', bounds: { minLat: 41.2, maxLat: 42.1, minLng: -72.0, maxLng: -70.9 } }, // Approximate RI/SE MA
    ]
  },
  { id: 'jake-h', name: 'Jake H', territory: [] },
  { id: 'justin-c', name: 'Justin C', territory: [] },
  { id: 'anthony-s', name: 'Anthony S', territory: [] },
  { id: 'david-d', name: 'David D', territory: [] },
  { id: 'andrew-d', name: 'Andrew D', territory: [] },
];

export default function HomePage() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [allVisits, setAllVisits] = useState<Visit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isFindCompanyModalOpen, setIsFindCompanyModalOpen] = useState(false);
  const [isManageFilesModalOpen, setIsManageFilesModalOpen] = useState(false);
  const [editingVisit, setEditingVisit] = useState<Visit | undefined>(undefined);
  const [salesperson, setSalesperson] = useState<Salesperson | null>(null);
  const [showTerritoryUploadModal, setShowTerritoryUploadModal] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [userLatitude, setUserLatitude] = useState<number | undefined>();
  const [userLongitude, setUserLongitude] = useState<number | undefined>();
  const [zoomedVisit, setZoomedVisit] = useState<Visit | null>(null);
  const { toast } = useToast();
  const [startDictationOnOpen, setStartDictationOnOpen] = useState(false);
  const [dateRange, setDateRange] = useState('today');
  const [hotLeads, setHotLeads] = useState<HotLead[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isFutureVisit, setIsFutureVisit] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  // AI Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isAiResponding, setIsAiResponding] = useState(false);
  const [isAiSheetOpen, setIsAiSheetOpen] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const [activeModel, setActiveModel] = useState<string>('googleai/gemini-1.5-flash-latest');
  const [managedFiles, setManagedFiles] = useState<ManagedFile[]>([]);
  const [showNewsItems, setShowNewsItems] = useState(false);

  const GENKIT_CONFIGURED = process.env.NEXT_PUBLIC_GENKIT_CONFIGURED === 'true';

  useEffect(() => {
    const storedSalesperson = localStorage.getItem('salesperson');
    if (storedSalesperson) {
      setSalesperson(JSON.parse(storedSalesperson));
    }
  }, []);

  useEffect(() => {
    if (salesperson) {
      localStorage.setItem('salesperson', JSON.stringify(salesperson));
      const territoryUploaded = localStorage.getItem('territoryPdfUploaded') === 'true';
      if (!territoryUploaded && GENKIT_CONFIGURED) {
        setShowTerritoryUploadModal(true);
      }
    }
  }, [salesperson, GENKIT_CONFIGURED]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLatitude(position.coords.latitude);
          setUserLongitude(position.coords.longitude);
        },
        (error) => {
          console.error("Error getting user location:", error);
        }
      );
    }
  }, []);

  const handleUpdateDealClosed = useCallback(async (visitId: string, dealClosed: boolean, dealClosedDate?: Date) => {
    const visitToUpdate = allVisits.find(v => v.id === visitId);
    if (!visitToUpdate) return;
    const optimisticVisits = allVisits.map(v => v.id === visitId ? { ...v, dealClosed, dealClosedDate } : v);
    setAllVisits(optimisticVisits);

    try {
      await saveVisitAction({ ...visitToUpdate, dealClosed, dealClosedDate: dealClosedDate || new Date() });
      toast({ title: 'Deal Status Updated', description: `${visitToUpdate.companyName} marked as ${dealClosed ? 'closed' : 'open'}.` });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Update Failed', description: error.message });
      setAllVisits(allVisits);
    }
  }, [allVisits, toast]);

  useEffect(() => {
    if (!firebaseConfigured) {
      console.warn("Firebase not configured. Using local storage for visits.");
      const localVisits = localStorage.getItem('visits');
      if (localVisits) {
        setAllVisits(JSON.parse(localVisits).map((v: any) => ({ ...v, timestamp: new Date(v.timestamp) })));
      }
      const localHotLeads = localStorage.getItem('hotLeads');
      if (localHotLeads) {
        setHotLeads(JSON.parse(localHotLeads).map((l: any) => ({ ...l, addedAt: new Date(l.addedAt) })));
      }
      setIsLoading(false);
      return;
    }

    if (!salesperson?.id) {
      setIsLoading(false);
      return;
    }

    const visitsQuery = query(
      collection(db, `salespeople/${salesperson.id}/visits`),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(visitsQuery, (querySnapshot) => {
      const visitsData = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          timestamp: (data.timestamp as Timestamp).toDate(),
          futureMeetingDateTime: data.futureMeetingDateTime ? (data.futureMeetingDateTime as Timestamp).toDate() : undefined,
          freeTrialStartDate: data.freeTrialStartDate ? (data.freeTrialStartDate as Timestamp).toDate() : undefined,
          dealClosedDate: data.dealClosedDate ? (data.dealClosedDate as Timestamp).toDate() : undefined,
        } as Visit;
      });
      setAllVisits(visitsData);
      localStorage.setItem('visits', JSON.stringify(visitsData));
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching visits:", error);
      toast({ variant: 'destructive', title: 'Error Fetching Data', description: 'Could not load visits from the database.' });
      setIsLoading(false);
    });

    const hotLeadsQuery = query(
      collection(db, `salespeople/${salesperson.id}/hotLeads`),
      orderBy('addedAt', 'desc')
    );
    const unsubscribeHotLeads = onSnapshot(hotLeadsQuery, (snapshot) => {
      const leadsData = snapshot.docs.map(doc => {
        const data = doc.data();
        return { id: doc.id, ...data, addedAt: (data.addedAt as Timestamp).toDate() } as HotLead;
      });
      setHotLeads(leadsData);
      localStorage.setItem('hotLeads', JSON.stringify(leadsData));
    });

    return () => {
      unsubscribe();
      unsubscribeHotLeads();
    };
  }, [salesperson, toast]);


  const filteredAndSortedVisits = useMemo(() => {
    let dateFiltered = allVisits;
    if (dateRange !== 'all') {
      const now = new Date();
      let interval: Interval;
      if (dateRange === 'today') {
        interval = { start: startOfDay(now), end: endOfDay(now) };
      } else if (dateRange === 'week') {
        interval = { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
      } else if (dateRange === 'month') {
        interval = { start: startOfDay(subDays(now, 29)), end: endOfDay(now) };
      } else {
        interval = { start: new Date(0), end: new Date() };
      }
      dateFiltered = allVisits.filter(v => isWithinInterval(new Date(v.timestamp), interval));
    }

    const finalFiltered = dateFiltered.filter(v => showArchived ? v.dealClosed : !v.dealClosed);
    return finalFiltered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [allVisits, dateRange, showArchived]);

  useEffect(() => {
    setVisits(filteredAndSortedVisits);
  }, [filteredAndSortedVisits]);

  const handleSaveVisit = async (visitData: Omit<Visit, 'id'> & { id?: string }, options: { andClose?: boolean, expandOnClose?: boolean } = { andClose: true, expandOnClose: false }) => {
    if (!salesperson) {
      toast({ variant: 'destructive', title: "No Salesperson Selected", description: "Cannot save visit." });
      throw new Error("No salesperson selected");
    }

    const payload = {
      ...visitData,
      salespersonId: salesperson.id,
      timestamp: visitData.timestamp || new Date(),
    };

    const tempId = visitData.id || `temp_${Date.now()}`;
    const optimisticVisit: Visit = {
      ...payload,
      id: tempId,
      timestamp: new Date(payload.timestamp),
      futureMeetingDateTime: visitData.futureMeetingDateTime ? new Date(visitData.futureMeetingDateTime) : undefined,
      freeTrialStartDate: visitData.freeTrialStartDate ? new Date(visitData.freeTrialStartDate) : undefined,
      dealClosedDate: visitData.dealClosedDate ? new Date(visitData.dealClosedDate) : undefined,
    };

    setAllVisits(prev => {
      const existingIndex = prev.findIndex(v => v.id === tempId);
      if (existingIndex > -1) {
        const newVisits = [...prev];
        newVisits[existingIndex] = optimisticVisit;
        return newVisits;
      }
      return [optimisticVisit, ...prev];
    });

    if (options.andClose) {
      setIsFormOpen(false);
      setEditingVisit(undefined);
    }

    const result = await saveVisitAction(payload);
    if (result.error) {
      toast({ variant: "destructive", title: "Save Failed", description: result.error });
      setAllVisits(allVisits);
      throw new Error(result.error);
    } else {
      if (options.expandOnClose && result.visit) {
        setZoomedVisit(result.visit);
      }
      toast({ title: result.isNewVisit ? "Visit Logged!" : "Visit Updated!", description: `${visitData.companyName} details have been saved.` });
      return result.visit!;
    }
  };

  const handleUpdateVisitFromMap = useCallback(async (visitId: string, updatedData: Partial<Visit>) => {
    const visitToUpdate = allVisits.find(v => v.id === visitId);
    if (!visitToUpdate) return;
    const fullPayload = { ...visitToUpdate, ...updatedData };
    await handleSaveVisit(fullPayload, { andClose: false });
  }, [allVisits]);

  const handleIntelRequest = (visit: Visit) => {
    setZoomedVisit(visit);
  };

  const handleZoomRequest = (visit: Visit) => {
    setZoomedVisit(visit);
    setViewMode('list');
  };

  const handleDeleteVisit = async (visitId: string) => {
    if (!salesperson) {
      toast({ variant: "destructive", title: "Cannot Delete", description: "No salesperson selected." });
      return;
    }

    const originalVisits = allVisits;
    setAllVisits(prev => prev.filter(v => v.id !== visitId));
    if (zoomedVisit?.id === visitId) {
      setZoomedVisit(null);
    }

    const result = await deleteVisitAction(visitId);
    if (result.error) {
      toast({ variant: "destructive", title: "Delete Failed", description: result.error });
      setAllVisits(originalVisits);
    } else {
      toast({ title: "Visit Deleted", description: "The visit has been removed." });
    }
  };

  const handleAddVisitClick = (isFuture = false) => {
    setEditingVisit(undefined);
    setIsFutureVisit(isFuture);
    setIsFormOpen(true);
  };

  const handleEditVisit = (visit: Visit) => {
    setEditingVisit(visit);
    setIsFutureVisit(false);
    setIsFormOpen(true);
  };

  const handleLogFollowUp = (visit: Visit) => {
    const followUpVisit: Partial<Visit> = {
      companyName: visit.companyName,
      city: visit.city,
      latitude: visit.latitude,
      longitude: visit.longitude,
      visitNumber: (visit.visitNumber || 1) + 1,
    };
    setEditingVisit(followUpVisit as Visit);
    setIsFutureVisit(false);
    setIsFormOpen(true);
  };

  const handleDictateNotes = (visit: Visit) => {
    setEditingVisit(visit);
    setStartDictationOnOpen(true);
    setIsFutureVisit(false);
    setIsFormOpen(true);
  };

  const handleAddFoundCompanyAsVisit = (place: Partial<Visit>) => {
    setEditingVisit({
      ...place,
      timestamp: new Date(),
    } as Visit);
    setIsFutureVisit(true);
    setIsFormOpen(true);
    setIsFindCompanyModalOpen(false);
  };

  const handleAddHotLeads = async (places: { companyName: string; address: string; city: string; phone: string; latitude?: number; longitude?: number }[]) => {
    if (!salesperson) return;
    const newHotLeads: HotLead[] = places.map(p => ({
      id: `hot_${p.companyName}_${Date.now()}`,
      ...p,
      addedAt: new Date(),
    }));

    setHotLeads(prev => [...newHotLeads, ...prev]);

    if (!firebaseConfigured) {
      toast({ title: `${newHotLeads.length} Hot Leads Added`, description: "They have been added to your local list." });
      return;
    }
  };

  const handleRemoveHotLead = (leadId: string) => {
    const originalLeads = hotLeads;
    setHotLeads(prev => prev.filter(l => l.id !== leadId));
  };

  useEffect(() => {
    if (isAiSheetOpen && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, isAiSheetOpen]);

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isAiResponding || !GENKIT_CONFIGURED) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: chatInput,
      timestamp: new Date(),
    };

    const currentMessages = [...chatMessages, userMessage];
    setChatMessages(currentMessages);
    setChatInput('');
    setIsAiResponding(true);

    const territoryPdfUrl = localStorage.getItem('userTerritoryPdfUrl') || undefined;

    const newsItems = showNewsItems
      ? [
        "Company-wide directive: Emphasize the cost savings of our RO/DI systems, especially for clients with high TDS readings. Mention service call avoidance.",
        "Marketing Alert: New 'Hydration Health' campaign launched. Mention benefits of pure water for employee wellness.",
        "Sales Incentive: Double commission on all 3-year contracts signed this month.",
      ]
      : [];

    const result = await getAiChatResponseAction({
      currentMessages,
      model: activeModel,
      visits: allVisits.slice(0, 15),
      territoryPdfUrl,
      managedFiles,
      newsItems,
    });

    setIsAiResponding(false);

    if (result.error) {
      const aiError: ChatMessage = { id: `ai-err-${Date.now()}`, sender: 'ai', text: `Error: ${result.error}`, timestamp: new Date() };
      setChatMessages(prev => [...prev, aiError]);
    } else if (result.aiResponse) {
      const aiResponse: ChatMessage = { id: `ai-${Date.now()}`, sender: 'ai', text: result.aiResponse, timestamp: new Date() };
      setChatMessages(prev => [...prev, aiResponse]);
    }
  };

  const handleSaveReport = async () => {
    const today = new Date();
    const todaysVisits = allVisits.filter(v => isToday(v.timestamp));

    if (todaysVisits.length === 0) {
      toast({ variant: 'destructive', title: 'No Visits Today', description: 'There are no visits logged for today to generate a report.' });
      return;
    }

    const reportToast = toast({ title: 'Generating Daily Report...', description: 'Please wait while we create your CSV file.' });

    try {
      const result = await saveDailyReportAction(todaysVisits);
      if (result.error) throw new Error(result.error);
      if (result.url) {
        toast({
          title: 'Report Generated!',
          description: (
            <div>
              <p>Your daily report has been saved to cloud storage.</p>
              <a href={result.url} target="_blank" rel="noopener noreferrer" className="font-bold underline text-primary">
                Click here to download the CSV.
              </a>
            </div>
          ),
          duration: 10000,
        });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Report Failed', description: e.message });
    } finally {
      reportToast.dismiss();
    }
  };


  if (!salesperson) {
    return <SalespersonSelectorModal salespeople={DUMMY_SALESPEOPLE} onSelectSalesperson={setSalesperson} />;
  }

  const PageHeader = () => (
    <header className="sticky top-0 z-30 flex items-center justify-between bg-background/80 px-4 py-3 backdrop-blur-md md:px-6 border-b">
      <div className="flex items-center gap-2">
        <BrainCircuit className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-xl font-bold font-headline text-primary">Optimum Trailblazer</h1>
          <div className="text-xs text-muted-foreground font-medium flex items-center">
            <UserCircle className="mr-1.5 h-3.5 w-3.5" />
            {salesperson.name}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 md:gap-2">
        <Button variant="ghost" size="icon" onClick={() => setIsAiSheetOpen(true)}>
          <Bot className="h-5 w-5" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <Settings className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Layout</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => setViewMode('list')}>
              <List className="mr-2 h-4 w-4" /> List View
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setViewMode('grid')}>
              <LayoutGrid className="mr-2 h-4 w-4" /> Grid View
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Date Filter</DropdownMenuLabel>
            <DropdownMenuCheckboxItem checked={dateRange === 'today'} onSelect={() => setDateRange('today')}>Today</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={dateRange === 'week'} onSelect={() => setDateRange('week')}>This Week</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={dateRange === 'month'} onSelect={() => setDateRange('month')}>This Month</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={dateRange === 'all'} onSelect={() => setDateRange('all')}>All Time</DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Options</DropdownMenuLabel>
            <DropdownMenuCheckboxItem checked={showArchived} onSelect={() => setShowArchived(!showArchived)}>
              Show Archived (Closed Deals)
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>AI Settings</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => setIsManageFilesModalOpen(true)}>
              <FileUp className="mr-2 h-4 w-4" /> Manage AI Files
            </DropdownMenuItem>
            <DropdownMenuCheckboxItem checked={showNewsItems} onSelect={() => setShowNewsItems(!showNewsItems)}>
              Enable AI News Feed
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Data</DropdownMenuLabel>
            <DropdownMenuItem onSelect={handleSaveReport}>
              <Download className="mr-2 h-4 w-4" />
              Get Daily Report (CSV)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setSalesperson(null)}>
              <Users className="mr-2 h-4 w-4" />
              Switch Salesperson
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button onClick={() => handleAddVisitClick(false)} className="hidden md:flex">
          <PlusCircle className="mr-2 h-4 w-4" />
          Log Visit
        </Button>
        <Button onClick={() => handleAddVisitClick(true)} className="hidden md:flex" variant="outline">
          <Calendar className="mr-2 h-4 w-4" />
          Plan Visit
        </Button>
      </div>
    </header>
  );

  const StatCard = ({ title, value, icon, description }: { title: string; value: string; icon: React.ReactNode, description: string }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );

  const DashboardMetrics = () => {
    const today = new Date();
    const startOfThisWeek = startOfDay(subDays(today, today.getDay()));
    const startOfThisMonth = startOfDay(new Date(today.getFullYear(), today.getMonth(), 1));

    const todaysVisits = allVisits.filter(v => isToday(v.timestamp)).length;
    const weeklyVisits = allVisits.filter(v => new Date(v.timestamp) >= startOfThisWeek).length;
    const monthlyVisits = allVisits.filter(v => new Date(v.timestamp) >= startOfThisMonth).length;
    const dealsClosedThisMonth = allVisits.filter(v => v.dealClosed && v.dealClosedDate && new Date(v.dealClosedDate) >= startOfThisMonth).length;

    const chartData = useMemo(() => {
      const data: { name: string; visits: number, deals: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const day = subDays(new Date(), i);
        const dayStr = format(day, 'MMM d');
        const visitsOnDay = allVisits.filter(v => format(new Date(v.timestamp), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')).length;
        const dealsOnDay = allVisits.filter(v => v.dealClosed && v.dealClosedDate && format(new Date(v.dealClosedDate), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')).length;
        data.push({ name: dayStr, visits: visitsOnDay, deals: dealsOnDay });
      }
      return data;
    }, [allVisits]);

    const CallDayVisitList = ({ title, visits, emptyText }: { title: string, visits: Visit[], emptyText: string }) => {
      if (visits.length === 0) {
        return (
          <div className="text-center text-sm text-muted-foreground p-4 border rounded-lg">
            {emptyText}
          </div>
        );
      }
    
      return (
        <div className="space-y-2">
          <h3 className="font-semibold">{title}</h3>
          <ul className="space-y-2">
            {visits.map(visit => (
              <li key={visit.id} onClick={() => { setZoomedVisit(visit); setViewMode('list'); }} className="flex items-center justify-between p-2 rounded-md bg-secondary hover:bg-muted cursor-pointer">
                <div className="flex-1 overflow-hidden">
                  <p className="font-medium truncate">{visit.companyName}</p>
                  <p className="text-xs text-muted-foreground truncate">{visit.city}</p>
                </div>
                {visit.dealClosed ? <Badge variant="default" className="bg-green-500">Closed</Badge> : visit.futureMeetingSet ? <Badge variant="outline" className="border-orange-500 text-orange-500">Meeting</Badge> : null}
              </li>
            ))}
          </ul>
        </div>
      );
    }
    
    const todaysVisitsList = allVisits.filter(v => isToday(v.timestamp));
    const upcomingMeetings = allVisits.filter(v => v.futureMeetingDateTime && new Date(v.futureMeetingDateTime) >= new Date() && !v.dealClosed).sort((a,b) => (a.futureMeetingDateTime && b.futureMeetingDateTime) ? new Date(a.futureMeetingDateTime).getTime() - new Date(b.futureMeetingDateTime).getTime() : 0);

    return (
      <div className="p-4 md:p-6 space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Today's Visits" value={todaysVisits.toString()} icon={<Calendar className="h-4 w-4 text-muted-foreground" />} description="Visits logged today" />
          <StatCard title="Weekly Visits" value={weeklyVisits.toString()} icon={<Briefcase className="h-4 w-4 text-muted-foreground" />} description="Total visits this week" />
          <StatCard title="Monthly Visits" value={monthlyVisits.toString()} icon={<BarChart className="h-4 w-4 text-muted-foreground" />} description="Total visits this month" />
          <StatCard title="Deals This Month" value={dealsClosedThisMonth.toString()} icon={<DollarSign className="h-4 w-4 text-muted-foreground" />} description="Deals closed this month" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="lg:col-span-4">
            <CardHeader>
              <CardTitle>Last 7 Days Activity</CardTitle>
              <CardDescription>A look at your visits and closed deals over the past week.</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }} />
                  <Legend />
                  <Bar dataKey="visits" fill="hsl(var(--primary))" name="Visits" radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="deals" stroke="hsl(var(--accent))" strokeWidth={2} name="Deals Closed" />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Call Day Planner</CardTitle>
              <CardDescription>Your plan for today and upcoming meetings.</CardDescription>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-[300px] pr-3">
                    <div className="space-y-4">
                        <CallDayVisitList title="Today's Visits" visits={todaysVisitsList} emptyText="No visits logged yet for today." />
                        <CallDayVisitList title="Upcoming Meetings" visits={upcomingMeetings} emptyText="No upcoming meetings scheduled." />
                    </div>
                </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };
  
    const HotLeadsSection = () => (
    <Card className="col-span-1 md:col-span-2 lg:col-span-3 xl:col-span-4">
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle>Hot Leads</CardTitle>
                <CardDescription>Companies found in your territory. Add them as visits.</CardDescription>
            </div>
            <div className="flex gap-2">
                <ExportHotLeadsPdfButton hotLeads={hotLeads} size="sm" />
                <ExportHotLeadsCsvButton hotLeads={hotLeads} size="sm" />
                <Button size="sm" variant="outline" onClick={() => setIsFindCompanyModalOpen(true)}>
                    <Search className="mr-2 h-4 w-4"/> Find New
                </Button>
            </div>
        </CardHeader>
        <CardContent>
            {hotLeads.length > 0 ? (
                <ScrollArea className="h-72">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 pr-4">
                    {hotLeads.map(lead => (
                        <div key={lead.id} className="p-3 border rounded-lg bg-secondary/30 flex items-start gap-3">
                            <div className="flex-1">
                                <p className="font-semibold">{lead.companyName}</p>
                                <p className="text-xs text-muted-foreground">{lead.address}</p>
                                {lead.phone && <p className="text-xs text-muted-foreground">{lead.phone}</p>}
                            </div>
                            <div className="flex flex-col gap-1">
                                <Button size="sm" className="h-7 px-2" onClick={() => handleAddFoundCompanyAsVisit(lead)}>
                                    <PlusCircle className="mr-1 h-3 w-3" /> Add
                                </Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveHotLead(lead.id)}>
                                    <Trash2 className="h-3 w-3 text-red-500" />
                                </Button>
                            </div>
                        </div>
                    ))}
                    </div>
                </ScrollArea>
            ) : (
                <div className="text-center py-10 border-2 border-dashed rounded-lg">
                    <p className="text-muted-foreground">No hot leads yet.</p>
                    <Button variant="link" onClick={() => setIsFindCompanyModalOpen(true)}>Find a company to get started</Button>
                </div>
            )}
        </CardContent>
    </Card>
    );

  const mainContentClass = "transition-all duration-300 ease-in-out";

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div>;
  }

  const CallDayVisitList = ({ title, visits, emptyText }: { title: string, visits: Visit[], emptyText: string }) => {
    if (visits.length === 0) {
      return (
        <div className="text-center text-sm text-muted-foreground p-4 border rounded-lg">
          {emptyText}
        </div>
      );
    }
  
    return (
      <div className="space-y-2">
        <h3 className="font-semibold">{title}</h3>
        <ul className="space-y-2">
          {visits.map(visit => (
            <li key={visit.id} onClick={() => { setZoomedVisit(visit); setViewMode('list'); }} className="flex items-center justify-between p-2 rounded-md bg-secondary hover:bg-muted cursor-pointer">
              <div className="flex-1 overflow-hidden">
                <p className="font-medium truncate">{visit.companyName}</p>
                <p className="text-xs text-muted-foreground truncate">{visit.city}</p>
              </div>
              {visit.dealClosed ? <Badge variant="default" className="bg-green-500">Closed</Badge> : visit.futureMeetingSet ? <Badge variant="outline" className="border-orange-500 text-orange-500">Meeting</Badge> : null}
            </li>
          ))}
        </ul>
      </div>
    );
  };
  
  return (
    <div className="min-h-screen">
      <TerritoryUploadModal 
        isOpen={showTerritoryUploadModal}
        onClose={() => setShowTerritoryUploadModal(false)}
      />
      
      <FindCompanyModal
        isOpen={isFindCompanyModalOpen}
        onClose={() => setIsFindCompanyModalOpen(false)}
        onAddAsVisit={handleAddFoundCompanyAsVisit}
        onAddHotLeads={handleAddHotLeads}
        destinationCities={[]}
      />

      {isFormOpen && (
        <VisitForm
          isOpen={isFormOpen}
          onClose={() => {
            setIsFormOpen(false);
            setEditingVisit(undefined);
            setStartDictationOnOpen(false);
          }}
          onSave={handleSaveVisit}
          initialData={editingVisit}
          salesperson={salesperson}
          startDictationOnOpen={startDictationOnOpen}
          isFutureVisit={isFutureVisit}
        />
      )}
      
      <ManageFilesModal
        isOpen={isManageFilesModalOpen}
        onClose={() => setIsManageFilesModalOpen(false)}
        managedFiles={managedFiles}
        onFilesChange={setManagedFiles}
      />

      <Sheet open={isAiSheetOpen} onOpenChange={setIsAiSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg flex flex-col p-0">
          <SheetHeader className="p-4 border-b">
            <SheetTitle className="flex items-center gap-2"><Bot className="h-6 w-6"/> Optimum Trailblazer AI</SheetTitle>
            <SheetDescription>Your AI-powered sales assistant.</SheetDescription>
            <div className="flex items-center gap-2 !mt-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    <span>Model: {activeModel.split('/')[1]}</span>
                    <Lightbulb className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)]">
                  <DropdownMenuLabel>Select an AI Model</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem checked={activeModel === 'googleai/gemini-1.5-flash-latest'} onSelect={() => setActiveModel('googleai/gemini-1.5-flash-latest')}>
                    Gemini 1.5 Flash
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={activeModel === 'googleai/gemini-1.5-pro-latest'} onSelect={() => setActiveModel('googleai/gemini-1.5-pro-latest')}>
                    Gemini 1.5 Pro
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </SheetHeader>
          <ScrollArea className="flex-1" ref={chatScrollRef}>
            <div className="p-4 space-y-4">
              {chatMessages.map(msg => (
                <div key={msg.id} className={`flex items-start gap-3 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
                  {msg.sender === 'ai' && <UserCircle className="h-8 w-8 text-primary" />}
                  <div className={`max-w-sm rounded-lg p-3 text-sm ${msg.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    <div className="prose prose-sm dark:prose-invert" dangerouslySetInnerHTML={{ __html: msg.text.replace(/\n/g, '<br />') }}></div>
                  </div>
                </div>
              ))}
              {isAiResponding && (
                <div className="flex items-start gap-3">
                  <UserCircle className="h-8 w-8 text-primary" />
                  <div className="max-w-sm rounded-lg p-3 text-sm bg-muted flex items-center">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          <div className="p-4 border-t bg-background">
            <form onSubmit={handleChatSubmit} className="flex items-center gap-2">
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask Debbie anything..."
                disabled={isAiResponding}
              />
              <Button type="submit" disabled={!chatInput.trim() || isAiResponding}>
                Send
              </Button>
            </form>
          </div>
        </SheetContent>
      </Sheet>

      <PageHeader />

      <main className="p-4 md:p-6 lg:p-8">
        <div className="space-y-6">
          <Suspense fallback={<div className="h-96 w-full bg-muted rounded-lg flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin"/></div>}>
             {firebaseConfigured ? (
               <GoogleMapComponent visits={visits} userLatitude={userLatitude} userLongitude={userLongitude} onUpdateVisit={handleUpdateVisitFromMap} onIntelRequest={handleIntelRequest} onZoomRequest={handleZoomRequest} />
             ) : (
               <MapPlaceholder visits={visits} />
             )}
          </Suspense>

          <DashboardMetrics />

          {zoomedVisit ? (
            <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center animate-in fade-in-0" onClick={() => setZoomedVisit(null)}>
              <div className="w-full max-w-2xl mx-auto" onClick={(e) => e.stopPropagation()}>
                <VisitCard
                  visit={zoomedVisit}
                  onEdit={handleEditVisit}
                  onDelete={handleDeleteVisit}
                  onUpdateDealClosed={handleUpdateDealClosed}
                  onZoom={setZoomedVisit}
                  isZoomedView={true}
                />
              </div>
            </div>
          ) : (
             <>
               <HotLeadsSection />
               <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                {visits.map(visit => (
                  <VisitCard
                    key={visit.id}
                    visit={visit}
                    onEdit={handleEditVisit}
                    onDelete={handleDeleteVisit}
                    onUpdateDealClosed={handleUpdateDealClosed}
                    onZoom={setZoomedVisit}
                    onLogFollowUp={handleLogFollowUp}
                    onDictateNotes={handleDictateNotes}
                    variant={
                      isFutureVisit && editingVisit?.companyName === visit.companyName
                        ? 'planner'
                        : undefined
                    }
                  />
                ))}
              </div>
            </>
          )}

          {visits.length === 0 && (
            <div className="text-center py-20 border-2 border-dashed rounded-lg">
              <h2 className="text-2xl font-semibold text-foreground">No Visits Found</h2>
              <p className="text-muted-foreground mt-2">Log a new visit to get started.</p>
              <div className="mt-6 flex justify-center gap-4">
                <Button onClick={() => handleAddVisitClick(false)} size="lg">
                  <PlusCircle className="mr-2" /> Log First Visit
                </Button>
                <Button onClick={() => setIsFindCompanyModalOpen(true)} size="lg" variant="outline">
                   <Search className="mr-2"/> Find a Company
                </Button>
              </div>
            </div>
          )}

          <div className="md:hidden fixed bottom-4 right-4 z-40 flex flex-col gap-3">
             <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" className="rounded-full w-14 h-14 shadow-lg">
                    <PlusCircle className="h-6 w-6" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="end" className="w-56 mb-2">
                <DropdownMenuItem onSelect={() => handleAddVisitClick(false)}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Log New Visit
                </DropdownMenuItem>
                 <DropdownMenuItem onSelect={() => handleAddVisitClick(true)}>
                  <Calendar className="mr-2 h-4 w-4" /> Plan Future Visit
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setIsFindCompanyModalOpen(true)}>
                  <Search className="mr-2 h-4 w-4" /> Find Company
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </main>
    </div>
  );
}
