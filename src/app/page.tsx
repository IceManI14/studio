
'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { Visit, ChatMessage, Salesperson, Territory, ManagedFile, ContactInfo, HotLead, FoundPlace } from '@/lib/types';
import { Button } from '@/components/ui/button';
import VisitForm from '@/components/visit-form';
import VisitCard from '@/components/visit-card';
import ExportButton from '@/components/export-button';
import ExportPdfButton from '@/components/export-pdf-button';
import GoogleMapComponent from '@/components/google-map';
import { PlusCircle, ListChecks, User, InfoIcon, Sunset, Send, PartyPopper, MessagesSquare, Hash, Mail, ListFilter, Bot, MapPin, Brain, Loader2, Paperclip, XCircle, Swords, UserCog, AlertTriangle, WifiOff, Search, FolderKanban, Map, RefreshCw, UploadCloud, Mic, Compass, Flame, Building, Trash2, Phone } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
import { format, subDays, isSameDay, isToday } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card as UiCard, CardContent as UiCardContent, CardHeader as UiCardHeader, CardFooter as UiCardFooter, CardTitle as UiCardTitle, CardDescription as UiCardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getAiChatResponseAction, getCompanyNameFromCoordsAction, findOptimalParkingAction, extractCitiesFromPdfAction, findCompanyAction, saveDailyReportAction } from '@/app/actions';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import SalespersonSelectorModal from '@/components/salesperson-selector-modal';
import TerritoryUploadModal from '@/components/territory-upload-modal';
import FindCompanyModal from '@/components/find-company-modal';
import ManageFilesModal from '@/components/manage-files-modal';
import { fileToDataUri } from '@/lib/utils';
import { Calendar } from "@/components/ui/calendar";
import type { SaveVisitPayload } from '@/app/actions';
import { firebaseConfigured } from '@/lib/firebase';
import { useToast } from "@/hooks/use-toast";
import ExportHotLeadsCsvButton from '@/components/export-hot-leads-csv-button';
import ExportHotLeadsPdfButton from '@/components/export-hot-leads-pdf-button';


interface SubmittedSuggestion {
  text: string;
  timestamp: Date;
}

const AVAILABLE_AI_MODELS = [
    { id: 'googleai/gemini-1.5-flash-latest', name: 'Gemini 1.5 Flash' },
    { id: 'googleai/gemini-1.5-pro-latest', name: 'Gemini 1.5 Pro' },
    { id: 'googleai/gemini-1.0-pro', name: 'Gemini 1.0 Pro' },
];

const salespeople: Salesperson[] = [
    { 
        id: '1', 
        name: 'Paul L.', 
        territory: [
            { name: 'NH/ME Seacoast', bounds: { minLat: 42.85, maxLat: 43.40, minLng: -71.00, maxLng: -70.50 }, cities: ['Portsmouth, NH', 'Hampton, NH', 'Rye, NH', 'Kittery, ME', 'York, ME'] },
            { name: 'Southern NH (Rockingham)', bounds: { minLat: 42.85, maxLat: 43.15, minLng: -71.40, maxLng: -71.00 }, cities: ['Salem, NH', 'Derry, NH', 'Londonderry, NH', 'Windham, NH', 'Plaistow, NH'] },
            { name: 'NH Lakes Region', bounds: { minLat: 43.40, maxLat: 43.70, minLng: -71.70, maxLng: -71.35 }, cities: ['Laconia, NH', 'Gilford, NH', 'Meredith, NH', 'Wolfeboro, NH', 'Center Harbor, NH'] }
        ] 
    },
    { 
        id: '2', 
        name: 'Chris C.', 
        territory: [
            { name: 'Providence, Warwick, Cranston', bounds: { minLat: 41.65, maxLat: 41.88, minLng: -71.55, maxLng: -71.35 }, cities: ['Providence, RI', 'Warwick, RI', 'Cranston, RI', 'Johnston, RI'] }
        ] 
    },
    { 
        id: '3', 
        name: 'James D.', 
        territory: [
            { name: 'Worcester & Springfield Area', bounds: { minLat: 42.05, maxLat: 42.35, minLng: -72.65, maxLng: -71.70 }, cities: ['Worcester, MA', 'Springfield, MA', 'Holyoke, MA', 'Chicopee, MA', 'Westfield, MA'] }
        ] 
    },
    { id: '4', name: 'Corporate', territory: [{ name: 'All Territories', bounds: { minLat: -90, maxLat: 90, minLng: -180, maxLng: 180 } }] },
    { id: '5', name: 'John Doe (No Territory)', territory: [] },
];

