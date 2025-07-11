
'use client';

import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import type { Visit, ChatMessage, Salesperson, Territory, ManagedFile, ContactInfo, HotLead, FoundPlace, CompanyDoc } from '@/lib/types';
import { Button } from '@/components/ui/button';
import VisitForm from '@/components/visit-form';
import VisitCard from '@/components/visit-card';
import ExportButton from '@/components/export-button';
import ExportPdfButton from '@/components/export-pdf-button';
import GoogleMapComponent from '@/components/google-map';
import { PlusCircle, ListChecks, User, InfoIcon, Sunset, Send, PartyPopper, MessagesSquare, Hash, Mail, ListFilter, Bot, MapPin, Brain, Loader2, Paperclip, XCircle, Swords, UserCog, AlertTriangle, WifiOff, Search, FolderKanban, Map as MapIcon, RefreshCw, UploadCloud, Mic, Compass, Flame, Building, Trash2, Phone, PlusSquare, CalendarIcon, Check, CheckCircle, Edit, CalendarCheck, X, PackageCheck, Save, Newspaper, LayoutGrid, Square, Star, DollarSign, FileText } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { format, subDays, isSameDay, isToday, startOfDay, addDays } from 'date-fns';
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAiChatResponseAction, getCompanyNameFromCoordsAction, findOptimalParkingAction, extractCitiesFromPdfAction, findCompanyAction, saveDailyReportAction, analyzeDocumentAction } from '@/app/actions';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import SalespersonSelectorModal from '@/components/salesperson-selector-modal';
import TerritoryUploadModal from '@/components/territory-upload-modal';
import FindCompanyModal from '@/components/find-company-modal';
import ManageFilesModal from '@/components/manage-files-modal';
import { fileToDataUri, cn, stateNameToAbbreviation } from '@/lib/utils';
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
        name: 'Lyman', 
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

function getDistanceFromLatLonInM(lat1:number, lon1:number, lat2:number, lon2:number) {
    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(lat2-lat1);
    var dLon = deg2rad(lon2-lon1); 
    var a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2)
      ; 
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    var d = R * c; // Distance in km
    return d * 1000; // Distance in m
}

function deg2rad(deg:number) {
  return deg * (Math.PI/180)
}