export default function HomePage() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [hotLeads, setHotLeads] = useState<HotLead[]>([]);
  const [isVisitFormOpen, setIsVisitFormOpen] = useState(false);
  const [currentEditingVisit, setCurrentEditingVisit] = useState<Visit | undefined>(undefined);
  const [userCurrentLatitude, setUserCurrentLatitude] = useState<number | undefined>();
  const [userCurrentLongitude, setUserCurrentLongitude] = useState<number | undefined>();
  const [isEndDayConfirmOpen, setIsEndDayConfirmOpen] = useState(false);
  const [suggestionText, setSuggestionText] = useState('');
  const [submittedSuggestions, setSubmittedSuggestions] = useState<SubmittedSuggestion[]>([]);
  const [sortCriteria, setSortCriteria] = useState<'partnershipConfidence' | 'timestamp' | 'dealClosed'>('partnershipConfidence');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [zoomedVisit, setZoomedVisit] = useState<Visit | null>(null);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { 
        id: 'ai_welcome_init', 
        sender: 'ai', 
        text: `Welcome! I am your Optimum Trailblazer AI Assistant. How can I help you plan your day or analyze visit data?`, 
        timestamp: new Date()
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const [isAiResponding, setIsAiResponding] = useState(false);
  const [selectedAiModel, setSelectedAiModel] = useState<string>(AVAILABLE_AI_MODELS[0].id);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isRecordingChat, setIsRecordingChat] = useState(false);
  const chatRecognitionRef = useRef<SpeechRecognition | null>(null);

  const callDayCardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const isAutoScrollingRef = useRef(false);

  const [selectedSalesperson, setSelectedSalesperson] = useState<Salesperson | null>(null);
  const [isDestinationModalOpen, setIsDestinationModalOpen] = useState(false);
  const [targetDestination, setTargetDestination] = useState<{city: string; description: string} | null>(null);
  const [navigationUrl, setNavigationUrl] = useState<string | null>(null);
  const [currentCity, setCurrentCity] = useState<string | null>(null);
  const [isFetchingCity, setIsFetchingCity] = useState(false);
  const [isFindingParking, setIsFindingParking] = useState(false);
  const [showTerritoryUploadModal, setShowTerritoryUploadModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [destinationCities, setDestinationCities] = useState<string[]>([]);
  const [isExtractingCities, setIsExtractingCities] = useState(false);
  const [isFindCompanyModalOpen, setIsFindCompanyModalOpen] = useState(false);
  const [managedFiles, setManagedFiles] = useState<ManagedFile[]>([]);
  const [isManageFilesModalOpen, setIsManageFilesModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('field-day');
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();
  const [startDictationOnOpen, setStartDictationOnOpen] = useState(false);


  const isGenkitConfigured = process.env.NEXT_PUBLIC_GENKIT_CONFIGURED === 'true';

  const handleChangeDestination = async (salespersonToUse?: Salesperson) => {
    setNavigationUrl(null);
    const activeSalesperson = salespersonToUse || selectedSalesperson;
    if (!activeSalesperson) return;

    const territoryPdfUrl = localStorage.getItem('userTerritoryPdfUrl');
    let cities: string[] = [];
    
    setIsDestinationModalOpen(true);
    
    if (territoryPdfUrl && activeSalesperson.name !== 'Corporate') {
      setIsExtractingCities(true);
      try {
        const result = await extractCitiesFromPdfAction({ pdfDataUri: territoryPdfUrl });
        if (result.error) throw new Error(result.error);
        
        if (result.cities && result.cities.length > 0) {
          cities = result.cities;
        } else {
          toast({ variant: "destructive", title: "No Cities Found", description: "The AI could not find any cities in the provided document. Falling back to the default list from your profile." });
          cities = activeSalesperson.territory.flatMap(t => t.cities || []);
        }
      } catch (e: any) {
        toast({ variant: "destructive", title: "Could Not Read PDF", description: `Could not read cities from PDF: ${e.message}. Using default list.` });
        cities = activeSalesperson.territory.flatMap(t => t.cities || []);
      } finally {
        setIsExtractingCities(false);
      }
    } else if (activeSalesperson.territory.length > 0 && activeSalesperson.name !== 'Corporate') {
      cities = activeSalesperson.territory.flatMap(t => t.cities || []);
    }
    
    setDestinationCities(cities);
  };

  const handleSelectSalesperson = async (salesperson: Salesperson) => {
    setSelectedSalesperson(salesperson);
    setTargetDestination(null);
    setNavigationUrl(null);
    setDestinationCities([]);

    const hasTerritoryPdf = !!localStorage.getItem('userTerritoryPdfUrl');
    const hasDefaultTerritory = salesperson.territory.length > 0 && salesperson.name !== 'Corporate';

    if (hasTerritoryPdf || hasDefaultTerritory) {
      handleChangeDestination(salesperson);
    } else if (salesperson.territory.length === 0 && salesperson.name !== 'Corporate') {
      toast({ variant: "destructive", title: `Welcome, ${salesperson.name}!`, description: "You have no territories assigned. Please contact your manager to have them set up." });
    } else {
       toast({ title: `Welcome, ${salesperson.name}!`, description: `Your territory for today: ${salesperson.territory.map(t => t.name).join(', ')}` });
    }
  };


  useEffect(() => {
    // Load all data from localStorage on initial render
    try {
      const localVisits = localStorage.getItem('visits');
      if (localVisits) {
          const parsedVisits = JSON.parse(localVisits).map((v: any) => ({
              ...v,
              timestamp: new Date(v.timestamp),
              futureMeetingDateTime: v.futureMeetingDateTime ? new Date(v.futureMeetingDateTime) : undefined,
          }));
          setVisits(parsedVisits);
      }
      
      const storedSuggestions = localStorage.getItem('submittedSuggestions');
      if (storedSuggestions) {
        const parsedSuggestions: SubmittedSuggestion[] = JSON.parse(storedSuggestions).map((s: any) => ({
          ...s,
          timestamp: new Date(s.timestamp)
        }));
        setSubmittedSuggestions(parsedSuggestions);
      }

      const storedFiles = localStorage.getItem('managedFiles');
      if (storedFiles) {
          setManagedFiles(JSON.parse(storedFiles));
      }

      const storedHotLeads = localStorage.getItem('hotLeads');
      if (storedHotLeads) {
        const parsedHotLeads: HotLead[] = JSON.parse(storedHotLeads).map((hl: any) => ({
          ...hl,
          addedAt: new Date(hl.addedAt)
        }));
        setHotLeads(parsedHotLeads);
      }
    } catch (error) {
      console.error("Failed to load data from localStorage:", error);
      toast({ variant: "destructive", title: "Local Data Corrupted", description: "Could not load saved data from this device."});
    }

    // Get Geolocation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          setUserCurrentLatitude(lat);
          setUserCurrentLongitude(lon);
          
          setIsFetchingCity(true);
          try {
            const result = await getCompanyNameFromCoordsAction({ latitude: lat, longitude: lon });
            if (result.error) {
              toast({ variant: "destructive", title: "Location Lookup Failed", description: result.error });
              setCurrentCity("Location lookup failed");
            } else if (result.city) {
              setCurrentCity(result.city);
            } else {
              setCurrentCity("Location Unknown");
            }
          } catch (e: any) {
            console.error("Error fetching city:", e);
            setCurrentCity("Error fetching city.");
          } finally {
            setIsFetchingCity(false);
          }
        },
        (error) => {
          let errorMessage = "Could not retrieve location.";
          if (error.code === error.PERMISSION_DENIED) {
            errorMessage = "Location access denied. Please enable it in your browser settings.";
          }
          toast({ variant: "destructive", title: "Location Error", description: errorMessage });
          setCurrentCity("Location access denied.");
        }
      );
    } else {
      toast({ variant: "destructive", title: "Geolocation Not Supported", description: "Your browser does not support geolocation." });
      setCurrentCity("Geolocation not supported.");
    }
  }, [toast]);

  // Save suggestions whenever they change
  useEffect(() => {
    localStorage.setItem('submittedSuggestions', JSON.stringify(submittedSuggestions));
  }, [submittedSuggestions]);

  // Save hot leads whenever they change
  useEffect(() => {
    localStorage.setItem('hotLeads', JSON.stringify(hotLeads));
  }, [hotLeads]);

  useEffect(() => {
    if (selectedSalesperson) { 
        const hasUploaded = localStorage.getItem('territoryPdfUploaded');
        if (!hasUploaded) {
            setShowTerritoryUploadModal(true);
        }
    }
  }, [selectedSalesperson]);

  const sortedVisitsForCallDay = useMemo(() => {
    if (visits.length === 0) {
      return [];
    }

    const filteredVisits = selectedDate
      ? visits.filter(visit => isSameDay(new Date(visit.timestamp), selectedDate))
      : visits;

    const sorted = [...filteredVisits].sort((a, b) => {
      const confidenceA = a.partnershipConfidence ?? 0;
      const confidenceB = b.partnershipConfidence ?? 0;
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      const dealClosedA = a.dealClosed ? 1 : 0;
      const dealClosedB = b.dealClosed ? 1 : 0;

      let comparison = 0;

      if (sortCriteria === 'dealClosed') {
        comparison = sortOrder === 'desc' ? dealClosedB - dealClosedA : dealClosedA - dealClosedB;
        if (comparison !== 0) return comparison;
        return confidenceB - confidenceA;
      } else if (sortCriteria === 'partnershipConfidence') {
        comparison = sortOrder === 'desc' ? confidenceB - confidenceA : confidenceA - confidenceB;
        if (comparison !== 0) return comparison;
        return timeB - timeA; 
      } else { 
        comparison = sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
        if (comparison !== 0) return comparison;
        return confidenceB - confidenceA;
      }
    });
    return sorted;
  }, [visits, sortCriteria, sortOrder, selectedDate]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  useEffect(() => {
    callDayCardRefs.current = Array(sortedVisitsForCallDay.length).fill(null);
  }, [sortedVisitsForCallDay.length]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isVisitFormOpen) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isVisitFormOpen]);

  useEffect(() => {
    // This effect handles the Android back button behavior to prevent exiting the app.
    // It creates a hierarchical back navigation: Modals -> Tabs -> Home Screen.

    const handlePopState = (event: PopStateEvent) => {
      // Re-push a state to the history stack to "capture" the next back press.
      // This prevents the app from closing.
      history.pushState(null, '', location.href);

      // Priority 1: Close any open modals or dialogs.
      if (isVisitFormOpen) {
        setIsVisitFormOpen(false);
        setCurrentEditingVisit(undefined);
        return;
      }
      if (zoomedVisit) {
        setZoomedVisit(null);
        return;
      }
      if (isDestinationModalOpen) {
        setIsDestinationModalOpen(false);
        return;
      }
      if (isFindCompanyModalOpen) {
        setIsFindCompanyModalOpen(false);
        return;
      }
      if (isManageFilesModalOpen) {
        setIsManageFilesModalOpen(false);
        return;
      }
      if (isEndDayConfirmOpen) {
        setIsEndDayConfirmOpen(false);
        return;
      }

      // Priority 2: If no modals are open, reset to the main tab.
      if (activeTab !== 'field-day') {
        setActiveTab('field-day');
        return;
      }

      // If already on the main screen, the pushState call has already prevented exit.
    };

    // On component mount, we push a state. This is the initial "trap" for the back button.
    // Without this, the first back press would exit if there's no history.
    history.pushState(null, '', location.href);
    
    window.addEventListener('popstate', handlePopState);

    // Clean up the event listener when the component unmounts.
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [
    activeTab,
    isVisitFormOpen,
    zoomedVisit,
    isDestinationModalOpen,
    isFindCompanyModalOpen,
    isManageFilesModalOpen,
    isEndDayConfirmOpen,
  ]);


  const handleQuickLog = async () => {
    if (!userCurrentLatitude || !userCurrentLongitude) {
      toast({
        variant: "destructive",
        title: "Could Not Get Location",
        description: "Current user location is not available. Please enable location services.",
      });
      return;
    }
    
    setIsFetchingCity(true);
    let companyName, notes, phone;
    try {
        const result = await getCompanyNameFromCoordsAction({ latitude: userCurrentLatitude, longitude: userCurrentLongitude });
        if (result.error) {
            toast({ variant: "destructive", title: "Location Lookup Failed", description: result.error });
        } else {
            companyName = result.suggestedCompanyName;
            notes = result.address ? `Company Address: ${result.address}` : '';
            phone = result.phone;
        }
    } catch (e: any) {
        console.error("Error fetching company name for quicklog:", e);
        toast({ variant: "destructive", title: "Location Lookup Error", description: e.message });
    } finally {
        setIsFetchingCity(false);
    }
    
    const todaysVisits = visits.filter(v => isToday(new Date(v.timestamp))).length;

    const newVisitTemplate: Partial<Visit> = {
      latitude: userCurrentLatitude,
      longitude: userCurrentLongitude,
      timestamp: new Date(),
      visitNumber: todaysVisits + 1,
      companyName: companyName || '',
      notes: notes || '',
      decisionMakerContact: phone || '',
    };

    setCurrentEditingVisit(newVisitTemplate as Visit);
    setIsVisitFormOpen(true);
  };


  const handleEditVisit = (visit: Visit) => {
    setCurrentEditingVisit(visit);
    setIsVisitFormOpen(true);
  };

  const handleUpdateDealClosed = async (visitId: string, dealClosed: boolean) => {
    const updatedVisits = visits.map(v => v.id === visitId ? { ...v, dealClosed } : v);
    setVisits(updatedVisits);
    localStorage.setItem('visits', JSON.stringify(updatedVisits));
    toast({ title: 'Deal Status Updated Locally' });
  };

  const handleLogFollowUp = (existingVisit: Visit) => {
    toast({ title: `Logging Follow-up for ${existingVisit.companyName}.` });
    const todaysVisits = visits.filter(v => isToday(new Date(v.timestamp))).length;
  
    const newVisitTemplate: Partial<Visit> = {
      companyName: existingVisit.companyName,
      latitude: existingVisit.latitude,
      longitude: existingVisit.longitude,
      contactInfo: existingVisit.contactInfo, 
      notes: `Follow-up to visit on ${formatInTimeZone(new Date(existingVisit.timestamp), 'America/New_York', 'PP')}.`,
      decisionMakerName: existingVisit.decisionMakerName,
      decisionMakerTitle: existingVisit.decisionMakerTitle,
      decisionMakerContact: existingVisit.decisionMakerContact,
      visitNumber: todaysVisits + 1,
    };
    
    setCurrentEditingVisit(newVisitTemplate as Visit);
    setIsVisitFormOpen(true);
  };

  const handleSaveFromForm = async (payload: SaveVisitPayload, options: { andClose?: boolean } = {}) => {
    const { andClose = true } = options;
    if (andClose) {
      setIsVisitFormOpen(false);
    }
    
    const isNewVisit = !payload.id || payload.id.startsWith('temp_');
    const tempId = isNewVisit ? `temp_${crypto.randomUUID()}` : payload.id;
    
    let notesSummaryToSave = payload.notesSummary;
    if (currentEditingVisit?.notes !== payload.notes) {
      notesSummaryToSave = undefined; // Clear old summary if notes changed
    }

    const optimisticVisit: Visit = {
        id: tempId!,
        timestamp: payload.timestamp || new Date(),
        companyName: payload.companyName,
        notes: payload.notes ?? undefined,
        latitude: payload.latitude ?? undefined,
        longitude: payload.longitude ?? undefined,
        partnershipConfidence: payload.partnershipConfidence ?? undefined,
        hasBusinessCard: payload.hasBusinessCard ?? false,
        businessCardImageUrl: payload.businessCardImageUrl ?? undefined,
        discussedCompetitors: !!payload.competitorName,
        competitorName: payload.competitorName ?? undefined,
        coolerType: payload.coolerType ?? undefined,
        decisionMakerName: payload.decisionMakerName ?? '',
        decisionMakerTitle: payload.decisionMakerTitle ?? '',
        decisionMakerContact: payload.decisionMakerContact ?? '',
        visitNumber: payload.visitNumber ?? visits.filter(v => isToday(new Date(v.timestamp))).length + 1,
        interestedUnit: payload.interestedUnit ?? undefined,
        hasTDSReading: payload.hasTDSReading ?? false,
        tdsValue: payload.tdsValue ?? undefined,
        futureMeetingSet: payload.futureMeetingSet ?? false,
        futureMeetingDateTime: payload.futureMeetingDateTime ? new Date(payload.futureMeetingDateTime) : undefined,
        freeTrial: payload.freeTrial ?? false,
        dealClosed: payload.dealClosed ?? false,
        contactInfo: payload.contactInfo ?? undefined,
        notesSummary: notesSummaryToSave,
    };
    
    const updatedVisits = isNewVisit
      ? [optimisticVisit, ...visits]
      : visits.map(v => v.id === payload.id ? optimisticVisit : v);
    
    setVisits(updatedVisits);
    localStorage.setItem('visits', JSON.stringify(updatedVisits));

    toast({
      title: isNewVisit ? "Visit Logged Locally" : (andClose ? "Visit Updated Locally" : "Notes Auto-Saved"),
      description: `Visit for ${payload.companyName} has been saved to your device.`,
    });
  };


  const handleDeleteVisit = async (visitId: string) => {
    const updatedVisits = visits.filter(v => v.id !== visitId);
    setVisits(updatedVisits);
    localStorage.setItem('visits', JSON.stringify(updatedVisits));

    toast({
      title: 'Visit Deleted Locally',
      description: 'The visit log has been removed from this device.',
    });
  };

  const confirmEndDay = async () => {
    const todaysVisits = visits.filter(v => isToday(new Date(v.timestamp)));
    const numberOfVisits = todaysVisits.length;

    if (numberOfVisits === 0) {
        toast({ title: "No visits to create a report for today." });
        setIsEndDayConfirmOpen(false);
        return;
    }

    if (!firebaseConfigured) {
        toast({ variant: "destructive", title: "Cloud Storage Not Configured", description: "Cannot save report. Please check your app's configuration." });
        setIsEndDayConfirmOpen(false);
        return;
    }

    setIsSyncing(true);
    toast({ title: "Generating Daily Report...", description: `Processing ${numberOfVisits} visit(s) and uploading to cloud storage.` });

    try {
      const result = await saveDailyReportAction(todaysVisits);

      if (result.error) {
        throw new Error(result.error);
      }

      toast({
        title: "Daily Report Saved!",
        description: `Your daily visit report has been successfully saved to the cloud storage bucket.`,
        duration: 10000,
      });
      localStorage.removeItem('milestoneAchievedDate');
    } catch (e: any) {
      toast({
          variant: "destructive",
          title: "Report Save Failed",
          description: e.message || "An unexpected error occurred. Your visit data is still safe on this device.",
          duration: 10000,
      });
    } finally {
      setIsSyncing(false);
      setIsEndDayConfirmOpen(false);
    }
  };

  const handleSubmitSuggestion = async () => {
    if (suggestionText.trim() === '') {
      toast({ variant: "destructive", title: 'Empty Suggestion', description: 'Please type your suggestion before submitting.' });
      return;
    }

    const newSuggestionObject: SubmittedSuggestion = {
      text: suggestionText.trim(),
      timestamp: new Date(),
    };
    
    setSubmittedSuggestions(prev => [...prev, newSuggestionObject]);
    toast({ title: 'Suggestion Submitted!', description: 'Thank you for your feedback.' });
    setSuggestionText('');
  };

  const handleEmailSuggestions = () => {
    if (submittedSuggestions.length === 0) {
      toast({ title: 'No Suggestions to Email', description: 'There are no submitted suggestions to send.' });
      return;
    }

    const subject = `App Improvement Suggestion`;
    let body = `Suggestions for the Optimum Trailblazer App:\n\n`;
    submittedSuggestions.forEach((suggestion, index) => {
      body += `${index + 1}. Suggestion: ${suggestion.text}\n`;
      body += `   Date: ${format(suggestion.timestamp, 'MMM d, yyyy, h:mm a')}\n\n`;
    });
    body += `\n\n---\nEmail generated by Optimum Trailblazer App`;

    const mailtoLink = `mailto:paull@drinkoptimum.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    if (typeof window !== 'undefined') {
        window.location.href = mailtoLink;
    }
    toast({ title: "Opening email client...", description: "Please send the composed email with your suggestions." });
  };

  const handleEmailManager = () => {
    const chrisEmail = "chrisc@drinkoptimum.com";
    const subject = `Salesperson for the current day visits`;
    
    let body = `Hello Chris,\n\nPlease find the visit data for the current day.\n\n`;
    body += `The detailed visit data can be found in the PDF report, which can be downloaded using the 'Export PDF' button and then manually attached to this email.\n\n`;
    body += `A summary is also included below:\n\n`;
    
    if (visits.length > 0) {
      body += `Summary of Visits (${visits.length} total):\n`;
      visits.forEach((visit, index) => {
        body += `\n${index + 1}. ${visit.companyName}`;
        if (visit.notesSummary) body += `\n   Summary: ${visit.notesSummary}`;
        if (visit.contactInfo?.info && visit.contactInfo.info !== "No contact info found on web!") body += `\n   Contact: ${visit.contactInfo.info}`;
        if (visit.partnershipConfidence) body += `\n   Confidence: ${visit.partnershipConfidence}/5`;
        body += `\n   Visited: ${format(new Date(visit.timestamp), 'MMM d, h:mm a')}\n`;
      });
    } else {
      body += "No visits were logged today.\n";
    }
    body += `\n\nBest regards,\nOptimum Trailblazer App`;

    const mailtoLink = `mailto:${chrisEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    if (typeof window !== 'undefined') {
        window.location.href = mailtoLink;
    }
    toast({ title: "Opening email client...", description: "Please manually attach the exported PDF to the email before sending." });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const allowedTypes = ["application/pdf", "text/csv"];
      if (!allowedTypes.includes(file.type)) {
        toast({ variant: "destructive", title: "Invalid File Type", description: "Please select a PDF or CSV file." });
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({ variant: "destructive", title: "File Too Large", description: "Please select a file smaller than 5MB." });
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      setSelectedFile(file);
    } else {
      setSelectedFile(null);
    }
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSendChatMessage = async () => {
    if (chatInput.trim() === '' || isAiResponding) return;

    let messageText = chatInput.trim();
    let pdfUrlForAi: string | undefined = undefined;
    let csvDataForAi: string | undefined = undefined;
    
    setIsAiResponding(true); 

    if (selectedFile) {
      try {
        if (selectedFile.type === 'application/pdf') {
          pdfUrlForAi = await fileToDataUri(selectedFile);
        } else if (selectedFile.type === 'text/csv') {
          csvDataForAi = await selectedFile.text();
        }
        toast({ title: 'File Attached', description: `${selectedFile.name} attached and will be sent to AI.` });
        messageText += ` (Attached File: ${selectedFile.name})`;
      } catch (processingError: any) {
        toast({ variant: "destructive", title: 'File Processing Failed', description: processingError.message });
        setIsAiResponding(false);
        return;
      } finally {
        setSelectedFile(null); 
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    }

    const newUserMessage: ChatMessage = {
      id: crypto.randomUUID(),
      sender: 'user',
      text: messageText,
      timestamp: new Date(),
    };
    setChatMessages(prev => [...prev, newUserMessage]);
    setChatInput('');

    const oneWeekAgo = subDays(new Date(), 7);
    const recentVisits = visits.filter(visit => new Date(visit.timestamp) >= oneWeekAgo);
    
    const territoryPdfUrl = localStorage.getItem('userTerritoryPdfUrl') || undefined;

    try {
      const result = await getAiChatResponseAction({
        currentMessages: [...chatMessages, newUserMessage], 
        model: selectedAiModel,
        visits: recentVisits.map(v => ({
            id: v.id,
            timestamp: v.timestamp,
            companyName: v.companyName,
            notesSummary: v.notesSummary || undefined,
            partnershipConfidence: v.partnershipConfidence || undefined,
        })),
        pdfUrl: pdfUrlForAi,
        csvData: csvDataForAi,
        territoryPdfUrl: territoryPdfUrl,
        managedFiles: managedFiles,
      });

      if (result.error) {
        toast({ variant: "destructive", title: "AI Chat Error", description: `Error: ${result.error}` });
        const aiErrorResponse: ChatMessage = { id: crypto.randomUUID(), sender: 'ai', text: `Sorry, I encountered an error: ${result.error}`, timestamp: new Date() };
        setChatMessages(prev => [...prev, aiErrorResponse]);
      } else if (result.aiResponse) {
        const aiResponse: ChatMessage = { id: crypto.randomUUID(), sender: 'ai', text: result.aiResponse, timestamp: new Date() };
        setChatMessages(prev => [...prev, aiResponse]);
      }
    } catch (e: any) {
       toast({ variant: "destructive", title: "AI Chat Failed", description: "Could not get response from AI." });
       const aiFailureResponse: ChatMessage = { id: crypto.randomUUID(), sender: 'ai', text: "I'm having trouble connecting right now. Please try again later.", timestamp: new Date() };
        setChatMessages(prev => [...prev, aiFailureResponse]);
    } finally {
      setIsAiResponding(false);
    }
  };

  const handleToggleChatVoice = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({ variant: 'destructive', title: 'Voice Recognition Not Supported', description: 'Your browser does not support this feature. Extensions or browser settings might be the cause.' });
      return;
    }

    if (isRecordingChat && chatRecognitionRef.current) {
      chatRecognitionRef.current.stop();
      return;
    }

    const recognition = new SpeechRecognition();
    chatRecognitionRef.current = recognition;

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsRecordingChat(true);
      toast({ title: 'Listening...' });
    };

    recognition.onend = () => {
      setIsRecordingChat(false);
      chatRecognitionRef.current = null;
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      let errorMessage = `An unknown error occurred (code: ${event.error}).`;
       switch (event.error) {
        case 'no-speech':
          errorMessage = "No speech was detected. Please make sure your microphone is working and try again.";
          break;
        case 'not-allowed':
        case 'service-not-allowed':
          errorMessage = "Microphone access denied. Please check your browser's site permissions and ensure no other application is using the microphone.";
          break;
        case 'audio-capture':
          errorMessage = "Could not capture audio. Please check your microphone connection and system settings.";
          break;
        case 'network':
          errorMessage = "A network error occurred. Speech recognition may require an internet connection.";
          break;
        case 'aborted':
          console.log("Speech recognition aborted.");
          setIsRecordingChat(false);
          chatRecognitionRef.current = null;
          return;
        case 'language-not-supported':
          errorMessage = "The language for dictation is not supported by your browser.";
          break;
        case 'bad-grammar':
           errorMessage = "There was a grammar recognition error. This is usually an issue with the recognition service.";
           break;
      }
      
      toast({ variant: 'destructive', title: 'Voice Recognition Error', description: errorMessage, duration: 9000 });
      setIsRecordingChat(false);
      chatRecognitionRef.current = null;
    };

    recognition.onresult = (event) => {
      if (event.results && event.results.length > 0 && event.results[0].length > 0) {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setChatInput(transcript);
          toast({ title: 'Message Transcribed', description: "Press send to submit." });
        }
      } else {
        console.warn("Speech recognition returned a result with no transcript.");
      }
    };

    try {
      recognition.start();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Could not start recording', description: `Please ensure microphone access is granted. Error: ${e.message}` });
    }
  }, [isRecordingChat, toast]);

  const handleAddFoundCompanyAsVisit = (visitData: Partial<Visit>) => {
    const todaysVisits = visits.filter(v => isToday(new Date(v.timestamp))).length;
    const newVisit: Visit = {
        id: '', // Will be generated by server
        timestamp: new Date(),
        companyName: visitData.companyName || '',
        notes: visitData.notes,
        latitude: visitData.latitude,
        longitude: visitData.longitude,
        contactInfo: undefined,
        notesSummary: undefined,
        partnershipConfidence: undefined,
        hasBusinessCard: false,
        businessCardImageUrl: undefined,
        discussedCompetitors: false,
        competitorName: undefined,
        coolerType: undefined,
        decisionMakerName: '',
        decisionMakerTitle: '',
        decisionMakerContact: visitData.decisionMakerContact || '',
        visitNumber: todaysVisits + 1,
        interestedUnit: undefined,
        hasTDSReading: false,
        tdsValue: undefined,
        futureMeetingSet: false,
        futureMeetingDateTime: undefined,
        freeTrial: false,
        dealClosed: false,
    };
    setCurrentEditingVisit(newVisit);
    setIsVisitFormOpen(true);
  };

  const handleManagedFilesChange = (files: ManagedFile[]) => {
      setManagedFiles(files);
      localStorage.setItem('managedFiles', JSON.stringify(files));
  };

  const handleAddHotLeads = useCallback((places: FoundPlace[]) => {
    setHotLeads(prevHotLeads => {
        const newLeads: HotLead[] = places.map(place => ({
            id: crypto.randomUUID(),
            companyName: place.companyName,
            address: place.address,
            city: place.city,
            phone: place.phone,
            latitude: place.latitude,
            longitude: place.longitude,
            addedAt: new Date(),
        }));

        const existingAddresses = new Set(prevHotLeads.map(lead => lead.address));
        const uniqueNewLeads = newLeads.filter(lead => !existingAddresses.has(lead.address));

        if (uniqueNewLeads.length > 0) {
            toast({
                title: `${uniqueNewLeads.length} Hot Lead(s) Added`,
                description: `New potential leads have been saved locally for future reference.`
            });
        }
        
        return [...prevHotLeads, ...uniqueNewLeads];
    });
  }, [toast]);

  const handleDictateNotes = (visit: Visit) => {
    setCurrentEditingVisit(visit);
    setStartDictationOnOpen(true);
    setIsVisitFormOpen(true);
  };

  const handleUpdateVisit = useCallback((visitId: string, updatedData: Partial<Visit>) => {
    setVisits(prevVisits => {
      const newVisits = prevVisits.map(v => 
        v.id === visitId ? { ...v, ...updatedData } : v
      );
      localStorage.setItem('visits', JSON.stringify(newVisits));
      return newVisits;
    });
  }, []);

  const handleClearHotLeads = useCallback(() => {
    if (hotLeads.length === 0) return;
    setHotLeads([]);
    toast({ title: "Hot Leads Cleared", description: "The hot leads list has been cleared from this device." });
  }, [hotLeads.length, toast]);

  const handleEmailHotLeads = useCallback(() => {
    if (hotLeads.length === 0) {
      toast({ title: 'No Hot Leads to Email', description: 'There are no submitted hot leads to send.' });
      return;
    }

    const subject = `Hot Leads List from Optimum Trailblazer`;
    let body = `Here is the current list of hot leads:\n\n`;
    hotLeads.forEach((lead, index) => {
      body += `${index + 1}. ${lead.companyName}\n`;
      body += `   Address: ${lead.address}\n`;
      body += `   City: ${lead.city}\n`;
      if (lead.phone) body += `   Phone: ${lead.phone}\n`;
      body += `   Added: ${format(new Date(lead.addedAt), 'MMM d, yyyy, h:mm a')}\n\n`;
    });
    body += `\n\n---\nEmail generated by Optimum Trailblazer App`;

    const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    if (typeof window !== 'undefined') {
        window.location.href = mailtoLink;
    }
    toast({ title: "Opening email client...", description: "Your hot leads list is ready to be sent." });
  }, [hotLeads, toast]);

  return (
    <div className="min-h-screen">
       {!selectedSalesperson && (
        <SalespersonSelectorModal
          salespeople={salespeople}
          onSelectSalesperson={handleSelectSalesperson}
        />
      )}
      <TerritoryUploadModal 
        isOpen={showTerritoryUploadModal}
        onClose={() => setShowTerritoryUploadModal(false)}
      />
      <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        <header className="flex flex-col items-center justify-center w-full py-4 gap-2">
          <h1 className="text-6xl sm:text-8xl font-headline font-bold text-center aurora-text drop-shadow-lg">
            Optimum Trailblazer
          </h1>
          {selectedSalesperson ? (
            <Accordion type="single" collapsible className="w-full max-w-lg mx-auto mt-6">
              <AccordionItem value="daily-plan" className="border-none">
                <AccordionTrigger className="p-4 bg-primary/10 backdrop-blur-sm rounded-lg border border-primary/20 hover:no-underline data-[state=open]:rounded-b-none">
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                      <Compass className="h-5 w-5 text-primary" />
                      <h2 className="text-lg font-headline font-semibold text-foreground text-left">
                        {selectedSalesperson.name}'s Plan
                      </h2>
                    </div>
                    {targetDestination && (
                      <Badge variant="secondary">{targetDestination.city}</Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="flex flex-col justify-center items-center gap-4 p-4 bg-primary/10 backdrop-blur-sm rounded-b-lg border border-primary/20 border-t-0">
                    {isFetchingCity && (
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Determining current city...
                      </div>
                    )}
                    {currentCity && !isFetchingCity && (
                      <div className="flex items-center text-md font-medium text-foreground">
                        <MapPin className="mr-2 h-4 w-4 text-primary" />
                        <span>Current City: {currentCity}</span>
                      </div>
                    )}
                    <Button variant="outline" onClick={() => handleChangeDestination()}>
                      Change Destination
                    </Button>
                    {targetDestination?.description && (
                      <div className="text-center w-full bg-background/20 p-3 rounded-md">
                        <h4 className="font-semibold text-sm text-primary mb-1">AI Parking Suggestion</h4>
                        <p className="text-sm text-muted-foreground">{targetDestination.description}</p>
                      </div>
                    )}
                    {navigationUrl && (
                      <Button
                        onClick={() => window.open(navigationUrl, '_blank', 'noopener,noreferrer')}
                        className="w-full"
                        variant="default"
                      >
                        <Map className="mr-2 h-4 w-4" />
                        Navigate to {targetDestination?.city}
                      </Button>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          ) : (
            <div className="flex flex-col sm:flex-row justify-center items-center gap-2 p-3 bg-primary/10 backdrop-blur-sm rounded-lg border border-primary/20 mt-6">
              <h2 className="text-lg font-headline font-semibold italic text-foreground text-center">
                Good Luck Today!
              </h2>
            </div>
          )}
        </header>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-2 bg-primary/10 backdrop-blur-sm p-1 rounded-full border border-primary/20 -mt-6">
            <TabsTrigger value="field-day" className="rounded-full border-transparent data-[state=active]:bg-primary/20 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg flex items-center justify-center gap-2">
              <PlusCircle className="h-5 w-5" />
              <span className="hidden sm:inline">Field Day</span>
            </TabsTrigger>
            <TabsTrigger value="call-day" className="rounded-full border-transparent data-[state=active]:bg-primary/20 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg flex items-center justify-center gap-2">
              <ListChecks className="h-5 w-5" />
              <span className="hidden sm:inline">Call Day</span>
            </TabsTrigger>
            <TabsTrigger
              value="visits"
              className="rounded-full border-transparent data-[state=active]:bg-primary/20 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg flex items-center justify-center gap-2"
              onClick={(e) => {
                if (visits.length === 0) {
                  e.preventDefault();
                  toast({title: 'No visits to show at the moment!'});
                }
              }}
            >
              <MapPin className="h-5 w-5" />
              <span className="hidden sm:inline">Visits</span>
            </TabsTrigger>
            <TabsTrigger value="ai-chat" className="rounded-full border-transparent data-[state=active]:bg-primary/20 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg flex items-center justify-center gap-2">
              <Bot className="h-5 w-5" />
              <span className="hidden sm:inline">Debbie</span>
            </TabsTrigger>
            <TabsTrigger value="about" className="rounded-full border-transparent data-[state=active]:bg-primary/20 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg flex items-center justify-center gap-2">
              <InfoIcon className="h-5 w-5" />
              <span className="hidden sm:inline">About</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        
        <div className="mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          {activeTab === 'field-day' && (
            <div className="space-y-6">
                <div className="flex justify-center items-center gap-4 w-full">
                    <Button onClick={handleQuickLog} variant="default" size="sm" className="flex-1" disabled={!userCurrentLatitude || isFetchingCity}>
                        {isFetchingCity ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <PlusCircle className="mr-2 h-5 w-5" />}
                        Quicklog Visit
                    </Button>
                    <AlertDialog open={isEndDayConfirmOpen} onOpenChange={setIsEndDayConfirmOpen}>
                      <AlertDialogTrigger asChild>
                        <Button variant="default" size="sm" className="flex-1" disabled={isSyncing}>
                          {isSyncing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <UploadCloud className="mr-2 h-5 w-5" />} 
                          Save Daily Report
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Save Daily Report to Cloud Storage?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will generate a CSV report of today's visits and save it to the Trailblazer storage bucket. Your local data for the day will remain on this device.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={confirmEndDay}>Save Report</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                </div>

                {visits.length === 0 ? (
                    <div className="text-center py-10 bg-card/60 backdrop-blur-sm border border-primary/20 rounded-lg shadow-lg px-4">
                      <p className="text-xl text-muted-foreground mb-4">No visits logged yet for field day.</p>
                      <p className="text-muted-foreground mb-4">
                          Click <span className="inline-block bg-primary text-primary-foreground px-2 py-1 rounded-md text-xs font-semibold">Quicklog Visit</span> to instantly create a new visit at your current location.
                      </p>
                       <Alert variant="default" className="mt-4 text-left max-w-md mx-auto">
                            <WifiOff className="h-4 w-4" />
                            <AlertTitle>Local-First Mode Enabled</AlertTitle>
                            <AlertDescription>
                            Your visits are being saved to this device. Click "Save Daily Report" to upload a report to the cloud.
                            </AlertDescription>
                        </Alert>
                    </div>
                ) : (
                    <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
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
                          />
                      ))}
                    </div>
                )}
            </div>
          )}
          
          {activeTab === 'call-day' && (
            <div className="space-y-6">
              <div className="p-4 bg-card/60 backdrop-blur-sm border border-primary/20 rounded-lg shadow-lg mb-6">
                <div className="mb-4">
                    <Button onClick={() => setIsFindCompanyModalOpen(true)} className="w-full">
                        <Search className="mr-2 h-4 w-4" /> Find Company by Name
                    </Button>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <ListFilter className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-medium text-foreground">Show Visit Cards by Date</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  <div className="flex flex-col items-center">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      className="rounded-md border self-center"
                    />
                    {selectedDate && (
                      <Button variant="ghost" size="sm" onClick={() => setSelectedDate(undefined)} className="mt-2 w-full">
                        Clear Date Filter
                      </Button>
                    )}
                  </div>
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5 w-full">
                      <Label htmlFor="sort-criteria" className="text-sm">Sort Visit Cards By</Label>
                      <Select
                        value={sortCriteria}
                        onValueChange={(value) => setSortCriteria(value as 'partnershipConfidence' | 'timestamp' | 'dealClosed')}
                      >
                        <SelectTrigger id="sort-criteria" className="w-full">
                          <SelectValue placeholder="Select criteria" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="partnershipConfidence">Partnership Confidence</SelectItem>
                          <SelectItem value="timestamp">Date Visited</SelectItem>
                          <SelectItem value="dealClosed">Closed Deals</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1.5 w-full">
                      <Label htmlFor="sort-order" className="text-sm">Order</Label>
                      <Select
                        value={sortOrder}
                        onValueChange={(value) => setSortOrder(value as 'asc' | 'desc')}
                      >
                        <SelectTrigger id="sort-order" className="w-full">
                          <SelectValue placeholder="Select order" />
                        </SelectTrigger>
                        <SelectContent>
                          {sortCriteria === 'partnershipConfidence' ? ( <> <SelectItem value="desc">High to Low</SelectItem> <SelectItem value="asc">Low to High</SelectItem> </> ) : sortCriteria === 'timestamp' ? ( <> <SelectItem value="desc">Newest to Oldest</SelectItem> <SelectItem value="asc">Oldest to Newest</SelectItem> </> ) : ( <> <SelectItem value="desc">Closed Deals First</SelectItem> <SelectItem value="asc">Open Deals First</SelectItem> </>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              <UiCard className="bg-card/60 backdrop-blur-sm border border-primary/20">
                <UiCardHeader>
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <Flame className="h-6 w-6 text-orange-500" />
                            <UiCardTitle>Hot Leads ({hotLeads.length})</UiCardTitle>
                        </div>
                        {hotLeads.length > 0 && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="sm">
                                        <Trash2 className="mr-2 h-4 w-4" /> Clear List
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will permanently delete all {hotLeads.length} hot leads from your local device. This action cannot be undone.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleClearHotLeads}>Clear</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                    </div>
                    <UiCardDescription>Leads generated from your company searches. Saved locally to your device.</UiCardDescription>
                </UiCardHeader>
                <UiCardContent>
                    {hotLeads.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">No hot leads yet. Use the "Find Company" feature to start building your list.</p>
                    ) : (
                        <ScrollArea className="h-60">
                            <div className="space-y-3 pr-4">
                                {hotLeads.map(lead => (
                                    <div key={lead.id} className="p-3 rounded-md border bg-background/50">
                                        <h4 className="font-semibold text-foreground flex items-center"><Building className="mr-2 h-4 w-4 shrink-0" />{lead.companyName}</h4>
                                        <p className="text-sm text-muted-foreground pl-6">{lead.address}</p>
                                        {lead.phone && <p className="text-sm text-muted-foreground pl-6 flex items-center"><Phone className="mr-2 h-4 w-4 shrink-0" />{lead.phone}</p>}
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    )}
                </UiCardContent>
                {hotLeads.length > 0 && (
                    <UiCardFooter className="flex-wrap gap-2">
                        <ExportHotLeadsCsvButton hotLeads={hotLeads} size="sm" />
                        <ExportHotLeadsPdfButton hotLeads={hotLeads} size="sm" />
                        <Button onClick={handleEmailHotLeads} variant="outline" size="sm">
                            <Mail className="mr-2 h-4 w-4" /> Email List to Self
                        </Button>
                    </UiCardFooter>
                )}
              </UiCard>

              {sortedVisitsForCallDay.length === 0 ? (
                <div className="text-center py-10 bg-card/60 backdrop-blur-sm border border-primary/20 rounded-lg shadow-lg">
                  <p className="text-xl text-muted-foreground mb-4">
                    {selectedDate ? `No visits logged on ${format(selectedDate, 'PPP')}.` : 'No visits to display. Log visits in "Field Day" first.'}
                  </p>
                </div>
              ) : (
                <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {sortedVisitsForCallDay.map((visit, index) => (
                    <div 
                      key={visit.id}
                      ref={(el) => { callDayCardRefs.current[index] = el; }}
                      data-card-index={index.toString()}
                    >
                      <VisitCard
                        visit={visit}
                        onEdit={handleEditVisit}
                        onDelete={handleDeleteVisit}
                        onUpdateDealClosed={handleUpdateDealClosed}
                        onZoom={setZoomedVisit}
                        onLogFollowUp={handleLogFollowUp}
                        onDictateNotes={handleDictateNotes}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'visits' && (
            <section aria-labelledby="map-section-title" className="p-6 bg-card/60 backdrop-blur-sm border border-primary/20 rounded-xl shadow-xl space-y-6">
              <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center justify-center">
                  <h2 id="visits-section-title" className="text-2xl font-headline font-semibold flex items-center text-foreground">
                      <MapPin className="mr-3 h-7 w-7 text-primary" /> Company Visits Map
                  </h2>
                  {visits.length > 0 && (
                      <Badge variant="default" className="text-lg font-medium bg-accent text-accent-foreground hover:bg-accent/90 border-transparent">
                          Your Visits: {visits.length}
                      </Badge>
                  )}
              </div>

              <div className="flex flex-wrap gap-2 justify-center">
                 <ExportPdfButton visits={visits} className="h-8 px-2 text-xs" />
                 <ExportButton visits={visits} className="h-8 px-2 text-xs" />
                 <Button onClick={handleEmailManager} variant="default" size="sm" className="h-8 px-2 text-xs">
                   Email Manager
                 </Button>
              </div>
              
              <GoogleMapComponent 
                visits={visits} 
                userLatitude={userCurrentLatitude}
                userLongitude={userCurrentLongitude}
                onUpdateVisit={handleUpdateVisit}
              />
            </section>
          )}

          {activeTab === 'ai-chat' && (
            <>
              {!isGenkitConfigured ? (
                <Alert variant="destructive" className="max-w-2xl mx-auto">
                  <WifiOff className="h-4 w-4" />
                  <AlertTitle>AI Features Disabled</AlertTitle>
                  <AlertDescription>
                    The AI assistant is currently unavailable because the Google API Key has not been configured. Please set the `GOOGLE_API_KEY` in your .env file to enable this feature.
                  </AlertDescription>
                </Alert>
              ) : (
              <UiCard className="w-full max-w-2xl mx-auto shadow-xl bg-card/60 backdrop-blur-sm border-primary/20">
                <UiCardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Bot className="h-8 w-8 text-primary" />
                      <h2 className="text-2xl font-headline font-semibold text-foreground">
                        Debbie
                      </h2>
                    </div>
                    <div className="flex items-center gap-2">
                       <Brain className="h-5 w-5 text-muted-foreground" />
                      <Select value={selectedAiModel} onValueChange={setSelectedAiModel}>
                        <SelectTrigger className="w-[180px] h-9 text-xs">
                          <SelectValue placeholder="Select AI Model" />
                        </SelectTrigger>
                        <SelectContent>
                          {AVAILABLE_AI_MODELS.map(model => ( <SelectItem key={model.id} value={model.id} className="text-xs">{model.name}</SelectItem> ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground pt-2">Recent Visits, Pdfs containg products and pricing, and analyzed scanned documents are used as context</p>
                </UiCardHeader>
                <UiCardContent className="p-0">
                  <ScrollArea className="h-[200px] sm:h-[280px] w-full p-4 border-t border-b">
                    {chatMessages.map((message) => (
                      <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'} mb-4`}>
                        <div className={`flex items-end gap-2 max-w-[75%]`}>
                          {message.sender === 'ai' && (
                            <Avatar className="h-8 w-8 self-start">
                              <AvatarImage src="https://placehold.co/40x40.png" alt="AI Avatar" data-ai-hint="robot face" />
                              <AvatarFallback>AI</AvatarFallback>
                            </Avatar>
                          )}
                          <div className={`p-3 rounded-xl shadow-sm ${message.sender === 'user' ? 'bg-primary text-primary-foreground rounded-br-none' : 'bg-secondary text-secondary-foreground rounded-bl-none'}`}>
                            <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
                            <p className="text-xs mt-1.5 opacity-80 text-right">{format(message.timestamp, 'p')}</p>
                          </div>
                          {message.sender === 'user' && (
                            <Avatar className="h-8 w-8 self-start">
                              <AvatarImage src="https://placehold.co/40x40.png" alt="User Avatar" data-ai-hint="person avatar" />
                              <AvatarFallback>U</AvatarFallback>
                            </Avatar>
                          )}
                        </div>
                      </div>
                    ))}
                    {isAiResponding && ( 
                      <div className="flex justify-start mb-4">
                        <div className="flex items-end gap-2 max-w-[75%]">
                            <Avatar className="h-8 w-8 self-start">
                                <AvatarImage src="https://placehold.co/40x40.png" alt="AI Avatar" data-ai-hint="robot face" />
                                <AvatarFallback>AI</AvatarFallback>
                            </Avatar>
                            <div className="p-3 rounded-xl shadow-sm bg-secondary text-secondary-foreground rounded-bl-none">
                                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                            </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </ScrollArea>
                </UiCardContent>
                <UiCardFooter className="p-4 space-y-2 flex-col items-start">
                  {selectedFile && (
                    <div className="w-full flex items-center justify-between p-2 text-xs bg-secondary rounded-md">
                      <div className="flex items-center gap-2 truncate">
                        <Paperclip className="h-4 w-4 text-primary shrink-0" />
                        <span className="truncate" title={selectedFile.name}>{selectedFile.name}</span>
                      </div>
                      <Button variant="ghost" size="icon" onClick={handleClearFile} className="h-6 w-6 shrink-0">
                        <XCircle className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                        <span className="sr-only">Clear File</span>
                      </Button>
                    </div>
                  )}
                  <div className="flex w-full items-center space-x-2">
                    <Button variant="outline" size="icon" onClick={() => setIsManageFilesModalOpen(true)} disabled={isAiResponding} aria-label="Manage long-term files for AI" title="Manage long-term files for AI"><FolderKanban className="h-4 w-4" /></Button>
                    <Input id="file-upload-input" type="file" accept="application/pdf,text/csv" onChange={handleFileSelect} className="hidden" ref={fileInputRef} disabled={isAiResponding} />
                    <Button variant="outline" size="icon" onClick={() => fileInputRef.current?.click()} disabled={isAiResponding} aria-label="Attach a file for this message" title="Attach a file for this message"><Paperclip className="h-4 w-4" /></Button>
                    <Input 
                      type="text" 
                      placeholder={isRecordingChat ? "Listening..." : "Type your message..."} 
                      value={chatInput} 
                      onChange={(e) => setChatInput(e.target.value)} 
                      onKeyPress={(e) => { if (e.key === 'Enter' && !isAiResponding) handleSendChatMessage(); }} 
                      className="flex-1" 
                      disabled={isAiResponding || isRecordingChat} 
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="icon" 
                      onClick={handleToggleChatVoice} 
                      disabled={isAiResponding}
                      aria-label="Speak message"
                      title="Speak message"
                    >
                      {isRecordingChat ? <Mic className="h-4 w-4 text-red-500 animate-pulse" /> : <Mic className="h-4 w-4" />}
                    </Button>
                    <Button onClick={handleSendChatMessage} disabled={!chatInput.trim() || isAiResponding || isRecordingChat}>
                      {isAiResponding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      <span className="sr-only">Send</span>
                    </Button>
                  </div>
                </UiCardFooter>
              </UiCard>
              )}
            </>
          )}
          
          {activeTab === 'about' && (
            <div className="p-6 bg-card/60 backdrop-blur-sm border-primary/20 rounded-xl shadow-xl min-h-[300px] flex flex-col items-start justify-start space-y-6">
                <div className="w-full text-center">
                    <h2 className="text-2xl font-headline font-semibold text-primary flex items-center justify-center">
                        <InfoIcon className="mr-3 h-7 w-7" /> App Guide
                    </h2>
                    <p className="text-foreground/90 mt-1">
                        This guide explains the key features of each section of the app.
                    </p>
                </div>

                <Tabs defaultValue="about-field-day" className="w-full">
                    <TabsList className="grid w-full grid-cols-5 mb-4 bg-primary/10 backdrop-blur-sm p-1 rounded-full border border-primary/20">
                        <TabsTrigger value="about-field-day" className="rounded-full border-transparent data-[state=active]:bg-primary/20 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg">Field Day</TabsTrigger>
                        <TabsTrigger value="about-call-day" className="rounded-full border-transparent data-[state=active]:bg-primary/20 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg">Call Day</TabsTrigger>
                        <TabsTrigger value="about-visits" className="rounded-full border-transparent data-[state=active]:bg-primary/20 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg">Visits</TabsTrigger>
                        <TabsTrigger value="about-debbie" className="rounded-full border-transparent data-[state=active]:bg-primary/20 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg">Debbie</TabsTrigger>
                        <TabsTrigger value="about-feedback" className="rounded-full border-transparent data-[state=active]:bg-primary/20 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg">Feedback</TabsTrigger>
                    </TabsList>

                    <TabsContent value="about-field-day" className="text-foreground text-base leading-relaxed p-4 bg-background/20 rounded-lg">
                        <p className="mb-4">This is your main workspace for logging new visits. Here's how it works:</p>
                        <ul className="list-disc list-inside space-y-3">
                            <li>
                                Click the <span className="inline-block bg-primary text-primary-foreground px-2 py-1 rounded-md text-xs font-semibold">Quicklog Visit</span> button to instantly create a new visit record at your current location, pre-filled with company details when possible.
                            </li>
                            <li>
                                As you interact with the potential partner, edit the visit card to add details. Capturing business cards, competitor info, and notes makes the app—and our AI assistant, Debbie—more powerful.
                            </li>
                            <li>
                                Once you're done for the day, click the <span className="inline-block bg-primary text-primary-foreground px-2 py-1 rounded-md text-xs font-semibold">End Day!</span> button. This summarizes your daily accomplishments.
                            </li>
                        </ul>
                    </TabsContent>

                    <TabsContent value="about-call-day" className="text-foreground text-base leading-relaxed p-4 bg-background/20 rounded-lg">
                        <p>The "Call Day" tab is your command center for follow-ups. It provides a prioritized list of your visits, helping you focus your calls on the most promising leads. You can sort by partnership confidence or visit date to strategize your outreach effectively.</p>
                    </TabsContent>

                    <TabsContent value="about-visits" className="text-foreground text-base leading-relaxed p-4 bg-background/20 rounded-lg">
                        <p>The "Visits" tab shows all your logged locations on an interactive map, giving you a visual overview of your progress. From here, you can export your visit data to PDF or CSV and quickly compose a summary email to your manager, saving you time and hassle.</p>
                    </TabsContent>

                    <TabsContent value="about-debbie" className="text-foreground text-base leading-relaxed p-4 bg-background/20 rounded-lg">
                        <p>"Debbie" is your customized AI agent, powered by Gemini. She can analyze visit notes, answer questions about recent activities, and even review documents like product lists if you upload a PDF. The more information you log in your visits, the more helpful Debbie becomes. Challenge her with your questions!</p>
                    </TabsContent>
                    
                    <TabsContent value="about-feedback" className="p-4 bg-background/20 rounded-lg">
                        <div className="w-full">
                            <h3 className="text-xl font-headline font-semibold text-primary mb-2 flex items-center">
                                <MessagesSquare className="mr-3 h-6 w-6" /> Suggestions and Improvements
                            </h3>
                            <div className="space-y-3">
                                <Label htmlFor="appSuggestion" className="text-foreground">Your Suggestion:</Label>
                                <Textarea id="appSuggestion" placeholder="Type your feedback or feature request here..." value={suggestionText} onChange={(e) => setSuggestionText(e.target.value)} className="min-h-[100px]" />
                                <Button onClick={handleSubmitSuggestion} disabled={!suggestionText.trim()}><Send className="mr-2 h-4 w-4" /> Add Suggestion</Button>
                            </div>
                        </div>

                        {submittedSuggestions.length > 0 && (
                            <div className="w-full pt-4 mt-6 border-t">
                                <h3 className="text-2xl font-headline font-semibold text-primary mb-3">List of Possible Improvements</h3>
                                <div className="p-4 bg-secondary/30 rounded-lg border border-border max-h-60 overflow-y-auto">
                                <ol className="list-decimal list-inside space-y-2 text-foreground/90">
                                    {submittedSuggestions.map((suggestion, index) => (
                                    <li key={`${suggestion.timestamp}-${index}`} className="text-sm leading-relaxed">
                                        {suggestion.text}
                                        <span className="block text-xs text-muted-foreground mt-0.5">&mdash; on {format(suggestion.timestamp, 'MMM d, yyyy, h:mm a')}</span>
                                    </li>
                                    ))}
                                </ol>
                                </div>
                                <Button onClick={handleEmailSuggestions} variant="default" className="mt-4"><Mail className="mr-2 h-4 w-4" /> Email Suggestions to Designer</Button>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </div>
          )}
        </div>
        
        <Dialog open={!!zoomedVisit} onOpenChange={(isOpen) => { if (!isOpen) setZoomedVisit(null); }}>
          <DialogContent className="max-w-2xl p-0 bg-transparent border-0 shadow-none">
            {zoomedVisit && (
              <>
                <DialogTitle className="sr-only">Visit Details: {zoomedVisit.companyName}</DialogTitle>
                <DialogDescription className="sr-only">Detailed view of the visit to {zoomedVisit.companyName}. You can see all recorded information, edit, or delete the visit from this view.</DialogDescription>
                <VisitCard
                  visit={zoomedVisit}
                  onEdit={(v) => { setZoomedVisit(null); handleEditVisit(v); }}
                  onDelete={(id) => { setZoomedVisit(null); handleDeleteVisit(id); }}
                  onUpdateDealClosed={(id, status) => { handleUpdateDealClosed(id, status); setZoomedVisit(prev => prev ? {...prev, dealClosed: status} : null); }}
                  isZoomedView={true}
                  onDictateNotes={handleDictateNotes}
                />
              </>
            )}
          </DialogContent>
        </Dialog>
        
        <Dialog open={isDestinationModalOpen} onOpenChange={setIsDestinationModalOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Choose Your Destination</DialogTitle>
                    <DialogDescription>
                        {isExtractingCities ? "Debbie is reading your territory file to find cities..." : "Select a city to get an AI-optimized parking location for your day."}
                    </DialogDescription>
                </DialogHeader>
                <div className="max-h-[400px] overflow-y-auto pr-2">
                    {isExtractingCities ? (
                        <div className="flex justify-center items-center h-32"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                    ) : destinationCities.length > 0 ? (
                        <div className="flex flex-col space-y-2">
                            {destinationCities.map(city => (
                                <Button
                                    key={city}
                                    variant="ghost"
                                    className="justify-start"
                                    disabled={isFindingParking}
                                    onClick={async () => {
                                        setIsDestinationModalOpen(false);
                                        setIsFindingParking(true);
                                        try {
                                            const result = await findOptimalParkingAction({ city });
                                            if (result.error) throw new Error(result.error);
                                            
                                            if (result.latitude && result.longitude) {
                                                setTargetDestination({ city, description: result.locationDescription || 'Central Business Area' });
                                                const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${result.latitude},${result.longitude}`;
                                                setNavigationUrl(googleMapsUrl);
                                            } else {
                                                throw new Error('AI did not return a valid location.');
                                            }
                                        } catch (e: any) {
                                            toast({ variant: "destructive", title: 'Could Not Find Location', description: e.message || 'An unexpected error occurred.'});
                                        } finally {
                                            setIsFindingParking(false);
                                        }
                                    }}
                                >
                                   {city}
                                </Button>
                            ))}
                        </div>
                    ) : (
                         <p className="text-muted-foreground text-center py-4">No destination cities found. You can upload a territory PDF or ensure your profile has cities assigned.</p>
                    )}
                </div>
                 <DialogFooter>
                    <Button variant="ghost" onClick={() => setIsDestinationModalOpen(false)} disabled={isFindingParking || isExtractingCities}>
                        {isFindingParking || isExtractingCities ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Skip'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <FindCompanyModal
          isOpen={isFindCompanyModalOpen}
          onClose={() => setIsFindCompanyModalOpen(false)}
          onAddAsVisit={handleAddFoundCompanyAsVisit}
          onAddHotLeads={handleAddHotLeads}
          destinationCities={destinationCities}
          territory={selectedSalesperson?.territory}
        />
        
        <ManageFilesModal
            isOpen={isManageFilesModalOpen}
            onClose={() => setIsManageFilesModalOpen(false)}
            managedFiles={managedFiles}
            onFilesChange={handleManagedFilesChange}
        />

        <VisitForm
          isOpen={isVisitFormOpen}
          onClose={() => { 
            setIsVisitFormOpen(false); 
            setCurrentEditingVisit(undefined); 
            setStartDictationOnOpen(false);
          }}
          onSave={handleSaveFromForm}
          initialData={currentEditingVisit}
          salesperson={selectedSalesperson}
          startDictation={startDictationOnOpen}
        />
      </div>
      <footer className="text-center py-8 text-muted-foreground text-sm border-t mt-12">
        <p>&copy; {new Date().getFullYear()} Optimum Trailblazer. Your personal sales companion.</p>
         <p className="text-xs mt-1">
            {firebaseConfigured ? "Data is saved locally. Use 'Save Daily Report' to upload to the cloud." : "Data is saved locally to your browser."}
         </p>
      </footer>
    </div>
  );
}