const CallDayVisitList = memo(function CallDayVisitList({ visits, onEdit, onDelete, onUpdateDealClosed, onZoom, onLogFollowUp, onDictateNotes }: {
  visits: Visit[],
  onEdit: (visit: Visit) => void,
  onDelete: (visitId: string) => void,
  onUpdateDealClosed: (visitId: string, dealClosed: boolean) => void,
  onZoom: (visit: Visit | null) => void,
  onLogFollowUp: (visit: Visit) => void,
  onDictateNotes: (visit: Visit) => void,
}) {
  return (
    <Accordion type="multiple" className="w-full space-y-4">
      {visits.map((visit) => (
        <AccordionItem value={visit.id} key={visit.id} className={cn("border bg-card rounded-lg overflow-hidden", visit.dealClosed ? "border-green-500" : "border-primary/20")}>
          <AccordionTrigger className={cn("p-4 hover:no-underline w-full text-left [&[data-state=open]]:border-b", visit.dealClosed ? "[&[data-state=open]]:border-green-500" : "[&[data-state=open]]:border-primary/20")}>
            <div className="flex flex-1 items-center justify-between min-w-0 gap-4">
              <div className="flex flex-1 items-center gap-3 min-w-0">
                <span className={cn("h-3 w-3 rounded-full shrink-0", visit.dealClosed ? "bg-green-500" : "bg-primary")}></span>
                <h4 className="font-semibold text-foreground truncate" title={visit.companyName}>{visit.companyName}</h4>
              </div>
              <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
                {(visit.interestedUnits && visit.interestedUnits.length > 0) ? (
                    <span className="text-sm text-primary font-medium truncate">{`{${visit.interestedUnits[0].split('(')[0].trim()}${visit.interestedUnits.length > 1 ? `, +${visit.interestedUnits.length-1}`: ''}}`}</span>
                ) : (
                    <span>{format(new Date(visit.timestamp), 'MMM d, yy')}</span>
                )}
                {visit.partnershipConfidence && (
                  <Badge variant="outline" className="flex items-center gap-1 px-1.5 py-0.5 border-transparent bg-transparent">
                    <span className="leading-none">{visit.partnershipConfidence}</span>
                    <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                  </Badge>
                )}
                {visit.futureMeetingSet && (
                  <CalendarCheck className={cn("h-4 w-4", visit.freeTrial ? "text-orange-500" : "text-green-500")} />
                )}
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="p-4">
            <VisitCard
              visit={visit}
              onEdit={onEdit}
              onDelete={onDelete}
              onUpdateDealClosed={onUpdateDealClosed}
              onZoom={onZoom}
              onLogFollowUp={onLogFollowUp}
              onDictateNotes={onDictateNotes}
            />
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
});

export default function HomePage() {
  // State and Refs
  const [visits, setVisits] = useState<Visit[]>([]);
  const [hotLeads, setHotLeads] = useState<HotLead[]>([]);
  const [isVisitFormOpen, setIsVisitFormOpen] = useState(false);
  const [currentEditingVisit, setCurrentEditingVisit] = useState<Visit | undefined>(undefined);
  const [userCurrentLatitude, setUserCurrentLatitude] = useState<number | undefined>();
  const [userCurrentLongitude, setUserCurrentLongitude] = useState<number | undefined>();
  const [isEndDayConfirmOpen, setIsEndDayConfirmOpen] = useState(false);
  const [suggestionText, setSuggestionText] = useState('');
  const [submittedSuggestions, setSubmittedSuggestions] = useState<SubmittedSuggestion[]>([]);
  const [sortCriteria, setSortCriteria] = useState<'partnershipConfidence' | 'timestamp' | 'dealClosed' | 'futureMeetingsSet' | 'inTrial' | 'city'>('partnershipConfidence');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [zoomedVisit, setZoomedVisit] = useState<Visit | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isRecordingSearch, setIsRecordingSearch] = useState(false);
  const [citySearchTerm, setCitySearchTerm] = useState('');
  const [isRecordingCitySearch, setIsRecordingCitySearch] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { 
        id: 'ai_welcome_init', 
        sender: 'ai', 
        text: `Welcome! I am your Optimum Trailblazer AI Assistant. How can I help you plan your day or analyze visit data?`, 
        timestamp: new Date()
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isAiResponding, setIsAiResponding] = useState(false);
  const [selectedAiModel, setSelectedAiModel] = useState<string>(AVAILABLE_AI_MODELS[0].id);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isRecordingChat, setIsRecordingChat] = useState(false);
  const [selectedSalesperson, setSelectedSalesperson] = useState<Salesperson | null>(null);
  const [isDestinationModalOpen, setIsDestinationModalOpen] = useState(false);
  const [targetDestination, setTargetDestination] = useState<{city: string; description: string} | null>(null);
  const [navigationUrl, setNavigationUrl] = useState<string | null>(null);
  const [currentCity, setCurrentCity] = useState<string | null>(null);
  const [isFetchingCity, setIsFetchingCity] = useState(true);
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
  const [startDictationOnOpen, setStartDictationOnOpen] = useState(false);
  const [isRecordingHotLeadNotes, setIsRecordingHotLeadNotes] = useState<string | null>(null);
  const [convertedHotLeads, setConvertedHotLeads] = useState<Set<string>>(new Set());
  const [isStartupNavigationConfirmOpen, setIsStartupNavigationConfirmOpen] = useState(false);
  const [startupNavigationTarget, setStartupNavigationTarget] = useState<{ companyName: string; latitude: number; longitude: number; } | null>(null);
  const [destinationSearchTerm, setDestinationSearchTerm] = useState('');
  const [isRecordingDestinationSearch, setIsRecordingDestinationSearch] = useState(false);
  const [newsItems, setNewsItems] = useState<string[]>([]);
  const [newNewsItem, setNewNewsItem] = useState('');
  const [addingFutureVisit, setAddingFutureVisit] = useState(false);
  const [fieldDayAccordionValue, setFieldDayAccordionValue] = useState<string | undefined>();
  const [companyDocs, setCompanyDocs] = useState<CompanyDoc[]>([]);
  const [newDocName, setNewDocName] = useState('');
  const [newDocUrl, setNewDocUrl] = useState('');
  const [analyzingDocId, setAnalyzingDocId] = useState<string | null>(null);
  
  const { toast } = useToast();
  const searchRecognitionRef = useRef<SpeechRecognition | null>(null);
  const citySearchRecognitionRef = useRef<SpeechRecognition | null>(null);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatRecognitionRef = useRef<SpeechRecognition | null>(null);
  const hotLeadNotesRecognitionRef = useRef<SpeechRecognition | null>(null);
  const locationWatchId = useRef<number | null>(null);
  const destinationSearchRecognitionRef = useRef<SpeechRecognition | null>(null);
  const visitsRef = useRef<Visit[]>([]);
  const dailyPlanRef = useRef<HTMLDivElement>(null);
  const scheduledVisitsRef = useRef<HTMLDivElement>(null);
  const unscheduledVisitsRef = useRef<HTMLDivElement>(null);
  const flaggedHotspotsRef = useRef<HTMLDivElement>(null);
  const activeFreeTrialsRef = useRef<HTMLDivElement>(null);
  const dealsClosedRef = useRef<HTMLDivElement>(null);
  const callDayFilterRef = useRef<HTMLDivElement>(null);
  const newsFeedRef = useRef<HTMLDivElement>(null);
  const hotLeadsRef = useRef<HTMLDivElement>(null);
  const companyDocsRef = useRef<HTMLDivElement>(null);
  const debbieRef = useRef<HTMLDivElement>(null);

  const isGenkitConfigured = process.env.NEXT_PUBLIC_GENKIT_CONFIGURED === 'true';

  // Memos
  const scheduledFutureVisitDays = useMemo(() => {
    const today = startOfDay(new Date());
    return visits
      .filter(visit => 
        visit.futureMeetingSet && 
        visit.futureMeetingDateTime && 
        new Date(visit.futureMeetingDateTime) >= today &&
        !visit.dealClosed
      )
      .map(visit => startOfDay(new Date(visit.futureMeetingDateTime!)));
  }, [visits]);

  const trialEndDays = useMemo(() => {
    const today = startOfDay(new Date());
    return visits
      .filter(v => {
        if (!v.freeTrial || !v.freeTrialStartDate) return false;
        const trialEndDate = addDays(startOfDay(new Date(v.freeTrialStartDate!)), 7);
        return trialEndDate >= today;
      })
      .map(v => addDays(startOfDay(new Date(v.freeTrialStartDate!)), 7));
  }, [visits]);

  const loggedPastVisitDays = useMemo(() => {
    const today = startOfDay(new Date());
    const pastTimestamps = new Set<number>();
  
    visits.forEach(v => {
      const visitDay = startOfDay(new Date(v.timestamp));
      if (visitDay < today) {
        pastTimestamps.add(visitDay.getTime());
      }
      if (v.futureMeetingSet && v.futureMeetingDateTime) {
        const meetingDay = startOfDay(new Date(v.futureMeetingDateTime));
        if (meetingDay < today && !v.dealClosed) {
          pastTimestamps.add(meetingDay.getTime());
        }
      }
    });
  
    return Array.from(pastTimestamps).map(time => new Date(time));
  }, [visits]);

  const dealClosedDays = useMemo(() => {
    const closedDays = new Set<number>();
    visits.forEach(visit => {
        if (visit.dealClosed) {
            closedDays.add(startOfDay(new Date(visit.timestamp)).getTime());
            if (visit.futureMeetingDateTime) {
                closedDays.add(startOfDay(new Date(visit.futureMeetingDateTime)).getTime());
            }
        }
    });
    return Array.from(closedDays).map(time => new Date(time));
  }, [visits]);

  const sortedVisitsForCallDay = useMemo(() => {
    if (visits.length === 0) return [];
  
    let processedVisits = [...visits];
    const isSpecialFilter = ['inTrial', 'dealClosed', 'futureMeetingsSet'].includes(sortCriteria);
  
    if (selectedDate && !isSpecialFilter) {
      processedVisits = processedVisits.filter(visit =>
        isSameDay(new Date(visit.timestamp), selectedDate) ||
        (visit.futureMeetingSet && visit.futureMeetingDateTime && isSameDay(new Date(visit.futureMeetingDateTime), selectedDate))
      );
    }
  
    if (searchTerm.trim() !== '') {
      processedVisits = processedVisits.filter(visit =>
        visit.companyName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
  
    if (sortCriteria === 'city' && citySearchTerm.trim() !== '') {
      processedVisits = processedVisits.filter(visit =>
        visit.city?.toLowerCase().includes(citySearchTerm.toLowerCase())
      );
    }
  
    if (sortCriteria === 'futureMeetingsSet') {
      processedVisits = processedVisits.filter(visit => visit.futureMeetingSet && visit.futureMeetingDateTime);
    } else if (sortCriteria === 'inTrial') {
      processedVisits = processedVisits.filter(visit => visit.freeTrial && visit.freeTrialStartDate);
    } else if (sortCriteria === 'dealClosed') {
      processedVisits = processedVisits.filter(visit => visit.dealClosed);
    }
  
    const uniqueVisits = Array.from(new Map(processedVisits.map(visit => [visit.id, visit])).values());
  
    const sorted = uniqueVisits.sort((a, b) => {
      const confidenceA = a.partnershipConfidence ?? 0;
      const confidenceB = b.partnershipConfidence ?? 0;
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      const cityA = a.city || '';
      const cityB = b.city || '';
  
      let comparison = 0;
      
      if (sortCriteria === 'city') {
        comparison = sortOrder === 'asc' ? cityA.localeCompare(cityB) : cityB.localeCompare(cityA);
        if (comparison !== 0) return comparison;
        return confidenceB - confidenceA;
      } else if (sortCriteria === 'futureMeetingsSet') {
        const meetingTimeA = a.futureMeetingDateTime ? new Date(a.futureMeetingDateTime).getTime() : Infinity;
        const meetingTimeB = b.futureMeetingDateTime ? new Date(b.futureMeetingDateTime).getTime() : Infinity;
        comparison = sortOrder === 'desc' ? meetingTimeB - meetingTimeA : meetingTimeA - meetingTimeB;
        if (comparison !== 0) return comparison;
        return timeB - timeA;
      } else if (sortCriteria === 'inTrial') {
        const trialTimeA = a.freeTrialStartDate ? new Date(a.freeTrialStartDate).getTime() : 0;
        const trialTimeB = b.freeTrialStartDate ? new Date(b.freeTrialStartDate).getTime() : 0;
        comparison = sortOrder === 'desc' ? trialTimeB - trialTimeA : trialTimeA - trialTimeB;
        if (comparison !== 0) return comparison;
        return confidenceB - confidenceA;
      } else if (sortCriteria === 'dealClosed') {
        comparison = sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
        if (comparison !== 0) return comparison;
        return confidenceB - confidenceA;
      } else if (sortCriteria === 'partnershipConfidence') {
        comparison = sortOrder === 'desc' ? confidenceB - confidenceA : confidenceA - confidenceB;
        if (comparison !== 0) return comparison;
        return timeB - timeA;
      } else { // 'timestamp'
        comparison = sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
        if (comparison !== 0) return comparison;
        return confidenceB - confidenceA;
      }
    });
    return sorted;
  }, [visits, sortCriteria, sortOrder, selectedDate, searchTerm, citySearchTerm]);

  const scheduledVisits = useMemo(() => {
    return visits
      .filter(visit => visit.futureMeetingSet && visit.futureMeetingDateTime && new Date(visit.futureMeetingDateTime) >= new Date())
      .sort((a, b) => new Date(a.futureMeetingDateTime!).getTime() - new Date(b.futureMeetingDateTime!).getTime());
  }, [visits]);

  const unscheduledFutureVisits = useMemo(() => {
    const scheduledIds = new Set(scheduledVisits.map(v => v.id));
    return visits
      .filter(visit => 
        visit.futureMeetingSet && 
        !visit.futureMeetingDateTime && 
        !scheduledIds.has(visit.id) &&
        !visit.notes?.startsWith('Flagged as a hotspot.')
      )
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [visits, scheduledVisits]);

  const flaggedHotspots = useMemo(() => {
    const scheduledIds = new Set(scheduledVisits.map(v => v.id));
    return visits
      .filter(visit => 
        visit.notes?.startsWith('Flagged as a hotspot.') && 
        !visit.futureMeetingDateTime && 
        !scheduledIds.has(visit.id)
      )
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [visits, scheduledVisits]);

  const activeFreeTrials = useMemo(() => {
    return visits
      .filter(visit => visit.freeTrial && visit.freeTrialStartDate && !visit.dealClosed)
      .sort((a, b) => new Date(b.freeTrialStartDate!).getTime() - new Date(a.freeTrialStartDate!).getTime());
  }, [visits]);

  const closedDeals = useMemo(() => {
    return visits
      .filter(visit => visit.dealClosed)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [visits]);

  const totalTrialCommission = useMemo(() => {
    return activeFreeTrials.reduce((total, visit) => {
      if (typeof visit.manualCommission === 'number') {
        return total + visit.manualCommission;
      }
      if (visit.pricingDiscussed) {
        if (visit.creditApproved === false && typeof visit.priceQuoted === 'number') {
          return total + visit.priceQuoted;
        }
        const leaseCommission = (visit.priceQuoted && visit.leaseTerm) ? (visit.priceQuoted * (visit.leaseTerm / 12)) : 0;
        const installCommission = visit.installationFee ? (visit.installationFee / 2) : 0;
        return total + leaseCommission + installCommission;
      }
      return total;
    }, 0);
  }, [activeFreeTrials]);

  const todaysVisits = useMemo(() => {
    return visits.filter(visit => isToday(new Date(visit.timestamp)));
  }, [visits]);

  const todaysScheduledVisits = useMemo(() => {
    return scheduledVisits.filter(visit => isToday(new Date(visit.futureMeetingDateTime!)));
  }, [scheduledVisits]);

  // Callbacks
  const handleSaveFromForm = useCallback((payload: SaveVisitPayload, options: { andClose?: boolean; expandOnClose?: boolean; } = {}): Promise<Visit> => {
    return new Promise((resolve) => {
        const { andClose = true, expandOnClose = false } = options;
        if (andClose) {
            setIsVisitFormOpen(false);
        }

        const findIndexAndSave = (currentVisits: Visit[]): {updatedVisits: Visit[], finalVisit: Visit, wasNew: boolean} => {
            let existingVisitIndex = payload.id ? currentVisits.findIndex(v => v.id === payload.id) : -1;

            if (existingVisitIndex === -1 && (!payload.id || payload.id.startsWith('temp_'))) {
                existingVisitIndex = currentVisits.findIndex(v => 
                    v.companyName === payload.companyName && 
                    isToday(new Date(v.timestamp))
                );
            }

            if (existingVisitIndex !== -1) {
                const existingVisit = currentVisits[existingVisitIndex];
                const finalPayload = { ...payload, id: existingVisit.id };
                const mergedVisit: Visit = { ...existingVisit, ...finalPayload };

                if (payload.notes !== undefined && payload.notes !== existingVisit.notes) {
                    mergedVisit.notesSummary = undefined;
                }
                const updatedVisits = [...currentVisits];
                updatedVisits[existingVisitIndex] = mergedVisit;
                return { updatedVisits, finalVisit: mergedVisit, wasNew: false };
            } else {
                const visitId = payload.id && !payload.id.startsWith('temp_') ? `temp_${crypto.randomUUID()}` : payload.id || `temp_${crypto.randomUUID()}`;
                
                const newVisit: Visit = {
                  id: visitId,
                  timestamp: payload.timestamp || new Date(),
                  companyName: payload.companyName || '',
                  city: payload.city,
                  notes: payload.notes || undefined,
                  latitude: payload.latitude || undefined,
                  longitude: payload.longitude || undefined,
                  partnershipConfidence: payload.partnershipConfidence || undefined,
                  hasBusinessCard: payload.hasBusinessCard || false,
                  businessCardImageFrontUrl: payload.businessCardImageFrontUrl || undefined,
                  businessCardImageBackUrl: payload.businessCardImageBackUrl || undefined,
                  discussedCompetitors: !!payload.competitorName,
                  competitorName: payload.competitorName || undefined,
                  coolerType: payload.coolerType || undefined,
                  decisionMakerName: payload.decisionMakerName || undefined,
                  decisionMakerTitle: payload.decisionMakerTitle || undefined,
                  decisionMakerContact: payload.decisionMakerContact || undefined,
                  visitNumber: payload.visitNumber || undefined,
                  interestedUnits: payload.interestedUnits || undefined,
                  hasTDSReading: payload.hasTDSReading || false,
                  tdsValue: payload.tdsValue ?? undefined,
                  futureMeetingSet: payload.futureMeetingSet || false,
                  futureMeetingDateTime: payload.futureMeetingDateTime ? new Date(payload.futureMeetingDateTime) : undefined,
                  freeTrial: payload.freeTrial || false,
                  freeTrialStartDate: payload.freeTrialStartDate ? new Date(payload.freeTrialStartDate) : undefined,
                  notesSummary: payload.notesSummary || undefined,
                  contactInfo: payload.contactInfo || undefined,
                  dealClosed: payload.dealClosed || false,
                  pricingDiscussed: payload.pricingDiscussed || false,
                  priceQuoted: payload.priceQuoted,
                  leaseTerm: payload.leaseTerm,
                  installationFee: payload.installationFee,
                  creditApproved: payload.creditApproved || false,
                  manualCommission: payload.manualCommission,
                };
                
                const updatedVisits = [newVisit, ...currentVisits];
                return { updatedVisits, finalVisit: newVisit, wasNew: true };
            }
        }

        const { updatedVisits, finalVisit, wasNew } = findIndexAndSave(visitsRef.current);
        
        setVisits(updatedVisits);
        visitsRef.current = updatedVisits;
        localStorage.setItem('visits', JSON.stringify(updatedVisits));

        toast({
            title: !wasNew ? (andClose ? "Visit Updated" : "Progress Saved") : "Visit Logged",
            description: `${finalVisit.companyName} data saved to device.`,
        });

        if (expandOnClose && finalVisit.id) {
          setActiveTab('field-day');
          setFieldDayAccordionValue(finalVisit.id);
        }

        resolve(finalVisit);
    });
  }, [setIsVisitFormOpen, toast, setFieldDayAccordionValue]);

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

    recognition.continuous = true;
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
      let newTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          newTranscript += event.results[i][0].transcript + ' ';
        }
      }
      if (newTranscript) {
        setChatInput(prev => (prev ? `${prev} ${newTranscript.trim()}` : newTranscript.trim()));
        toast({ title: 'Message Transcribed', description: "Press send to submit." });
      }
    };

    try {
      recognition.start();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Could not start recording', description: `Please ensure microphone access is granted. Error: ${e.message}` });
    }
  }, [isRecordingChat, toast]);

  const handleToggleVoiceSearch = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({ variant: 'destructive', title: 'Voice Recognition Not Supported', description: 'Your browser does not support this feature. Extensions or browser settings might be the cause.' });
      return;
    }

    if (isRecordingSearch && searchRecognitionRef.current) {
      searchRecognitionRef.current.stop();
      return;
    }

    const recognition = new SpeechRecognition();
    searchRecognitionRef.current = recognition;

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsRecordingSearch(true);
      toast({ title: 'Listening...' });
    };

    recognition.onend = () => {
      setIsRecordingSearch(false);
      searchRecognitionRef.current = null;
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
          setIsRecordingSearch(false);
          searchRecognitionRef.current = null;
          return;
        case 'language-not-supported':
          errorMessage = "The language for dictation is not supported by your browser.";
          break;
        case 'bad-grammar':
           errorMessage = "There was a grammar recognition error. This is usually an issue with the recognition service.";
           break;
      }
      
      toast({ variant: 'destructive', title: 'Voice Recognition Error', description: errorMessage, duration: 9000 });
      setIsRecordingSearch(false);
      searchRecognitionRef.current = null;
    };

    recognition.onresult = (event) => {
      if (event.results && event.results.length > 0 && event.results[0].length > 0) {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setSearchTerm(transcript);
          toast({ title: 'Search Term Transcribed' });
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
  }, [isRecordingSearch, toast]);

  const handleToggleVoiceCitySearch = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({ variant: 'destructive', title: 'Voice Recognition Not Supported' });
      return;
    }

    if (isRecordingCitySearch && citySearchRecognitionRef.current) {
      citySearchRecognitionRef.current.stop();
      return;
    }

    const recognition = new SpeechRecognition();
    citySearchRecognitionRef.current = recognition;

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsRecordingCitySearch(true);
      toast({ title: 'Listening...' });
    };

    recognition.onend = () => {
      setIsRecordingCitySearch(false);
      citySearchRecognitionRef.current = null;
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
          setIsRecordingCitySearch(false);
          citySearchRecognitionRef.current = null;
          return;
        case 'language-not-supported':
          errorMessage = "The language for dictation is not supported by your browser.";
          break;
        case 'bad-grammar':
           errorMessage = "There was a grammar recognition error. This is usually an issue with the recognition service.";
           break;
      }
      
      toast({ variant: 'destructive', title: 'Voice Recognition Error', description: errorMessage, duration: 9000 });
      setIsRecordingCitySearch(false);
      citySearchRecognitionRef.current = null;
    };

    recognition.onresult = (event) => {
      if (event.results && event.results.length > 0 && event.results[0].length > 0) {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setCitySearchTerm(transcript);
          toast({ title: 'City Search Term Transcribed' });
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
  }, [isRecordingCitySearch, toast]);

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
            notes: '',
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
    setConvertedHotLeads(new Set());
    toast({ title: "Hot Leads Cleared", description: "The hot leads list has been cleared from this device." });
  }, [hotLeads.length, toast]);

  const handleDeleteHotLead = useCallback((leadId: string) => {
    setHotLeads(prevHotLeads => {
        const updatedLeads = prevHotLeads.filter(lead => lead.id !== leadId);
        return updatedLeads;
    });
    setConvertedHotLeads(prev => {
        const newSet = new Set(prev);
        newSet.delete(leadId);
        return newSet;
    });
    toast({ title: "Hot Lead Removed" });
  }, [toast]);

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
      if (lead.notes) body += `   Notes: ${lead.notes}\n`;
      body += `   Added: ${format(new Date(lead.addedAt), 'MMM d, yyyy, h:mm a')}\n\n`;
    });
    body += `\n\n---\nEmail generated by Optimum Trailblazer App`;

    const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    if (typeof window !== 'undefined') {
        window.location.href = mailtoLink;
    }
    toast({ title: "Opening email client...", description: "Your hot leads list is ready to be sent." });
  }, [hotLeads, toast]);

  const handleUpdateHotLeadNotes = useCallback((leadId: string, notes: string) => {
    setHotLeads(prevLeads => 
      prevLeads.map(lead => 
        lead.id === leadId ? { ...lead, notes } : lead
      )
    );
  }, []);

  const handleToggleVoiceForHotLead = useCallback((leadId: string) => {
    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({ variant: 'destructive', title: 'Voice Recognition Not Supported' });
      return;
    }
  
    if (isRecordingHotLeadNotes && hotLeadNotesRecognitionRef.current) {
      hotLeadNotesRecognitionRef.current.stop();
      return;
    }
  
    const recognition = new SpeechRecognition();
    hotLeadNotesRecognitionRef.current = recognition;
  
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
  
    recognition.onstart = () => {
      setIsRecordingHotLeadNotes(leadId);
      toast({ title: 'Listening for notes...', description: 'Click the microphone again to stop.' });
    };
  
    recognition.onend = () => {
      setIsRecordingHotLeadNotes(null);
      hotLeadNotesRecognitionRef.current = null;
    };
  
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      toast({ variant: 'destructive', title: 'Voice Error', description: event.error });
      setIsRecordingHotLeadNotes(null);
      hotLeadNotesRecognitionRef.current = null;
    };
  
    recognition.onresult = (event) => {
      let newTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          newTranscript += event.results[i][0].transcript + ' ';
        }
      }
      if (newTranscript) {
        setHotLeads(prevLeads =>
          prevLeads.map(lead =>
            lead.id === leadId
              ? { ...lead, notes: (lead.notes ? `${lead.notes} ${newTranscript.trim()}` : newTranscript.trim()) }
              : lead
          )
        );
        toast({ title: 'Notes Updated' });
      }
    };
  
    try {
      recognition.start();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Could not start recording', description: e.message });
    }
  }, [isRecordingHotLeadNotes, toast]);

  const handleSelectDestination = useCallback(async (city: string) => {
    setIsDestinationModalOpen(false);
    setIsFindingParking(true);
    
    const abbreviatedCity = stateNameToAbbreviation(city);

    toast({ title: "Finding Optimal Parking...", description: `Please wait while Debbie finds the best spot in ${abbreviatedCity}.` });
    try {
        const result = await findOptimalParkingAction({ city: abbreviatedCity });
        if (result.error) throw new Error(result.error);
        
        if (result.latitude && result.longitude) {
            setTargetDestination({ city: abbreviatedCity, description: result.locationDescription || 'Central Business Area' });
            const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${result.latitude},${result.longitude}`;
            setNavigationUrl(googleMapsUrl);
            toast({ title: "Destination Set!", description: `Parking suggestion for ${abbreviatedCity} loaded.` });
        } else {
            throw new Error('AI did not return a valid location.');
        }
    } catch (e: any) {
        toast({ variant: "destructive", title: 'Could Not Find Location', description: e.message || 'An unexpected error occurred.'});
    } finally {
        setIsFindingParking(false);
    }
  }, [toast]);

  const handleDestinationSearch = useCallback(() => {
    if (destinationSearchTerm.trim()) {
        handleSelectDestination(destinationSearchTerm.trim());
        setDestinationSearchTerm('');
    }
  }, [destinationSearchTerm, handleSelectDestination]);

  const handleToggleVoiceDestinationSearch = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({ variant: 'destructive', title: 'Voice Recognition Not Supported' });
      return;
    }

    if (isRecordingDestinationSearch && destinationSearchRecognitionRef.current) {
      destinationSearchRecognitionRef.current.stop();
      return;
    }

    const recognition = new SpeechRecognition();
    destinationSearchRecognitionRef.current = recognition;

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsRecordingDestinationSearch(true);
      toast({ title: 'Listening for destination...' });
    };

    recognition.onend = () => {
      setIsRecordingDestinationSearch(false);
      destinationSearchRecognitionRef.current = null;
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
                setIsRecordingDestinationSearch(false);
                destinationSearchRecognitionRef.current = null;
                return;
            case 'language-not-supported':
                errorMessage = "The language for dictation is not supported by your browser.";
                break;
            case 'bad-grammar':
                errorMessage = "There was a grammar recognition error. This is usually an issue with the recognition service.";
                break;
        }
        toast({ variant: 'destructive', title: 'Voice Recognition Error', description: errorMessage, duration: 9000 });
        setIsRecordingDestinationSearch(false);
        destinationSearchRecognitionRef.current = null;
    };

    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (transcript) {
        const trimmedTranscript = transcript.trim();
        setDestinationSearchTerm(trimmedTranscript);
        handleSelectDestination(trimmedTranscript);
        setDestinationSearchTerm(''); // Clear after initiating search
      }
    };

    try {
      recognition.start();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Could not start recording', description: `Please ensure microphone access is granted. Error: ${e.message}` });
    }
  }, [isRecordingDestinationSearch, toast, handleSelectDestination]);
  
  const handleAddNewsItem = useCallback(() => {
    if (newNewsItem.trim()) {
      setNewsItems(prev => [newNewsItem.trim(), ...prev]);
      setNewNewsItem('');
      toast({ title: 'News Item Added' });
    }
  }, [newNewsItem, toast]);

  const handleDeleteNewsItem = useCallback((indexToDelete: number) => {
    setNewsItems(prev => prev.filter((_, index) => index !== indexToDelete));
    toast({ title: 'News Item Removed' });
  }, [toast]);
  
  const handleAddCompanyDoc = useCallback(() => {
    if (newDocName.trim() && newDocUrl.trim()) {
      try {
        // Validate URL format on client side before adding
        new URL(newDocUrl.trim());
        const newDoc: CompanyDoc = {
          id: crypto.randomUUID(),
          name: newDocName.trim(),
          url: newDocUrl.trim(),
        };
        setCompanyDocs(prev => [...prev, newDoc]);
        setNewDocName('');
        setNewDocUrl('');
        toast({ title: "Document Added", description: `${newDoc.name} has been added to your list.`});
      } catch (e) {
        toast({ variant: 'destructive', title: 'Invalid URL', description: 'Please enter a valid document URL.'});
      }
    } else {
      toast({ variant: 'destructive', title: 'Missing Information', description: 'Please provide both a name and a URL.' });
    }
  }, [newDocName, newDocUrl, toast]);

  const handleDeleteCompanyDoc = useCallback((docId: string) => {
    setCompanyDocs(prev => prev.filter(doc => doc.id !== docId));
    toast({ title: "Document Removed" });
  }, [toast]);

  const handleAnalyzeCompanyDoc = useCallback(async (doc: CompanyDoc) => {
    if (isAiResponding || analyzingDocId) return;
  
    setAnalyzingDocId(doc.id);
  
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      sender: 'user',
      text: `Please analyze the document: "${doc.name}"`,
      timestamp: new Date(),
    };
    setChatMessages(prev => [...prev, userMessage]);
  
    const result = await analyzeDocumentAction({ documentUrl: doc.url });
    let aiTextResponse = '';
  
    if (result.error) {
      aiTextResponse = `I'm sorry, I couldn't analyze the document. Error: ${result.error}`;
      toast({ variant: 'destructive', title: 'Analysis Failed', description: result.error, duration: 7000 });
    } else {
      aiTextResponse = result.summary || "I was able to access the document, but couldn't generate a summary.";
      toast({ title: 'Analysis Complete' });
    }
  
    const aiMessage: ChatMessage = {
      id: crypto.randomUUID(),
      sender: 'ai',
      text: aiTextResponse,
      timestamp: new Date(),
    };
    setChatMessages(prev => [...prev, aiMessage]);
    
    setAnalyzingDocId(null);
  }, [isAiResponding, analyzingDocId, toast]);

  // Effects
  useEffect(() => {
      visitsRef.current = visits;
  }, [visits]);
  
  useEffect(() => {
    try {
      const defaultSalesperson = salespeople.find(s => s.name === 'Lyman') || salespeople[0];
      setSelectedSalesperson(defaultSalesperson);

      const localVisits = localStorage.getItem('visits');
      if (localVisits) {
          const parsedVisits = JSON.parse(localVisits).map((v: any) => {
              // Helper to safely create a Date object
              const toSafeDate = (dateString: any): Date | undefined => {
                  if (!dateString) return undefined;
                  const date = new Date(dateString);
                  // Check if the date is valid. getTime() on an invalid date returns NaN.
                  return isNaN(date.getTime()) ? undefined : date;
              };
              
              return {
                  ...v,
                  timestamp: toSafeDate(v.timestamp) || new Date(), // Fallback to now if timestamp is invalid
                  futureMeetingDateTime: toSafeDate(v.futureMeetingDateTime),
                  freeTrialStartDate: toSafeDate(v.freeTrialStartDate),
              };
          });
          setVisits(parsedVisits);
      }
      
      const storedSuggestions = localStorage.getItem('submittedSuggestions');
      if (storedSuggestions) {
        setSubmittedSuggestions(JSON.parse(storedSuggestions).map((s: any) => ({...s, timestamp: new Date(s.timestamp)})));
      }

      const storedFiles = localStorage.getItem('managedFiles');
      if (storedFiles) setManagedFiles(JSON.parse(storedFiles));
      
      const storedCompanyDocs = localStorage.getItem('companyDocs');
      if (storedCompanyDocs) setCompanyDocs(JSON.parse(storedCompanyDocs));

      const storedHotLeads = localStorage.getItem('hotLeads');
      if (storedHotLeads) {
        setHotLeads(JSON.parse(storedHotLeads).map((hl: any) => ({...hl, addedAt: new Date(hl.addedAt)})));
      }
      
      const storedConvertedHotLeads = localStorage.getItem('convertedHotLeads');
      if (storedConvertedHotLeads) setConvertedHotLeads(new Set(JSON.parse(storedConvertedHotLeads)));
      
      const hasUploadedTerritory = localStorage.getItem('territoryPdfUploaded');
      if (!hasUploadedTerritory) setShowTerritoryUploadModal(true);
      
      const defaultNewsItems = [
          "Please note: No new installs are to be scheduled on Thursdays until further notice.",
          "To compensate, Friday and Tuesday are now fully open for new installations.",
          "We are temporarily out of stock on all i-14 models. Please offer alternatives.",
          "The annual sales competition begins next month! More details to follow."
      ];
      const storedNews = localStorage.getItem('companyNews');
      if (storedNews) {
          setNewsItems(JSON.parse(storedNews));
      } else {
          setNewsItems(defaultNewsItems);
      }

      const startupSequenceDone = sessionStorage.getItem('startupSequenceDone');
      if (!startupSequenceDone) {
          sessionStorage.setItem('startupSequenceDone', 'true');

          const scheduledToday = (localVisits ? JSON.parse(localVisits) : []).filter((visit: Visit) =>
              visit.futureMeetingSet &&
              visit.futureMeetingDateTime &&
              isToday(new Date(visit.futureMeetingDateTime))
          );
          
          if (scheduledToday.length > 0) {
              const firstMeeting = scheduledToday[0];
              if (firstMeeting.latitude && firstMeeting.longitude) {
                  setStartupNavigationTarget({ 
                      companyName: firstMeeting.companyName, 
                      latitude: firstMeeting.latitude, 
                      longitude: firstMeeting.longitude 
                  });
                  setIsStartupNavigationConfirmOpen(true);
              }
          }
      }

    } catch (error) {
      console.error("Failed to load data from localStorage:", error);
      toast({ variant: "destructive", title: "Local Data Corrupted", description: "Could not load saved data from this device. Some data may be missing."});
      localStorage.removeItem('visits'); // Clear corrupted data to prevent future errors
    }
  }, [toast]);
  
  useEffect(() => {
    const handlePositionUpdate = async (position: GeolocationPosition) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        let shouldUpdateCity = false;
        
        if (userCurrentLatitude === undefined || userCurrentLongitude === undefined) {
            shouldUpdateCity = true;
        } else {
            const distance = getDistanceFromLatLonInM(lat, lon, userCurrentLatitude, userCurrentLongitude);
            if (distance > 500) {
                shouldUpdateCity = true;
            }
        }
        
        setUserCurrentLatitude(lat);
        setUserCurrentLongitude(lon);

        if (shouldUpdateCity) {
          setIsFetchingCity(true);
          try {
            const result = await getCompanyNameFromCoordsAction({ latitude: lat, longitude: lon });
            if (result.error) {
              toast({ title: "Location Update Failed", description: result.error, duration: 3000 });
              setCurrentCity(prev => prev || "Location lookup failed");
            } else if (result.city) {
              setCurrentCity(result.city);
            } else {
              setCurrentCity(prev => prev || "Location Unknown");
            }
          } catch (e: any) {
            console.error("Error fetching city:", e);
            setCurrentCity(prev => prev || "Error fetching city.");
          } finally {
            setIsFetchingCity(false);
          }
        } else {
           setIsFetchingCity(false);
        }
    };
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(handlePositionUpdate, (error) => {
        let errorMessage = "Could not retrieve location.";
        if (error.code === error.PERMISSION_DENIED) {
          errorMessage = "Location access denied. Please enable it in your browser settings.";
        }
        toast({ variant: "destructive", title: "Location Error", description: errorMessage });
        setCurrentCity("Location access denied.");
        setIsFetchingCity(false);
      }, { enableHighAccuracy: true });

      locationWatchId.current = navigator.geolocation.watchPosition(handlePositionUpdate, (error) => {
          console.warn("Geolocation watch error:", error.message);
      }, { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 });

    } else {
      toast({ variant: "destructive", title: "Geolocation Not Supported", description: "Your browser does not support this feature." });
      setCurrentCity("Geolocation not supported.");
      setIsFetchingCity(false);
    }
    
    return () => {
        if (locationWatchId.current && navigator.geolocation) {
            navigator.geolocation.clearWatch(locationWatchId.current);
        }
    };
  }, [toast, userCurrentLatitude, userCurrentLongitude]);

  useEffect(() => {
    localStorage.setItem('submittedSuggestions', JSON.stringify(submittedSuggestions));
  }, [submittedSuggestions]);

  useEffect(() => {
    localStorage.setItem('companyDocs', JSON.stringify(companyDocs));
  }, [companyDocs]);

  useEffect(() => {
    localStorage.setItem('hotLeads', JSON.stringify(hotLeads));
  }, [hotLeads]);
  
  useEffect(() => {
    localStorage.setItem('convertedHotLeads', JSON.stringify(Array.from(convertedHotLeads)));
  }, [convertedHotLeads]);

  useEffect(() => {
    localStorage.setItem('companyNews', JSON.stringify(newsItems));
  }, [newsItems]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

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
    const handlePopState = (event: PopStateEvent) => {
      history.pushState(null, '', location.href);

      if (isVisitFormOpen) {
        setIsVisitFormOpen(false);
        setCurrentEditingVisit(undefined);
        setStartDictationOnOpen(false);
        setAddingFutureVisit(false);
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

      if (activeTab !== 'field-day') {
        setActiveTab('field-day');
        return;
      }
    };

    history.pushState(null, '', location.href);
    window.addEventListener('popstate', handlePopState);

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

  // Handlers
  const handleAccordionScroll = (e: React.MouseEvent<HTMLButtonElement>, ref: React.RefObject<HTMLDivElement>) => {
    if (e.currentTarget.getAttribute('data-state') === 'closed') {
      setTimeout(() => {
        ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 200);
    }
  };

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

  const handleQuickLog = async () => {
    if (!userCurrentLatitude || !userCurrentLongitude) {
        toast({
            title: 'Location Not Available',
            description: 'Opening form for manual entry.',
            duration: 3000,
        });
        const todaysVisitsCount = visits.filter((v) => isToday(new Date(v.timestamp))).length;
        const newVisitTemplate: Partial<Visit> = {
            latitude: undefined,
            longitude: undefined,
            timestamp: new Date(),
            visitNumber: todaysVisitsCount + 1,
            companyName: '',
            notes: '',
            decisionMakerContact: '',
        };
        setCurrentEditingVisit(newVisitTemplate as Visit);
        setIsVisitFormOpen(true);
        return;
    }

    let companyName = '';
    let notes = '';
    let phone = '';
    let city: string | undefined = undefined;
    const latitude = userCurrentLatitude;
    const longitude = userCurrentLongitude;

    setIsFetchingCity(true);
    try {
        const result = await getCompanyNameFromCoordsAction({ latitude, longitude });
        if (result.error) {
            toast({ variant: 'destructive', title: 'Location Lookup Failed', description: result.error });
        } else {
            companyName = result.suggestedCompanyName || '';
            notes = result.address ? `Company Address: ${result.address}` : '';
            phone = result.phone || '';
            city = result.city;
        }
    } catch (e: any) {
        console.error('Error fetching company name for quicklog:', e);
        toast({ variant: 'destructive', title: 'Location Lookup Error', description: e.message });
    } finally {
        setIsFetchingCity(false);
    }

    const todaysVisitsCount = visits.filter((v) => isToday(new Date(v.timestamp))).length;
    const newVisitTemplate: Partial<Visit> = {
        latitude: latitude,
        longitude: longitude,
        timestamp: new Date(),
        visitNumber: todaysVisitsCount + 1,
        companyName: companyName,
        city: city,
        notes: notes,
        decisionMakerContact: phone,
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
    const todaysVisitsCount = visits.filter(v => isToday(new Date(v.timestamp))).length;
  
    const newVisitTemplate: Partial<Visit> = {
      companyName: existingVisit.companyName,
      latitude: existingVisit.latitude,
      longitude: existingVisit.longitude,
      contactInfo: existingVisit.contactInfo, 
      city: existingVisit.city,
      notes: `Follow-up to visit on ${formatInTimeZone(new Date(existingVisit.timestamp), 'America/New_York', 'PP')}.`,
      decisionMakerName: existingVisit.decisionMakerName,
      decisionMakerTitle: existingVisit.decisionMakerTitle,
      decisionMakerContact: existingVisit.decisionMakerContact,
      visitNumber: todaysVisitsCount + 1,
    };
    
    setCurrentEditingVisit(newVisitTemplate as Visit);
    setIsVisitFormOpen(true);
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
    const todaysVisitsForReport = visits.filter(v => isToday(new Date(v.timestamp)));
    const numberOfVisits = todaysVisitsForReport.length;

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
      const result = await saveDailyReportAction(todaysVisitsForReport);

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
    
    if (todaysVisits.length > 0) {
      body += `Summary of Visits (${todaysVisits.length} total):\n`;
      todaysVisits.forEach((visit, index) => {
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
    let csvDataForAi: string | undefined = csvDataForAi;
    
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
        newsItems: newsItems,
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

  const handleAddFoundCompanyAsVisit = (visitData: Partial<Visit>) => {
    const existingVisitForCompany = visits.find((visit) => {
        if (visit.companyName !== visitData.companyName) return false;
        if (!visit.latitude || !visit.longitude || !visitData.latitude || !visitData.longitude) return false;
        
        return getDistanceFromLatLonInM(
            visitData.latitude,
            visitData.longitude,
            visit.latitude,
            visit.longitude
        ) < 50;
    });

    if (existingVisitForCompany) {
      toast({
        title: 'Visit Already Exists',
        description: `A visit for ${visitData.companyName} is already in your planner or history.`,
      });
      return;
    }

    const todaysVisitsCount = visits.filter(v => isToday(new Date(v.timestamp))).length;
    
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 1);
    futureDate.setHours(10, 0, 0, 0);

    const newVisit: Visit = {
        id: `temp_${crypto.randomUUID()}`,
        timestamp: new Date(),
        companyName: visitData.companyName || '',
        city: visitData.city,
        notes: visitData.notes,
        latitude: visitData.latitude,
        longitude: visitData.longitude,
        contactInfo: undefined,
        notesSummary: undefined,
        partnershipConfidence: undefined,
        hasBusinessCard: false,
        businessCardImageFrontUrl: undefined,
        businessCardImageBackUrl: undefined,
        discussedCompetitors: false,
        competitorName: undefined,
        coolerType: undefined,
        decisionMakerName: '',
        decisionMakerTitle: '',
        decisionMakerContact: visitData.decisionMakerContact || '',
        visitNumber: todaysVisitsCount + 1,
        interestedUnits: undefined,
        hasTDSReading: false,
        tdsValue: undefined,
        futureMeetingSet: true,
        futureMeetingDateTime: futureDate,
        freeTrial: false,
        freeTrialStartDate: undefined,
        dealClosed: false,
        pricingDiscussed: false,
        priceQuoted: undefined,
        leaseTerm: undefined,
        installationFee: undefined,
        creditApproved: false,
        manualCommission: undefined,
    };
    
    setVisits(prevVisits => {
        const newVisits = [newVisit, ...prevVisits];
        localStorage.setItem('visits', JSON.stringify(newVisits));
        return newVisits;
    });

    toast({
        title: "Added to Planner",
        description: `${newVisit.companyName} has been scheduled for a future visit.`,
    });
  };

  const handleManagedFilesChange = (files: ManagedFile[]) => {
      setManagedFiles(files);
      localStorage.setItem('managedFiles', JSON.stringify(files));
  };

  const handleDictateNotes = (visit: Visit) => {
    setCurrentEditingVisit(visit);
    setStartDictationOnOpen(true);
    setIsVisitFormOpen(true);
  };

  const handleAddHotLeadAsVisit = (lead: HotLead) => {
    if (convertedHotLeads.has(lead.id)) return;
    
    const existingVisitForCompany = visits.find((visit) => {
        if (visit.companyName !== lead.companyName) return false;
        if (!visit.latitude || !visit.longitude || !lead.latitude || !lead.longitude) return false;
        return getDistanceFromLatLonInM(
            lead.latitude,
            lead.longitude,
            visit.latitude,
            visit.longitude
          ) < 50;
    });

    if (existingVisitForCompany) {
      toast({
        title: 'Visit Already Exists',
        description: `A visit for ${lead.companyName} is already in your planner or history.`,
      });
      setConvertedHotLeads((prev) => new Set(prev).add(lead.id));
      return;
    }

    const todaysVisitsCount = visits.filter(v => isToday(new Date(v.timestamp))).length;
  
    const newVisit: Visit = {
      id: `temp_${crypto.randomUUID()}`,
      timestamp: new Date(),
      companyName: lead.companyName,
      city: lead.city,
      latitude: lead.latitude,
      longitude: lead.longitude,
      notes: `Address: ${lead.address}\n\nHot Lead Notes:\n${lead.notes || 'No notes.'}`.trim(),
      decisionMakerContact: lead.phone,
      visitNumber: todaysVisitsCount + 1,
      futureMeetingSet: true,
      futureMeetingDateTime: undefined,
      partnershipConfidence: undefined,
      hasBusinessCard: false,
      businessCardImageFrontUrl: undefined,
      businessCardImageBackUrl: undefined,
      discussedCompetitors: false,
      competitorName: undefined,
      coolerType: undefined,
      decisionMakerName: '',
      decisionMakerTitle: '',
      interestedUnits: undefined,
      hasTDSReading: false,
      tdsValue: undefined,
      freeTrial: false,
      freeTrialStartDate: undefined,
      dealClosed: false,
      contactInfo: undefined,
      notesSummary: undefined,
      pricingDiscussed: false,
      priceQuoted: undefined,
      leaseTerm: undefined,
      installationFee: undefined,
      creditApproved: false,
      manualCommission: undefined,
    };
    
    setVisits(prevVisits => {
        const newVisits = [newVisit, ...prevVisits];
        localStorage.setItem('visits', JSON.stringify(newVisits));
        return newVisits;
    });
    
    setConvertedHotLeads(prev => new Set(prev).add(lead.id));

    toast({
        title: "Added to Planner",
        description: `${lead.companyName} has been added to future visits to be scheduled.`,
    });
  };

  const handleHotspotCreation = useCallback(async () => {
    toast({ title: "Flagging Hotspot...", description: "Getting your current location." });

    if (!navigator.geolocation) {
        toast({ variant: "destructive", title: "Geolocation Not Supported", description: "Could not access location services." });
        return;
    }

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const { latitude, longitude } = position.coords;
            const flagToast = toast({ title: "Location Captured!", description: `Identifying nearby business...` });

            try {
                const result = await getCompanyNameFromCoordsAction({ latitude, longitude });
                if (result.error) {
                    throw new Error(result.error);
                }

                const companyName = result.suggestedCompanyName || 'Flagged Hotspot';
                
                const existingVisitForCompany = visits.find((visit) => {
                    if (visit.companyName !== companyName) return false;
                    if (!visit.latitude || !visit.longitude) return false;
                    return getDistanceFromLatLonInM(
                        latitude,
                        longitude,
                        visit.latitude,
                        visit.longitude
                      ) < 50;
                });

                if (existingVisitForCompany) {
                  flagToast.dismiss();
                  toast({
                    title: 'Visit Already Exists',
                    description: `A visit for ${companyName} is already in your planner or history.`,
                  });
                  return;
                }

                const newVisit: Visit = {
                    id: `temp_${crypto.randomUUID()}`,
                    timestamp: new Date(),
                    companyName: companyName,
                    city: result.city,
                    notes: `Flagged as a hotspot. Address: ${result.address || 'Unknown'}`.trim(),
                    latitude: latitude,
                    longitude: longitude,
                    contactInfo: undefined,
                    notesSummary: undefined,
                    partnershipConfidence: undefined,
                    hasBusinessCard: false,
                    businessCardImageFrontUrl: undefined,
                    businessCardImageBackUrl: undefined,
                    discussedCompetitors: false,
                    competitorName: undefined,
                    coolerType: undefined,
                    decisionMakerName: '',
                    decisionMakerTitle: '',
                    decisionMakerContact: result.phone || '',
                    visitNumber: undefined,
                    interestedUnits: undefined,
                    hasTDSReading: false,
                    tdsValue: undefined,
                    futureMeetingSet: true,
                    futureMeetingDateTime: undefined,
                    freeTrial: false,
                    freeTrialStartDate: undefined,
                    dealClosed: false,
                    pricingDiscussed: false,
                    priceQuoted: undefined,
                    leaseTerm: undefined,
                    installationFee: undefined,
                    creditApproved: false,
                    manualCommission: undefined,
                };
                
                setVisits(prevVisits => {
                    const newVisits = [newVisit, ...prevVisits];
                    localStorage.setItem('visits', JSON.stringify(newVisits));
                    return newVisits;
                });

                flagToast.update({ id: flagToast.id, title: "Hotspot Flagged!", description: `${newVisit.companyName} added to your Planner for a future visit.` });

            } catch (e: any) {
                 flagToast.dismiss();
                 toast({ variant: "destructive", title: "Could Not Flag Hotspot", description: e.message });
            }
        },
        (error) => {
            let errorMessage = "Could not get your current location.";
            if (error.code === error.PERMISSION_DENIED) {
              errorMessage = "Location access has been denied.";
            }
            toast({ variant: "destructive", title: "Location Error", description: errorMessage });
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [visits, toast]);

  const handleConfirmStartupNavigation = async () => {
    if (!startupNavigationTarget) return;
  
    const { latitude, longitude, companyName } = startupNavigationTarget;
  
    const result = await getCompanyNameFromCoordsAction({ latitude, longitude });
    const city = result.city || "Destination";
    
    setTargetDestination({ city: city, description: `Navigating directly to ${companyName}.` });
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
    setNavigationUrl(googleMapsUrl);
    toast({ title: "Destination Set!", description: `Check the navigator to get directions to ${companyName}.` });
  
    setStartupNavigationTarget(null);
    setIsStartupNavigationConfirmOpen(false);
  };
  
  const handleAddNewFutureVisit = () => {
    setAddingFutureVisit(true);
    setCurrentEditingVisit({
      id: `temp_${crypto.randomUUID()}`,
      timestamp: new Date(),
      companyName: '',
      futureMeetingSet: true,
      futureMeetingDateTime: undefined,
    } as Visit);
    setIsVisitFormOpen(true);
  };

  const handleScheduleFromCalendar = () => {
    if (!selectedDate) return;

    const meetingDateTime = new Date(selectedDate);
    meetingDateTime.setHours(9, 0, 0, 0); // Default to 9 AM

    setAddingFutureVisit(true);
    setCurrentEditingVisit({
      id: `temp_${crypto.randomUUID()}`,
      timestamp: new Date(),
      companyName: '',
      futureMeetingSet: true,
      futureMeetingDateTime: meetingDateTime,
    } as Visit);
    setIsVisitFormOpen(true);
  };

  return (
    <div className="min-h-screen">
      <TerritoryUploadModal 
        isOpen={showTerritoryUploadModal}
        onClose={() => setShowTerritoryUploadModal(false)}
      />
      <div className="container mx-auto px-4 pt-2 pb-8 sm:px-6 lg:px-8 space-y-8">
        <header className="flex flex-col items-center justify-center w-full pt-4 gap-2">
          <h1 className="text-6xl sm:text-8xl font-headline font-bold text-center aurora-text drop-shadow-lg">
            Optimum Trailblazer
          </h1>
          {selectedSalesperson && (
            <div className="w-full max-w-lg mx-auto">
              <div className="text-center font-semibold text-lg text-primary mb-2">Navigator</div>
              
              <div className="flex justify-center items-center text-md font-medium text-foreground my-2">
                {isFetchingCity ? (
                  <div className="flex justify-center items-center text-sm text-muted-foreground my-2">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    <span>Determining current city...</span>
                  </div>
                ) : (
                  currentCity && (
                    <>
                      <MapPin className="mr-2 h-4 w-4 text-primary" />
                      <span>Currently Located: {currentCity}</span>
                    </>
                  )
                )}
              </div>

              <Accordion type="single" collapsible className="w-full">
                <AccordionItem ref={dailyPlanRef} value="daily-plan" className="border-none">
                  <AccordionTrigger onClick={(e) => handleAccordionScroll(e, dailyPlanRef)} className={cn("p-3 bg-primary/10 backdrop-blur-sm rounded-lg border border-primary/20 hover:no-underline data-[state=open]:rounded-b-none", "bluish-glow")}>
                    <div className="flex items-center justify-between w-full gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <User className="h-5 w-5 text-primary flex-shrink-0" />
                        <div className="flex flex-col items-start">
                          <span className="font-semibold text-foreground truncate">{selectedSalesperson.name}</span>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground flex items-center gap-2 shrink-0">
                        <CalendarIcon className="h-3 w-3" />
                        {format(new Date(), 'MMM d, yyyy')}
                      </span>
                      <div className="flex justify-end min-w-[80px]">
                        {targetDestination && (
                            <Badge variant="secondary" className="shrink-0">{stateNameToAbbreviation(targetDestination.city)}</Badge>
                        )}
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="flex flex-col justify-center items-center gap-4 p-4 bg-primary/10 backdrop-blur-sm rounded-b-lg border border-primary/20 border-t-0">
                      {todaysScheduledVisits.length > 0 && (
                          <Alert
                            variant="default"
                            className={cn(
                              "border-primary/50 bg-primary/10 text-left w-full",
                              todaysScheduledVisits.length === 1 && "cursor-pointer transition-colors hover:bg-primary/20"
                            )}
                            onClick={() => {
                              if (todaysScheduledVisits.length === 1) {
                                setZoomedVisit(todaysScheduledVisits[0]);
                              }
                            }}
                          >
                            <CalendarCheck className="h-4 w-4" />
                            <AlertTitle className="font-semibold text-primary">You have {todaysScheduledVisits.length} meeting(s) scheduled for today!</AlertTitle>
                            <AlertDescription>
                              {todaysScheduledVisits.length === 1 ? (
                                todaysScheduledVisits[0].companyName
                              ) : (
                                <div className="flex flex-wrap items-center gap-x-1">
                                  {todaysScheduledVisits.map((v, index) => (
                                    <div key={v.id} className="inline-flex items-center">
                                      <Button
                                        variant="link"
                                        className="p-0 h-auto text-sm text-foreground hover:text-primary font-normal"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setZoomedVisit(v);
                                        }}
                                      >
                                        {v.companyName}
                                      </Button>
                                      {index < todaysScheduledVisits.length - 1 && <span className="text-sm text-muted-foreground">,</span>}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </AlertDescription>
                          </Alert>
                        )}
                      
                      <Button variant="default" onClick={() => handleChangeDestination()} className="w-full">
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
                          <MapIcon className="mr-2 h-4 w-4" />
                          Navigate
                        </Button>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          )}
        </header>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6 mb-2 bg-primary/10 backdrop-blur-sm p-1 rounded-full border border-primary/20 mt-2">
            <TabsTrigger value="field-day" className="rounded-full border-transparent data-[state=active]:bg-primary/20 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg flex items-center justify-center gap-2">
              <PlusCircle className="h-5 w-5" />
              <span className="hidden sm:inline">Field Day</span>
            </TabsTrigger>
            <TabsTrigger value="planner" className="rounded-full border-transparent data-[state=active]:bg-primary/20 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg flex items-center justify-center gap-2">
              <FolderKanban className="h-5 w-5" />
              <span className="hidden sm:inline">Planner</span>
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

                {todaysVisits.length === 0 ? (
                    <div className="text-center py-10 bg-card rounded-lg shadow-lg px-4">
                      <p className="text-xl text-muted-foreground mb-4">No visits logged yet for field day.</p>
                      <p className="text-muted-foreground mb-4">
                          Click <span className="inline-block bg-primary text-primary-foreground px-2 py-1 rounded-md text-xs font-semibold">Quicklog Visit</span> to instantly create a new visit at your current location, pre-filled with company details when possible.
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
                  <Accordion 
                    type="single" 
                    collapsible
                    className="w-full space-y-4"
                    value={fieldDayAccordionValue}
                    onValueChange={setFieldDayAccordionValue}
                  >
                    {todaysVisits.map((visit) => (
                      <AccordionItem value={visit.id} key={visit.id} className={cn("border bg-card rounded-lg overflow-hidden", visit.dealClosed ? "border-green-500" : "border-primary/20")}>
                        <AccordionTrigger className={cn("p-4 hover:no-underline w-full text-left [&[data-state=open]]:border-b", visit.dealClosed ? "[&[data-state=open]]:border-green-500" : "[&[data-state=open]]:border-primary/20")}>
                           <div className="flex flex-1 items-center justify-between min-w-0 gap-4">
                              <div className="flex flex-1 items-center gap-3 min-w-0">
                                <span className={cn("h-3 w-3 rounded-full shrink-0", visit.dealClosed ? "bg-green-500" : "bg-primary")}></span>
                                <h4 className="font-semibold text-foreground truncate" title={visit.companyName}>{visit.companyName}</h4>
                              </div>
                              <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
                                {(visit.interestedUnits && visit.interestedUnits.length > 0) ? (
                                    <span className="text-sm text-primary font-medium truncate">{`{${visit.interestedUnits[0].split('(')[0].trim()}${visit.interestedUnits.length > 1 ? `, +${visit.interestedUnits.length - 1}` : ''}}`}</span>
                                ) : (
                                    <span>{format(new Date(visit.timestamp), 'h:mm a')}</span>
                                )}
                                {visit.partnershipConfidence && (
                                  <Badge variant="outline" className="flex items-center gap-1 px-1.5 py-0.5 border-transparent bg-transparent">
                                    <span className="leading-none">{visit.partnershipConfidence}</span>
                                    <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                                  </Badge>
                                )}
                                {visit.futureMeetingSet && (
                                  <CalendarCheck className={cn("h-4 w-4", visit.freeTrial ? "text-orange-500" : "text-green-500")} />
                                )}
                              </div>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="p-4">
                          <VisitCard
                            visit={visit}
                            onEdit={handleEditVisit}
                            onDelete={handleDeleteVisit}
                            onUpdateDealClosed={handleUpdateDealClosed}
                            onZoom={setZoomedVisit}
                            onLogFollowUp={handleLogFollowUp}
                            onDictateNotes={handleDictateNotes}
                          />
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                )}
            </div>
          )}
          
          {activeTab === 'call-day' && (
            <div className="space-y-6">
              <Accordion type="single" collapsible className="w-full max-w-sm mx-auto">
                <AccordionItem ref={callDayFilterRef} value="item-1" className="border-none">
                  <AccordionTrigger onClick={(e) => handleAccordionScroll(e, callDayFilterRef)} className={cn("p-4 bg-card rounded-lg shadow-lg hover:no-underline data-[state=open]:rounded-b-none", "bluish-glow")}>
                    <div className="flex items-center justify-center w-full">
                      <div className="flex items-center justify-center gap-2">
                        <ListFilter className="h-5 w-5 text-primary" />
                        <h3 className="text-lg font-medium text-foreground text-center">
                            Filter & Sort
                        </h3>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="bg-card/60 backdrop-blur-sm border border-primary/20 rounded-b-lg shadow-lg border-t-0 p-4">
                    <div className="flex flex-col gap-6 items-center">
                      <div className="flex flex-col items-center w-full">
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={setSelectedDate}
                          className="rounded-md border self-center"
                          modifiers={{
                            logged: loggedPastVisitDays,
                            scheduled: scheduledFutureVisitDays,
                            dealClosed: dealClosedDays,
                            trialEnd: trialEndDays,
                          }}
                          modifiersClassNames={{
                            scheduled: 'day-scheduled',
                            logged: 'day-logged-past',
                            dealClosed: 'day-deal-closed',
                            today: 'day_today',
                            trialEnd: 'day-trial-end',
                          }}
                        />
                        {selectedDate && (
                          <div className="w-full mt-2 space-y-2">
                              <Button
                                  onClick={handleScheduleFromCalendar}
                                  className="w-full"
                                  size="sm"
                              >
                                  <PlusSquare className="mr-2 h-4 w-4" />
                                  Schedule on {format(selectedDate, 'MMM d')}
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => setSelectedDate(undefined)} className="w-full">
                                  Clear Date Filter
                              </Button>
                          </div>
                        )}
                      </div>

                      <Accordion type="single" collapsible className="w-full max-w-sm">
                        <AccordionItem value="sorters" className="border-b-0">
                          <AccordionTrigger className="text-sm">
                            <div className="flex items-center justify-center w-full">Sort Options</div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="flex flex-col sm:flex-row gap-4 items-center w-full pt-2">
                              <div className="flex flex-col gap-1.5 w-full sm:w-auto flex-1">
                                <Label htmlFor="sort-criteria" className="text-sm text-center">Sort Visit Cards By</Label>
                                <Select
                                  value={sortCriteria}
                                  onValueChange={(value) => {
                                    setSortCriteria(value as any);
                                    if (value !== 'city') {
                                        setCitySearchTerm('');
                                    }
                                  }}
                                >
                                  <SelectTrigger id="sort-criteria" className="w-full">
                                    <SelectValue placeholder="Select criteria" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="partnershipConfidence">Partnership Confidence</SelectItem>
                                    <SelectItem value="timestamp">Date Visited</SelectItem>
                                    <SelectItem value="city">Town/City</SelectItem>
                                    <SelectItem value="dealClosed">Closed Deals</SelectItem>
                                    <SelectItem value="futureMeetingsSet">Future Meetings Set</SelectItem>
                                    <SelectItem value="inTrial">In Trial</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              {sortCriteria === 'city' ? (
                                <div className="flex flex-col gap-1.5 w-full sm:w-auto flex-1">
                                    <Label htmlFor="city-search" className="text-sm text-center">Search by City</Label>
                                    <div className="relative w-full">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                        id="city-search"
                                        type="text"
                                        placeholder={isRecordingCitySearch ? "Listening..." : "Type a city..."}
                                        className="pl-10 pr-20"
                                        value={citySearchTerm}
                                        onChange={(e) => setCitySearchTerm(e.target.value)}
                                        disabled={isRecordingCitySearch}
                                        />
                                        {citySearchTerm && !isRecordingCitySearch && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setCitySearchTerm('')}
                                            className="absolute right-10 top-1/2 -translate-y-1/2 h-8 w-8"
                                            aria-label="Clear city search"
                                            title="Clear city search"
                                        >
                                            <X className="h-4 w-4 text-muted-foreground" />
                                        </Button>
                                        )}
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={handleToggleVoiceCitySearch}
                                            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                                            aria-label="Search city with voice"
                                            title="Search city with voice"
                                        >
                                        {isRecordingCitySearch ? (
                                            <Mic className="h-4 w-4 text-red-500 animate-pulse" />
                                        ) : (
                                            <Mic className="h-4 w-4 text-muted-foreground" />
                                        )}
                                        </Button>
                                    </div>
                                </div>
                              ) : (
                                <div className="flex flex-col gap-1.5 w-full sm:w-auto flex-1">
                                  <Label htmlFor="sort-order" className="text-sm text-center">Order</Label>
                                  <Select
                                    value={sortOrder}
                                    onValueChange={(value) => setSortOrder(value as 'asc' | 'desc')}
                                  >
                                    <SelectTrigger id="sort-order" className="w-full">
                                      <SelectValue placeholder="Select order" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {sortCriteria === 'city' ? (
                                        <> <SelectItem value="asc">A-Z</SelectItem> <SelectItem value="desc">Z-A</SelectItem> </>
                                      ) : sortCriteria === 'futureMeetingsSet' ? (
                                        <> <SelectItem value="desc">Newest Meeting</SelectItem> <SelectItem value="asc">Oldest Meeting</SelectItem> </>
                                      ) : sortCriteria === 'inTrial' ? (
                                        <> <SelectItem value="desc">Newest Trial First</SelectItem> <SelectItem value="asc">Oldest Trial First</SelectItem> </>
                                      ) : sortCriteria === 'dealClosed' ? (
                                        <> <SelectItem value="desc">Newest to Oldest</SelectItem> <SelectItem value="asc">Oldest to Newest</SelectItem> </>
                                      ) : sortCriteria === 'timestamp' ? (
                                        <> <SelectItem value="desc">Newest to Oldest</SelectItem> <SelectItem value="asc">Oldest to Newest</SelectItem> </>
                                      ) : ( // Default is partnershipConfidence
                                        <> <SelectItem value="desc">High to Low</SelectItem> <SelectItem value="asc">Low to High</SelectItem> </>
                                      )}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <div className="relative w-full max-w-sm mx-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={isRecordingSearch ? "Listening for search term..." : "Search company name..."}
                  className="pl-10 pr-20"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  disabled={isRecordingSearch}
                />
                {searchTerm && !isRecordingSearch && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-10 top-1/2 -translate-y-1/2 h-8 w-8"
                    aria-label="Clear search"
                    title="Clear search"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleToggleVoiceSearch}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                  aria-label="Search with voice"
                  title="Search with voice"
                >
                  {isRecordingSearch ? (
                    <Mic className="h-4 w-4 text-red-500 animate-pulse" />
                  ) : (
                    <Mic className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              
              {sortedVisitsForCallDay.length === 0 ? (
                <div className="text-center py-10 bg-card rounded-lg shadow-lg">
                  <p className="text-xl text-muted-foreground mb-4">
                    {(() => {
                      if (!selectedDate) {
                        return 'Select a date to see visits.';
                      }
                      const today = startOfDay(new Date());
                      if (new Date(selectedDate) < today) {
                        return `No visits logged on ${format(selectedDate, 'PPP')}.`;
                      }
                      return `No visits logged or scheduled on ${format(selectedDate, 'PPP')}.`;
                    })()}
                  </p>
                </div>
              ) : (
                <CallDayVisitList 
                  visits={sortedVisitsForCallDay}
                  onEdit={handleEditVisit}
                  onDelete={handleDeleteVisit}
                  onUpdateDealClosed={handleUpdateDealClosed}
                  onZoom={setZoomedVisit}
                  onLogFollowUp={handleLogFollowUp}
                  onDictateNotes={handleDictateNotes}
                />
              )}
            </div>
          )}

          {activeTab === 'planner' && (
            <div className="space-y-8">
              <Accordion type="multiple" className="w-full space-y-4">
                <AccordionItem ref={scheduledVisitsRef} value="scheduled-visits" className="border-none">
                   <AccordionTrigger onClick={(e) => handleAccordionScroll(e, scheduledVisitsRef)} className={cn("p-4 bg-card rounded-lg shadow-lg hover:no-underline data-[state=open]:rounded-b-none data-[state=open]:mb-0", "bluish-glow")}>
                      <div className="flex w-full items-center">
                        <div className="flex items-center justify-start w-10 shrink-0">
                            <CalendarCheck className="h-7 w-7 text-primary" />
                        </div>
                        <h2 id="scheduled-visits-title" className="text-2xl font-headline font-semibold text-foreground text-center flex-1">
                            Future Meetings
                        </h2>
                        <div className="w-10 shrink-0"></div>
                      </div>
                   </AccordionTrigger>
                  <AccordionContent className="bg-card/60 backdrop-blur-sm border border-primary/20 rounded-b-lg shadow-lg border-t-0 p-6">
                    <div className="flex justify-center mb-4">
                      <Button onClick={(e) => { e.stopPropagation(); handleAddNewFutureVisit(); }} variant="default" size="sm">
                          <PlusCircle className="mr-2 h-4 w-4" />
                          Add New Future Visit
                      </Button>
                    </div>
                    {scheduledVisits.length === 0 ? (
                        <div className="text-center py-4">
                            <p className="text-xl text-muted-foreground mb-4">
                                No meetings with a specific date scheduled.
                            </p>
                            <p className="text-muted-foreground">
                                When you set a future meeting date on a visit card, it will appear here.
                            </p>
                        </div>
                    ) : (
                       <Accordion type="multiple" className="w-full space-y-4">
                          {scheduledVisits.map((visit) => (
                              <AccordionItem value={`planner-scheduled-${visit.id}`} key={visit.id} className="border border-orange-500/50 bg-card rounded-lg overflow-hidden">
                                  <AccordionTrigger className="p-4 hover:no-underline w-full text-left [&[data-state=open]]:border-b [&[data-state=open]]:border-orange-500/50">
                                      <div className="flex flex-1 items-center justify-between min-w-0 gap-4">
                                          <div className="flex flex-1 items-center gap-3 min-w-0">
                                              <span className={cn("h-3 w-3 rounded-full shrink-0", visit.dealClosed ? "bg-green-500" : "bg-orange-500")}></span>
                                              <h4 className="font-semibold text-foreground truncate" title={visit.companyName}>{visit.companyName}</h4>
                                          </div>
                                          <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
                                              {(visit.interestedUnits && visit.interestedUnits.length > 0) ? (
                                                  <span className="text-sm text-primary font-medium truncate">{`{${visit.interestedUnits[0].split('(')[0].trim()}${visit.interestedUnits.length > 1 ? `, +${visit.interestedUnits.length-1}`: ''}}`}</span>
                                              ) : (
                                                  visit.futureMeetingDateTime && (
                                                      <span>{format(new Date(visit.futureMeetingDateTime), 'MMM d, yy')}</span>
                                                  )
                                              )}
                                              {visit.partnershipConfidence && (
                                                  <Badge variant="outline" className="flex items-center gap-1 px-1.5 py-0.5 border-transparent bg-transparent">
                                                      <span className="leading-none">{visit.partnershipConfidence}</span>
                                                      <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                                                  </Badge>
                                              )}
                                          </div>
                                      </div>
                                  </AccordionTrigger>
                                  <AccordionContent className="p-0">
                                      <VisitCard
                                          visit={visit}
                                          onEdit={handleEditVisit}
                                          onDelete={handleDeleteVisit}
                                          onUpdateDealClosed={handleUpdateDealClosed}
                                          onZoom={setZoomedVisit}
                                          onLogFollowUp={handleLogFollowUp}
                                          onDictateNotes={handleDictateNotes}
                                          variant="planner"
                                      />
                                  </AccordionContent>
                              </AccordionItem>
                          ))}
                      </Accordion>
                    )}
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem ref={unscheduledVisitsRef} value="unscheduled-visits" className="border-none">
                  <AccordionTrigger onClick={(e) => handleAccordionScroll(e, unscheduledVisitsRef)} className={cn("p-4 bg-card rounded-lg shadow-lg hover:no-underline data-[state=open]:rounded-b-none data-[state=open]:mb-0", "bluish-glow")}>
                    <div className="flex w-full items-center">
                        <div className="flex items-center justify-start w-10 shrink-0">
                          <CalendarIcon className="h-7 w-7 text-primary" />
                        </div>
                        <h2 id="unscheduled-visits-title" className="text-2xl font-headline font-semibold text-foreground text-center flex-1">
                              Future Visits (Unscheduled)
                        </h2>
                        <div className="w-10 shrink-0"></div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="bg-card/60 backdrop-blur-sm border border-primary/20 rounded-b-lg shadow-lg border-t-0 p-6">
                    {unscheduledFutureVisits.length === 0 ? (
                        <div className="text-center py-4">
                            <p className="text-xl text-muted-foreground mb-4">
                                No other unscheduled future visits.
                            </p>
                            <p className="text-muted-foreground">
                                Convert a "Hot Lead" from the Debbie tab to add it here.
                            </p>
                        </div>
                    ) : (
                      <Accordion type="multiple" className="w-full space-y-4">
                          {unscheduledFutureVisits.map((visit) => (
                              <AccordionItem value={`planner-unscheduled-${visit.id}`} key={visit.id} className="border border-orange-500/50 bg-card rounded-lg overflow-hidden">
                                  <AccordionTrigger className="p-4 hover:no-underline w-full text-left [&[data-state=open]]:border-b [&[data-state=open]]:border-orange-500/50">
                                      <div className="flex flex-1 items-center justify-between min-w-0 gap-4">
                                          <div className="flex flex-1 items-center gap-3 min-w-0">
                                              <span className={cn("h-3 w-3 rounded-full shrink-0", visit.dealClosed ? "bg-green-500" : "bg-orange-500")}></span>
                                              <h4 className="font-semibold text-foreground truncate" title={visit.companyName}>{visit.companyName}</h4>
                                          </div>
                                          <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
                                              {(visit.interestedUnits && visit.interestedUnits.length > 0) ? (
                                                <span className="text-sm text-primary font-medium truncate">{`{${visit.interestedUnits[0].split('(')[0].trim()}${visit.interestedUnits.length > 1 ? `, +${visit.interestedUnits.length - 1}` : ''}}`}</span>
                                              ) : (
                                                <span>Added: {format(new Date(visit.timestamp), 'MMM d, yy')}</span>
                                              )}
                                              {visit.partnershipConfidence && (
                                                  <Badge variant="outline" className="flex items-center gap-1 px-1.5 py-0.5 border-transparent bg-transparent">
                                                      <span className="leading-none">{visit.partnershipConfidence}</span>
                                                      <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                                                  </Badge>
                                              )}
                                          </div>
                                      </div>
                                  </AccordionTrigger>
                                  <AccordionContent className="p-0">
                                      <VisitCard
                                          visit={visit}
                                          onEdit={handleEditVisit}
                                          onDelete={handleDeleteVisit}
                                          onUpdateDealClosed={handleUpdateDealClosed}
                                          onZoom={setZoomedVisit}
                                          onLogFollowUp={handleLogFollowUp}
                                          onDictateNotes={handleDictateNotes}
                                          variant="planner"
                                      />
                                  </AccordionContent>
                              </AccordionItem>
                          ))}
                      </Accordion>
                    )}
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem ref={flaggedHotspotsRef} value="flagged-hotspots" className="border-none">
                  <AccordionTrigger onClick={(e) => handleAccordionScroll(e, flaggedHotspotsRef)} className={cn("p-4 bg-card rounded-lg shadow-lg hover:no-underline data-[state=open]:rounded-b-none data-[state=open]:mb-0", "bluish-glow")}>
                      <div className="flex w-full items-center">
                        <div className="flex items-center justify-start w-10 shrink-0">
                          <Flame className="h-7 w-7 text-orange-500" />
                        </div>
                        <h2 id="hotspots-title" className="text-2xl font-headline font-semibold text-foreground text-center flex-1">
                              Flagged Hotspots
                        </h2>
                        <div className="w-10 shrink-0"></div>
                      </div>
                  </AccordionTrigger>
                  <AccordionContent className="bg-card/60 backdrop-blur-sm border border-primary/20 rounded-b-lg shadow-lg border-t-0 p-6">
                      {flaggedHotspots.length === 0 ? (
                          <div className="text-center py-4">
                              <p className="text-xl text-muted-foreground mb-4">
                                  No hotspots flagged yet.
                              </p>
                              <p className="text-muted-foreground">
                                Use the "Flag Hotspot" button <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground shadow-md align-middle"><Flame className="h-4 w-4" /></span> to mark locations that look promising while you are driving but have other arrangements.
                              </p>
                          </div>
                      ) : (
                           <Accordion type="multiple" className="w-full space-y-4">
                              {flaggedHotspots.map((visit) => (
                                  <AccordionItem value={`planner-hotspot-${visit.id}`} key={visit.id} className="border border-orange-500/50 bg-card rounded-lg overflow-hidden">
                                      <AccordionTrigger className="p-4 hover:no-underline w-full text-left [&[data-state=open]]:border-b [&[data-state=open]]:border-orange-500/50">
                                          <div className="flex flex-1 items-center justify-between min-w-0 gap-4">
                                              <div className="flex flex-1 items-center gap-3 min-w-0">
                                                  <span className={cn("h-3 w-3 rounded-full shrink-0", visit.dealClosed ? "bg-green-500" : "bg-orange-500")}></span>
                                                  <h4 className="font-semibold text-foreground truncate" title={visit.companyName}>{visit.companyName}</h4>
                                              </div>
                                              <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
                                                  {(visit.interestedUnits && visit.interestedUnits.length > 0) ? (
                                                    <span className="text-sm text-primary font-medium truncate">{`{${visit.interestedUnits[0].split('(')[0].trim()}${visit.interestedUnits.length > 1 ? `, +${visit.interestedUnits.length - 1}` : ''}}`}</span>
                                                  ) : (
                                                    <span>Flagged: {format(new Date(visit.timestamp), 'MMM d, yy')}</span>
                                                  )}
                                              </div>
                                          </div>
                                      </AccordionTrigger>
                                      <AccordionContent className="p-0">
                                          <VisitCard
                                              visit={visit}
                                              onEdit={handleEditVisit}
                                              onDelete={handleDeleteVisit}
                                              onUpdateDealClosed={handleUpdateDealClosed}
                                              onZoom={setZoomedVisit}
                                              onLogFollowUp={handleLogFollowUp}
                                              onDictateNotes={handleDictateNotes}
                                              variant="planner"
                                          />
                                      </AccordionContent>
                                  </AccordionItem>
                              ))}
                          </Accordion>
                      )}
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem ref={activeFreeTrialsRef} value="active-free-trials" className="border-none">
                  <AccordionTrigger onClick={(e) => handleAccordionScroll(e, activeFreeTrialsRef)} className={cn("p-4 bg-card rounded-lg shadow-lg hover:no-underline data-[state=open]:rounded-b-none data-[state=open]:mb-0", "bluish-glow")}>
                    <div className="flex w-full items-center">
                        <div className="flex items-center justify-start w-10 shrink-0">
                           <PackageCheck className="h-7 w-7 text-primary" />
                        </div>
                        <div className="flex items-center justify-center gap-3 flex-1">
                            <h2 className="text-2xl font-headline font-semibold text-foreground">
                                Active Free Trials
                            </h2>
                            {activeFreeTrials.length > 0 && (
                                <Badge variant="secondary" className="text-base">
                                    {activeFreeTrials.length}
                                </Badge>
                            )}
                        </div>
                        <div className="w-10 shrink-0"></div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="bg-card/60 backdrop-blur-sm border border-primary/20 rounded-b-lg shadow-lg border-t-0 p-6">
                    {activeFreeTrials.length === 0 ? (
                        <div className="text-center py-4">
                            <p className="text-xl text-muted-foreground mb-4">
                                No active free trials.
                            </p>
                            <p className="text-muted-foreground">
                                This section will list all of your free trials in session!
                            </p>
                        </div>
                    ) : (
                      <>
                        <Accordion type="multiple" className="w-full space-y-4">
                            {activeFreeTrials.map((visit) => (
                                <AccordionItem value={`planner-trial-${visit.id}`} key={visit.id} className="border border-orange-500/50 bg-card rounded-lg overflow-hidden">
                                    <AccordionTrigger className="p-4 hover:no-underline w-full text-left [&[data-state=open]]:border-b [&[data-state=open]]:border-orange-500/50">
                                        <div className="flex flex-1 items-center justify-between min-w-0 gap-4">
                                            <div className="flex flex-1 items-center gap-3 min-w-0">
                                                <span className={cn("h-3 w-3 rounded-full shrink-0", visit.dealClosed ? "bg-green-500" : "bg-orange-500")}></span>
                                                <h4 className="font-semibold text-foreground truncate" title={visit.companyName}>{visit.companyName}</h4>
                                            </div>
                                            <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
                                                {(visit.interestedUnits && visit.interestedUnits.length > 0) ? (
                                                    <span className="text-sm text-primary font-medium truncate">{`{${visit.interestedUnits[0].split('(')[0].trim()}${visit.interestedUnits.length > 1 ? `, +${visit.interestedUnits.length-1}`: ''}}`}</span>
                                                ) : (
                                                    visit.freeTrialStartDate && (
                                                        <span>Started: {format(new Date(visit.freeTrialStartDate), 'MMM d, yy')}</span>
                                                    )
                                                )}
                                                {visit.partnershipConfidence && (
                                                    <Badge variant="outline" className="flex items-center gap-1 px-1.5 py-0.5 border-transparent bg-transparent">
                                                        <span className="leading-none">{visit.partnershipConfidence}</span>
                                                        <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="p-0">
                                        <VisitCard
                                            visit={visit}
                                            onEdit={handleEditVisit}
                                            onDelete={handleDeleteVisit}
                                            onUpdateDealClosed={handleUpdateDealClosed}
                                            onZoom={setZoomedVisit}
                                            onLogFollowUp={handleLogFollowUp}
                                            onDictateNotes={handleDictateNotes}
                                            variant="planner"
                                        />
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                        {totalTrialCommission > 0 && (
                          <div className="mt-6 pt-4 border-t border-primary/20 text-right">
                            <p className="text-lg font-semibold text-foreground">
                              Total Potential Commission:
                              <span className="ml-2 font-bold text-green-400">
                                ${totalTrialCommission.toFixed(2)}
                              </span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                              From all active trials with pricing details.
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem ref={dealsClosedRef} value="deals-closed" className="border-none">
                  <AccordionTrigger onClick={(e) => handleAccordionScroll(e, dealsClosedRef)} className={cn("p-4 bg-card rounded-lg shadow-lg hover:no-underline data-[state=open]:rounded-b-none data-[state=open]:mb-0", "bluish-glow")}>
                    <div className="flex w-full items-center">
                      <div className="flex items-center justify-start w-10 shrink-0">
                        <DollarSign className="h-7 w-7 text-green-500" />
                      </div>
                      <h2 id="deals-closed-title" className="text-2xl font-headline font-semibold text-foreground text-center flex-1">
                            Deals Closed
                      </h2>
                      <div className="w-10 shrink-0"></div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="bg-card/60 backdrop-blur-sm border border-primary/20 rounded-b-lg shadow-lg border-t-0 p-6">
                    {closedDeals.length === 0 ? (
                        <div className="text-center py-4">
                            <p className="text-xl text-muted-foreground mb-4">
                                No deals closed yet.
                            </p>
                            <p className="text-muted-foreground">
                                When you mark a deal as closed on a visit card, it will appear here.
                            </p>
                        </div>
                    ) : (
                      <Accordion type="multiple" className="w-full space-y-4">
                          {closedDeals.map((visit) => (
                              <AccordionItem value={`planner-closed-${visit.id}`} key={visit.id} className="border border-green-500/50 bg-card rounded-lg overflow-hidden">
                                  <AccordionTrigger className="p-4 hover:no-underline w-full text-left [&[data-state=open]]:border-b [&[data-state=open]]:border-green-500/50">
                                      <div className="flex flex-1 items-center justify-between min-w-0 gap-4">
                                          <div className="flex flex-1 items-center gap-3 min-w-0">
                                              <span className="h-3 w-3 rounded-full shrink-0 bg-green-500"></span>
                                              <h4 className="font-semibold text-foreground truncate" title={visit.companyName}>{visit.companyName}</h4>
                                          </div>
                                          <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
                                            <span>Closed: {format(new Date(visit.timestamp), 'MMM d, yy')}</span>
                                            {visit.partnershipConfidence && (
                                                <Badge variant="outline" className="flex items-center gap-1 px-1.5 py-0.5 border-transparent bg-transparent">
                                                    <span className="leading-none">{visit.partnershipConfidence}</span>
                                                    <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                                                </Badge>
                                            )}
                                          </div>
                                      </div>
                                  </AccordionTrigger>
                                  <AccordionContent className="p-0">
                                      <VisitCard
                                          visit={visit}
                                          onEdit={handleEditVisit}
                                          onDelete={handleDeleteVisit}
                                          onUpdateDealClosed={handleUpdateDealClosed}
                                          onZoom={setZoomedVisit}
                                          onLogFollowUp={handleLogFollowUp}
                                          onDictateNotes={handleDictateNotes}
                                          variant="planner"
                                      />
                                  </AccordionContent>
                              </AccordionItem>
                          ))}
                      </Accordion>
                    )}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          )}

          {activeTab === 'visits' && (
            <Accordion type="single" collapsible defaultValue="company-map" className="w-full">
              <AccordionItem value="company-map" className="border-none">
                <AccordionTrigger className={cn("p-4 bg-card rounded-lg shadow-lg hover:no-underline data-[state=open]:rounded-b-none data-[state=open]:mb-0", "bluish-glow")}>
                  <div className="flex w-full items-center">
                    <div className="flex items-center justify-start w-10 shrink-0">
                      <MapPin className="h-7 w-7 text-primary" />
                    </div>
                    <h2 id="map-section-title" className="text-2xl font-headline font-semibold text-foreground text-center flex-1">
                      Company Map
                    </h2>
                    <div className="w-10 shrink-0"></div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="bg-card/60 backdrop-blur-sm border border-primary/20 rounded-b-lg shadow-lg border-t-0 p-6">
                  <div className="flex flex-col items-center gap-4 mb-6">
                      {visits.length > 0 && (
                           <div className="flex flex-col items-center gap-2">
                                <Badge variant="default" className="text-lg font-medium bg-accent text-accent-foreground hover:bg-accent/90 border-transparent">
                                    Your Visits: {visits.length}
                                </Badge>
                                <div className="flex flex-wrap gap-2 justify-center">
                                    <ExportPdfButton visits={visits} className="h-8 px-2 text-xs" />
                                    <ExportButton visits={visits} className="h-8 px-2 text-xs" />
                                    <Button onClick={handleEmailManager} variant="default" size="sm" className="h-8 px-2 text-xs">
                                    Email Manager
                                    </Button>
                                </div>
                            </div>
                      )}
                  </div>
                  <GoogleMapComponent 
                    visits={visits} 
                    userLatitude={userCurrentLatitude}
                    userLongitude={userCurrentLongitude}
                    onUpdateVisit={handleUpdateVisit}
                    onIntelRequest={setZoomedVisit}
                    onZoomRequest={setZoomedVisit}
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}

          {activeTab === 'ai-chat' && (
            <div className="space-y-6">
              {!isGenkitConfigured ? (
                <Alert variant="destructive" className="max-w-2xl mx-auto">
                  <WifiOff className="h-4 w-4" />
                  <AlertTitle>AI Features Disabled</AlertTitle>
                  <AlertDescription>
                    The AI assistant is currently unavailable because the Google API Key has not been configured. Please set the `GOOGLE_API_KEY` in your .env file to enable this feature.
                  </AlertDescription>
                </Alert>
              ) : (
              <Accordion type="single" collapsible className="w-full max-w-2xl mx-auto" defaultValue="debbie-chat">
                <AccordionItem ref={debbieRef} value="debbie-chat" className="border-none">
                  <AccordionTrigger onClick={(e) => handleAccordionScroll(e, debbieRef)} className={cn("p-4 bg-card rounded-lg shadow-lg hover:no-underline data-[state=open]:rounded-b-none data-[state=open]:mb-0", "bluish-glow")}>
                    <div className="flex items-center justify-center w-full">
                      <div className="flex items-center gap-2 text-foreground">
                        <Bot className="mr-1 h-7 w-7 text-primary" />
                        <h2 className="text-2xl font-headline font-semibold">Debbie AI Assistant</h2>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-0">
                    <UiCard className="w-full rounded-t-none border-t-0 bg-card border border-primary/20 flex flex-col">
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
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
              )}
              <Accordion type="single" collapsible className="w-full max-w-2xl mx-auto">
                <AccordionItem ref={newsFeedRef} value="news-feed" className="border-none">
                  <AccordionTrigger onClick={(e) => handleAccordionScroll(e, newsFeedRef)} className={cn("p-4 bg-card rounded-lg shadow-lg hover:no-underline data-[state=open]:rounded-b-none data-[state=open]:mb-0", "bluish-glow")}>
                    <div className="flex items-center justify-center w-full">
                      <div className="flex items-center gap-2 text-foreground">
                        <Newspaper className="mr-1 h-7 w-7 text-primary" />
                        <h2 className="text-2xl font-headline font-semibold">Optimum New England News</h2>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-0">
                    <UiCard className="bg-card border border-primary/20 rounded-t-none border-t-0">
                      <UiCardContent className="pt-6">
                        {newsItems.length > 0 ? (
                            <ul className="space-y-3 text-sm text-foreground list-disc pl-5">
                              {newsItems.map((item, index) => (
                                <li key={index} className="flex justify-between items-start group">
                                  <span>{item}</span>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 ml-2"
                                    onClick={() => handleDeleteNewsItem(index)}
                                    aria-label="Delete news item"
                                  >
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  </Button>
                                </li>
                              ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-muted-foreground text-center">No news items. Add one below.</p>
                        )}
                      </UiCardContent>
                      <UiCardFooter className="flex-col items-start gap-2 border-t pt-4">
                        <Label htmlFor="new-news-item" className="font-semibold text-foreground">Add News Item</Label>
                        <Textarea 
                          id="new-news-item"
                          placeholder="Type a new update for the sales team..."
                          value={newNewsItem}
                          onChange={(e) => setNewNewsItem(e.target.value)}
                          className="min-h-[60px]"
                        />
                        <Button onClick={handleAddNewsItem} size="sm" disabled={!newNewsItem.trim()}>
                          <PlusSquare className="mr-2 h-4 w-4" />
                          Add to News
                        </Button>
                      </UiCardFooter>
                    </UiCard>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <Accordion type="single" collapsible className="w-full max-w-2xl mx-auto">
                <AccordionItem ref={companyDocsRef} value="company-docs" className="border-none">
                  <AccordionTrigger onClick={(e) => handleAccordionScroll(e, companyDocsRef)} className={cn("p-4 bg-card rounded-lg shadow-lg hover:no-underline data-[state=open]:rounded-b-none data-[state=open]:mb-0", "bluish-glow")}>
                    <div className="flex items-center justify-center w-full">
                      <div className="flex items-center gap-2 text-foreground">
                        <FileText className="mr-1 h-7 w-7 text-primary" />
                        <h2 className="text-2xl font-headline font-semibold">Company Documents</h2>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-0">
                    <UiCard className="w-full rounded-t-none border-t-0 bg-card border border-primary/20 flex flex-col">
                      <UiCardHeader>
                        <UiCardTitle>Analyze Company Files</UiCardTitle>
                        <UiCardDescription>Add direct links to important documents (e.g., from Dropbox) for Debbie to analyze.</UiCardDescription>
                      </UiCardHeader>
                      <UiCardContent className="space-y-4">
                        <div className="flex flex-col sm:flex-row items-start gap-2 p-3 border rounded-lg bg-background/50">
                          <div className="flex-grow space-y-1 w-full">
                              <Label htmlFor="doc-name" className="text-xs">Document Name</Label>
                              <Input id="doc-name" placeholder="e.g., Price List 2024" value={newDocName} onChange={e => setNewDocName(e.target.value)} />
                          </div>
                          <div className="flex-grow space-y-1 w-full">
                              <Label htmlFor="doc-url" className="text-xs">Document URL</Label>
                              <Input id="doc-url" placeholder="Paste direct file link here" value={newDocUrl} onChange={e => setNewDocUrl(e.target.value)} />
                          </div>
                           <Button onClick={handleAddCompanyDoc} className="w-full sm:w-auto mt-auto" size="sm" disabled={!newDocName.trim() || !newDocUrl.trim()}>
                              <PlusCircle className="mr-2 h-4 w-4" /> Add
                          </Button>
                        </div>
                        {companyDocs.length > 0 ? (
                            <ScrollArea className="h-48">
                                <ul className="space-y-2 pr-4">
                                {companyDocs.map((doc) => (
                                    <li key={doc.id} className="flex items-center justify-between p-2 rounded-md bg-secondary/50">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <FileText className="h-4 w-4 shrink-0 text-primary" />
                                            <span className="truncate text-sm" title={doc.name}>{doc.name}</span>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                          <Button variant="default" size="sm" className="h-7 px-2 text-xs" onClick={() => handleAnalyzeCompanyDoc(doc)} disabled={!!analyzingDocId}>
                                              {analyzingDocId === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                                              <span className="ml-1">Analyze</span>
                                          </Button>
                                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteCompanyDoc(doc.id)}>
                                              <Trash2 className="h-4 w-4 text-red-500" />
                                              <span className="sr-only">Delete {doc.name}</span>
                                          </Button>
                                        </div>
                                    </li>
                                ))}
                                </ul>
                            </ScrollArea>
                        ) : (
                            <div className="text-center text-sm text-muted-foreground p-4 rounded-md border border-dashed">
                                No company documents added yet.
                            </div>
                        )}
                      </UiCardContent>
                    </UiCard>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <div className="flex justify-center">
                <Button onClick={() => setIsFindCompanyModalOpen(true)} size="sm">
                    <Search className="mr-2 h-4 w-4" /> Find Company
                </Button>
              </div>

              <Accordion type="single" collapsible className="w-full max-w-2xl mx-auto" defaultValue="hot-leads">
                <AccordionItem ref={hotLeadsRef} value="hot-leads" className="border-none">
                  <AccordionTrigger onClick={(e) => handleAccordionScroll(e, hotLeadsRef)} className="p-4 bg-card rounded-lg shadow-lg hover:no-underline data-[state=open]:rounded-b-none data-[state=open]:mb-0 shadow-orange-500/20">
                    <div className="flex items-center justify-center w-full">
                      <div className="flex items-center gap-2 text-foreground">
                        <Flame className="mr-1 h-7 w-7 text-orange-500" />
                        <h2 id="hot-leads-title" className="text-2xl font-headline font-semibold">Hot Leads ({hotLeads.length})</h2>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-0">
                    <UiCard className="w-full rounded-t-none border-t-0 bg-card border border-primary/20 flex flex-col">
                      <UiCardHeader>
                          <div className="flex justify-between items-center">
                              <UiCardDescription>Leads generated from your company searches. Saved locally to your device.</UiCardDescription>
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
                      </UiCardHeader>
                      <UiCardContent className="flex-grow flex flex-col">
                          {hotLeads.length === 0 ? (
                              <div className="flex-grow flex items-center justify-center">
                                  <p className="text-sm text-muted-foreground text-center py-4">No hot leads yet. Use the "Find Company" feature to start building your list.</p>
                              </div>
                          ) : (
                              <ScrollArea className="h-96">
                                  <div className="space-y-3 pr-4">
                                      {hotLeads.map((lead, index) => {
                                        const isConverted = convertedHotLeads.has(lead.id);
                                        return (
                                          <div key={lead.id} className="p-3 rounded-md border-2 border-orange-500 space-y-2 shadow-lg shadow-orange-500/20 flex flex-col bg-background/50">
                                              <div className="flex-grow space-y-2">
                                                  <div className="bg-muted/50 p-2 rounded-md">
                                                      <h4 className="font-semibold text-foreground flex items-center"><span className="mr-2 text-primary font-bold">{index + 1}.</span><Building className="mr-2 h-4 w-4 shrink-0" />{lead.companyName}</h4>
                                                      <p className="text-sm text-muted-foreground pl-6">{lead.address}</p>
                                                      {lead.phone && <p className="text-sm text-muted-foreground pl-6 flex items-center"><Phone className="mr-2 h-4 w-4 shrink-0" />{lead.phone}</p>}
                                                  </div>

                                                  <div className="space-y-1 bg-black p-2 rounded-md">
                                                      <Label htmlFor={`hot-lead-notes-${lead.id}`} className="text-xs font-medium text-muted-foreground">Lead Notes</Label>
                                                      <div className="relative">
                                                        <Textarea
                                                            id={`hot-lead-notes-${lead.id}`}
                                                            value={lead.notes || ''}
                                                            onChange={(e) => handleUpdateHotLeadNotes(lead.id, e.target.value)}
                                                            placeholder="e.g., Competitor: Blue Drop. Contract with Quench is up in a few months."
                                                            className="text-sm h-20 bg-black pr-10"
                                                            rows={3}
                                                            disabled={isRecordingHotLeadNotes === lead.id}
                                                        />
                                                        <Button
                                                          type="button"
                                                          variant="ghost"
                                                          size="icon"
                                                          onClick={() => handleToggleVoiceForHotLead(lead.id)}
                                                          className="absolute right-1 top-1 h-8 w-8"
                                                          aria-label="Dictate hot lead notes"
                                                        >
                                                          {isRecordingHotLeadNotes === lead.id ? (
                                                            <Mic className="h-4 w-4 text-red-500 animate-pulse" />
                                                          ) : (
                                                            <Mic className="h-4 w-4 text-muted-foreground" />
                                                          )}
                                                        </Button>
                                                      </div>
                                                  </div>
                                              </div>
                                              
                                              <div className="flex justify-between items-center gap-2 mt-2 pt-2 border-t border-border/50 shrink-0">
                                                   <Button 
                                                      variant={isConverted ? "default" : "outline"}
                                                      size="sm" 
                                                      className="h-7 px-2 text-xs"
                                                      onClick={() => handleAddHotLeadAsVisit(lead)}
                                                      disabled={isConverted}
                                                  >
                                                      {isConverted ? (
                                                          <>
                                                              <CheckCircle className="mr-1 h-3 w-3" /> Added
                                                          </>
                                                      ) : (
                                                          <>
                                                              <PlusSquare className="mr-1 h-3 w-3" /> Add Future Visit
                                                          </>
                                                      )}
                                                  </Button>
                                                  <AlertDialog>
                                                      <AlertDialogTrigger asChild>
                                                          <Button variant="destructive" size="icon" className="h-7 w-7">
                                                              <Trash2 className="h-4 w-4" />
                                                          </Button>
                                                      </AlertDialogTrigger>
                                                      <AlertDialogContent>
                                                          <AlertDialogHeader>
                                                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                              <AlertDialogDescription>
                                                                  This will permanently delete the hot lead for "{lead.companyName}". This action cannot be undone.
                                                              </AlertDialogDescription>
                                                          </AlertDialogHeader>
                                                          <AlertDialogFooter>
                                                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                              <AlertDialogAction onClick={() => handleDeleteHotLead(lead.id)}>Delete</AlertDialogAction>
                                                          </AlertDialogFooter>
                                                      </AlertDialogContent>
                                                  </AlertDialog>
                                              </div>
                                          </div>
                                      )})}
                                  </div>
                              </ScrollArea>
                          )}
                      </UiCardContent>
                      {hotLeads.length > 0 && (
                          <UiCardFooter className="flex-wrap gap-2 shrink-0">
                              <ExportHotLeadsCsvButton hotLeads={hotLeads} size="sm" variant="default" />
                              <ExportHotLeadsPdfButton hotLeads={hotLeads} size="sm" variant="default" />
                              <Button onClick={handleEmailHotLeads} variant="default" size="sm">
                                  <Mail className="mr-2 h-4 w-4" /> Email List to Self
                              </Button>
                          </UiCardFooter>
                      )}
                    </UiCard>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          )}
          
          {activeTab === 'about' && (
            <div className="p-6 bg-card rounded-xl shadow-xl min-h-[300px] flex flex-col items-start justify-start space-y-6">
                <div className="w-full text-center">
                    <h2 className="text-2xl font-headline font-semibold text-primary flex items-center justify-center">
                        <InfoIcon className="mr-3 h-7 w-7" /> App Guide
                    </h2>
                </div>

                <Tabs defaultValue="about-field-day" className="w-full">
                    <TabsList className="grid w-full grid-cols-6 mb-4 bg-primary/10 backdrop-blur-sm p-1 rounded-full border border-primary/20">
                        <TabsTrigger value="about-field-day" className="rounded-full border-transparent data-[state=active]:bg-primary/20 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg flex items-center justify-center">
                            <PlusCircle className="h-5 w-5" />
                        </TabsTrigger>
                        <TabsTrigger value="about-planner" className="rounded-full border-transparent data-[state=active]:bg-primary/20 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg flex items-center justify-center">
                            <FolderKanban className="h-5 w-5" />
                        </TabsTrigger>
                        <TabsTrigger value="about-call-day" className="rounded-full border-transparent data-[state=active]:bg-primary/20 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg flex items-center justify-center">
                            <ListChecks className="h-5 w-5" />
                        </TabsTrigger>
                        <TabsTrigger value="about-visits" className="rounded-full border-transparent data-[state=active]:bg-primary/20 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg flex items-center justify-center">
                            <MapPin className="h-5 w-5" />
                        </TabsTrigger>
                        <TabsTrigger value="about-debbie" className="rounded-full border-transparent data-[state=active]:bg-primary/20 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg flex items-center justify-center">
                            <Bot className="h-5 w-5" />
                        </TabsTrigger>
                        <TabsTrigger value="about-feedback" className="rounded-full border-transparent data-[state=active]:bg-primary/20 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg flex items-center justify-center">
                           <MessagesSquare className="h-5 w-5" />
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="about-field-day" className="text-foreground text-base leading-relaxed p-4 bg-background/20 rounded-lg">
                        <p className="mb-4">This is your main hub for logging new visits and capturing opportunities as they happen. Here's how to use it:</p>
                        <ul className="list-disc list-inside space-y-3">
                            <li>
                                <strong>Navigation Plan:</strong> Before you head out, use the "Navigation Plan" to set a destination city. Debbie will find an optimal, central parking spot for you.
                            </li>
                            <li>
                                <strong>Flag Hotspot:</strong> Tap the <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground shadow-md align-middle"><Flame className="h-4 w-4" /></span> button to mark locations that look promising while you are driving but have other arrangements.
                            </li>
                            <li>
                                <strong>Quicklog Visit:</strong> When you arrive at a business, use <span className="inline-block bg-primary text-primary-foreground px-2 py-1 rounded-md text-xs font-semibold">Quicklog Visit</span> to create a new record. Debbie will try to auto-fill the company name based on your location.
                            </li>
                            <li>
                                <strong>Save Daily Report:</strong> At the end of the day, click <span className="inline-block bg-primary text-primary-foreground px-2 py-1 rounded-md text-xs font-semibold">Save Daily Report</span> to generate a CSV of your day's work and upload it to cloud storage.
                            </li>
                        </ul>
                    </TabsContent>

                     <TabsContent value="about-planner" className="text-foreground text-base leading-relaxed p-4 bg-background/20 rounded-lg">
                        <p className="mb-4">The Planner tab helps you organize all your future activities. It's automatically sorted into four key sections:</p>
                        <ul className="list-disc list-inside space-y-3">
                            <li>
                                <strong>Future Meetings (Scheduled):</strong> Any visit with a specific date and time appears here, sorted by the soonest appointment. These are often created automatically when Debbie analyzes your notes.
                            </li>
                            <li>
                                <strong>Future Visits (Unscheduled):</strong> This section is for leads you want to pursue but haven't scheduled yet. You can add to this list by converting a "Hot Lead" from the Debbie tab.
                            </li>
                            <li>
                                <strong>Flagged Hotspots:</strong> This powerful list contains all the locations you've marked on the go with the "Flag Hotspot" button. Review them here, edit their details, and decide when to schedule a full visit.
                            </li>
                            <li>
                                <strong>Active Free Trials:</strong> This section tracks all your visits where a free trial has been set up, helping you monitor them and follow up at the right time to close the deal.
                            </li>
                        </ul>
                    </TabsContent>

                    <TabsContent value="about-call-day" className="text-foreground text-base leading-relaxed p-4 bg-background/20 rounded-lg">
                        <p>The "Call Day" tab is your command center for reviewing past interactions. It provides a filterable and sortable list of all your previous visits, helping you strategize your follow-up calls and emails effectively.</p>
                    </TabsContent>

                    <TabsContent value="about-visits" className="text-foreground text-base leading-relaxed p-4 bg-background/20 rounded-lg">
                        <p>The "Visits" tab shows all your logged locations on an interactive map, giving you a visual overview of your progress. From here, you can export your visit data to PDF or CSV and quickly compose a summary email to your manager, saving you time and hassle.</p>
                    </TabsContent>

                    <TabsContent value="about-debbie" className="text-foreground text-base leading-relaxed p-4 bg-background/20 rounded-lg">
                        <p className="mb-4">"Debbie" is your supercharged AI assistant. Her real power lies in automation:</p>
                         <ul className="list-disc list-inside space-y-3">
                            <li>
                                <strong>Automated Data Entry:</strong> When you add notes to a visit (by typing or voice), Debbie reads them and automatically fills out form fields like competitor info, TDS readings, or if a business card was collected.
                            </li>
                            <li>
                                <strong>Smart Scheduling & Calendar:</strong> If your notes mention a meeting, Debbie automatically schedules it. This syncs with the calendar in the "Call Day" tab, which uses color-coding: <span className="text-orange-500 font-bold">Orange</span> for future meetings, <span className="text-green-500 font-bold">Green</span> for closed deals, <span className="text-cyan-400 font-bold">Turquoise</span> for days you were out in the field, and <span className="text-red-500 font-bold">Red</span> for when a free trial ends.
                            </li>
                            <li>
                                <strong>Document Analysis:</strong> In the chat, you can upload PDFs or CSVs to give Debbie context for your questions. You can also upload files for long-term memory via the "Manage Files" button.
                            </li>
                             <li>
                                <strong>Lead Generation:</strong> Use the "Find Company" feature to search for businesses in your territory. The results are automatically added as "Hot Leads" in this tab, ready for you to review and convert into future visits.
                            </li>
                        </ul>
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
                  onLogFollowUp={handleLogFollowUp}
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
                        {isExtractingCities ? "Debbie is reading your territory file..." : "Select a city from your territory, or search for one."}
                    </DialogDescription>
                </DialogHeader>
                <div className="max-h-[500px] overflow-y-auto pr-2">
                    {isExtractingCities ? (
                        <div className="flex justify-center items-center h-32"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                    ) : (
                        <div className="flex flex-col space-y-4">
                           <Button
                                key="call-day-seabrook"
                                variant="default"
                                className="justify-start text-base py-6"
                                disabled={isFindingParking}
                                onClick={() => handleSelectDestination('Seabrook, NH')}
                            >
                               <Phone className="mr-3 h-5 w-5" />
                               Call Day (Seabrook)
                            </Button>
                            
                            <div className="relative w-full">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="text"
                                    placeholder={isRecordingDestinationSearch ? "Listening for city..." : "Or search for a city..."}
                                    className="pl-10 pr-10"
                                    value={destinationSearchTerm}
                                    onChange={(e) => setDestinationSearchTerm(e.target.value)}
                                    onKeyPress={(e) => { if (e.key === 'Enter') handleDestinationSearch(); }}
                                    disabled={isRecordingDestinationSearch || isFindingParking}
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={handleToggleVoiceDestinationSearch}
                                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                                    aria-label="Search destination with voice"
                                    title="Search destination with voice"
                                    disabled={isFindingParking}
                                >
                                    {isRecordingDestinationSearch ? (
                                        <Mic className="h-4 w-4 text-red-500 animate-pulse" />
                                    ) : (
                                        <Mic className="h-4 w-4 text-muted-foreground" />
                                    )}
                                </Button>
                            </div>

                            {destinationCities.length > 0 && (
                               <div className="relative my-2">
                                    <Separator />
                                    <span className="absolute left-1/2 -translate-x-1/2 -top-2.5 bg-background px-2 text-xs text-muted-foreground">Territory Cities</span>
                                </div>
                            )}
                            {destinationCities.map(city => (
                                <Button
                                    key={city}
                                    variant="ghost"
                                    className="justify-start"
                                    disabled={isFindingParking}
                                    onClick={() => handleSelectDestination(city)}
                                >
                                   {city}
                                </Button>
                            ))}
                            {destinationCities.length === 0 && (
                                <p className="text-muted-foreground text-center py-4 text-sm">No other destination cities found in your territory file.</p>
                            )}
                        </div>
                    )}
                </div>
                 <DialogFooter>
                    <Button variant="ghost" onClick={() => setIsDestinationModalOpen(false)} disabled={isFindingParking || isExtractingCities}>
                        {isFindingParking || isExtractingCities ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Close'}
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
            setAddingFutureVisit(false);
          }}
          onSave={handleSaveFromForm}
          initialData={currentEditingVisit}
          salesperson={selectedSalesperson}
          startDictationOnOpen={startDictationOnOpen}
          isFutureVisit={addingFutureVisit}
        />
        
        <AlertDialog open={isStartupNavigationConfirmOpen} onOpenChange={setIsStartupNavigationConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Navigate to Today's Meeting?</AlertDialogTitle>
              <AlertDialogDescription>
                You have a meeting with {startupNavigationTarget?.companyName}. Would you like to navigate there now?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>No</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmStartupNavigation}>Yes, Navigate</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        
      </div>
      <button
        onClick={handleHotspotCreation}
        className="fixed bottom-6 right-6 h-16 w-16 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center z-50 transition-transform hover:scale-110 active:scale-100"
        aria-label="Flag Hotspot"
      >
        <Flame className="h-8 w-8" />
      </button>
      <footer className="text-center py-8 text-muted-foreground text-sm border-t mt-12">
        <p>&copy; {new Date().getFullYear()} Optimum Trailblazer. Your personal sales companion.</p>
         <p className="text-xs mt-1">
            {firebaseConfigured ? "Data is saved locally. Use 'Save Daily Report' to upload to the cloud." : "Data is saved locally to your browser."}
         </p>
      </footer>
    </div>
  );
}
