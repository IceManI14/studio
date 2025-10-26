

'use client';

import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import type { Visit, ChatMessage, Salesperson, Territory, ManagedFile, ContactInfo, HotLead, CompanyDoc } from '@/lib/types';
import { Button } from '@/components/ui/button';
import VisitForm from '@/components/visit-form';
import VisitCard from '@/components/visit-card';
import MapPlaceholder from '@/components/map-placeholder';
import { PlusCircle, ListChecks, User, InfoIcon, Sunset, Send, PartyPopper, MessagesSquare, Hash, Mail, ListFilter, Bot, MapPin, Brain, Loader2, Paperclip, XCircle, Swords, UserCog, AlertTriangle, WifiOff, Search, FolderKanban, Map as MapIcon, RefreshCw, UploadCloud, Mic, Compass, Flame, Building, Trash2, Phone, PlusSquare, CalendarIcon, Check, CheckCircle, Edit, CalendarCheck, X, PackageCheck, Save, Newspaper, LayoutGrid, Square, Star, DollarSign, FileText, CalendarClock, Database, LogIn, LogOut, UserPlus, FileDown, Gauge } from 'lucide-react';
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
} from "@/components/ui/dialog";
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card as UiCard, CardContent as UiCardContent, CardHeader as UiCardHeader, CardFooter as UiCardFooter, CardTitle as UiCardTitle, CardDescription as UiCardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAiChatResponseAction, findOptimalParkingAction, extractCitiesFromPdfAction, findCompanyAction, saveDailyReportAction, analyzeDocumentAction, deleteVisitAction, saveVisitAction, getCompanyNameFromCoordsAction } from '@/app/actions';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import TerritoryUploadModal from '@/components/territory-upload-modal';
import FindCompanyModal from '@/components/find-company-modal';
import ManageFilesModal from '@/components/manage-files-modal';
import DataUsageDashboard from '@/components/data-usage-dashboard';
import { fileToDataUri, cn, stateNameToAbbreviation, haversineDistance } from '@/lib/utils';
import { Calendar } from "@/components/ui/calendar";
import type { SaveVisitPayload } from '@/app/actions';
import { db, firebaseConfigured } from '@/lib/firebase';
import { useToast } from "@/hooks/use-toast";
import ExportHotLeadsCsvButton from '@/components/export-hot-leads-csv-button';
import ExportHotLeadsPdfButton from '@/components/export-hot-leads-pdf-button';
import { collection, onSnapshot, query, Timestamp } from 'firebase/firestore';
import { COOLER_PRICING_MAP } from '@/lib/cooler-pricing';
import ExportPdfButton from '@/components/export-pdf-button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';


interface FoundPlace {
    companyName: string;
    address: string;
    city: string;
    phone: string;
_latitude?: number;
_longitude?: number;
    openingHours?: string[];
}
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

const calculateCommission = (visit: Visit): number => {
    if (typeof visit.manualCommission === 'number' && visit.manualCommission > 0) {
        return visit.manualCommission;
    }

    if (visit.freeTrial) {
        const priceFromUnits = Array.isArray(visit.interestedUnits)
            ? visit.interestedUnits.reduce((sum, unitName) => sum + (COOLER_PRICING_MAP[unitName] || 0), 0)
            : 0;
        
        const coolerCommission = (priceFromUnits > 0 ? priceFromUnits : (visit.priceQuoted || 0)) * 5;
        const installCommission = visit.installationFee ? (visit.installationFee / 2) : 0;
        return coolerCommission + installCommission;
    }

    if (!visit.pricingDiscussed) {
        return 0;
    }
    
    if (visit.creditApproved === false && typeof visit.priceQuoted === 'number') {
        return visit.priceQuoted;
    }

    const priceFromUnits = Array.isArray(visit.interestedUnits)
        ? visit.interestedUnits.reduce((sum, unitName) => sum + (COOLER_PRICING_MAP[unitName] || 0), 0)
        : 0;
        
    const priceQuoted = (priceFromUnits > 0 ? priceFromUnits : (visit.priceQuoted || 0));

    const leaseCommission = (priceQuoted && visit.leaseTerm)
        ? (priceQuoted * (visit.leaseTerm / 12))
        : 0;

    const installCommission = visit.installationFee ? (visit.installationFee / 2) : 0;
    
    return leaseCommission + installCommission;
};



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
    <div className="space-y-4">
      {visits.map((visit) => (
        <VisitCard
          key={visit.id}
          visit={visit}
          onEdit={onEdit}
          onDelete={onDelete}
          onUpdateDealClosed={onUpdateDealClosed}
          onZoom={onZoom}
          onLogFollowUp={onLogFollowUp}
          onDictateNotes={onDictateNotes}
          isZoomedView={true}
        />
      ))}
    </div>
  )
});

export default function HomePage() {
  // State and Refs
  const [visits, setVisits] = useState<Visit[]>([]);
  const [importedVisits, setImportedVisits] = useState<Visit[] | null>(null);
  const [hotLeads, setHotLeads] = useState<HotLead[]>([]);
  const [isVisitFormOpen, setIsVisitFormOpen] = useState(false);
  const [currentEditingVisit, setCurrentEditingVisit] = useState<Visit | undefined>(undefined);
  const [suggestionText, setSuggestionText] = useState('');
  const [submittedSuggestions, setSubmittedSuggestions] = useState<SubmittedSuggestion[]>([]);
  const [sortCriteria, setSortCriteria] = useState<'partnershipConfidence' | 'timestamp' | 'dealClosed' | 'futureMeetingsSet' | 'inTrial' | 'city'>('partnershipConfidence');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [zoomedVisit, setZoomedVisit] = useState<Visit | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isRecordingSearch, setIsRecordingSearch] = useState(false);
  const [citySearchTerm, setCitySearchTerm] = useState('');
  const [isRecordingCitySearch, setIsRecordingCitySearch] = useState(false);
  const [fieldDaySearchTerm, setFieldDaySearchTerm] = useState('');
  const [isRecordingFieldDaySearch, setIsRecordingFieldDaySearch] = useState(false);
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
  const [isFindingParking, setIsFindingParking] = useState(false);
  const [showTerritoryUploadModal, setShowTerritoryUploadModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [destinationCities, setDestinationCities] = useState<string[]>([]);
  const [isExtractingCities, setIsExtractingCities] = useState(false);
  const [isFindCompanyModalOpen, setIsFindCompanyModalOpen] = useState(false);
  const [managedFiles, setManagedFiles] = useState<ManagedFile[]>([]);
  const [isManageFilesModalOpen, setIsManageFilesModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('field-day');
  const [isSyncing, setIsSyncing] = useState(true);
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
  const [fieldDayAccordionValue, setFieldDayAccordionValue] = useState<string[]>([]);
  const [companyDocs, setCompanyDocs] = useState<CompanyDoc[]>([]);
  const [newDocName, setNewDocName] = useState('');
  const [newDocUrl, setNewDocUrl] = useState('');
  const [analyzingDocId, setAnalyzingDocId] = useState<string | null>(null);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [visitsForReschedule, setVisitsForReschedule] = useState<Visit[]>([]);
  const [visitToReschedule, setVisitToReschedule] = useState<Visit | null>(null);
  const [isAllMeetingsModalOpen, setIsAllMeetingsModalOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState<Date | null>(null);
  const [activeTabLabel, setActiveTabLabel] = useState('Field Day');
  const [lastLocation, setLastLocation] = useState<{lat: number, lng: number, time: number} | null>(null);
  const [currentSpeed, setCurrentSpeed] = useState<number>(0);
  const [speedReadings, setSpeedReadings] = useState<number[]>([]);

  
  const { toast } = useToast();
  const searchRecognitionRef = useRef<SpeechRecognition | null>(null);
  const fieldDaySearchRecognitionRef = useRef<SpeechRecognition | null>(null);
  const citySearchRecognitionRef = useRef<SpeechRecognition | null>(null);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatRecognitionRef = useRef<SpeechRecognition | null>(null);
  const hotLeadNotesRecognitionRef = useRef<SpeechRecognition | null>(null);
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
  const visitCardsRef = useRef<HTMLDivElement>(null);
  const pastVisitsRef = useRef<HTMLDivElement>(null);
  const todaysVisitsRef = useRef<HTMLDivElement>(null);
  const eagleEyeRef = useRef<HTMLDivElement>(null);
  const currentCityRef = useRef<string | null>(null);
  const importReportInputRef = useRef<HTMLInputElement>(null);
  
  const isGenkitConfigured = process.env.NEXT_PUBLIC_GENKIT_CONFIGURED === 'true';

  // Memos
  const visitsToDisplay = importedVisits || visits;

  const scheduledFutureVisitDays = useMemo(() => {
    const today = startOfDay(new Date());
    return visitsToDisplay
      .filter(visit => 
        visit.futureMeetingSet && 
        visit.futureMeetingDateTime && 
        new Date(visit.futureMeetingDateTime) >= today &&
        !visit.dealClosed
      )
      .map(visit => startOfDay(new Date(visit.futureMeetingDateTime!)));
  }, [visitsToDisplay]);

  const trialEndDays = useMemo(() => {
    const today = startOfDay(new Date());
    return visitsToDisplay
      .filter(v => {
        if (!v.freeTrial || !v.freeTrialStartDate) return false;
        const trialEndDate = addDays(startOfDay(new Date(v.freeTrialStartDate!)), 7);
        return trialEndDate >= today;
      })
      .map(v => addDays(startOfDay(new Date(v.freeTrialStartDate!)), 7));
  }, [visitsToDisplay]);

  const loggedPastVisitDays = useMemo(() => {
    const today = startOfDay(new Date());
    const pastTimestamps = new Set<number>();
  
    visitsToDisplay.forEach(v => {
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
  }, [visitsToDisplay]);

  const dealClosedDays = useMemo(() => {
    const closedDays = new Set<number>();
    visitsToDisplay.forEach(visit => {
        if (visit.dealClosed) {
            closedDays.add(startOfDay(new Date(visit.timestamp)).getTime());
            if (visit.futureMeetingDateTime) {
                closedDays.add(startOfDay(new Date(visit.futureMeetingDateTime)).getTime());
            }
        }
    });
    return Array.from(closedDays).map(time => new Date(time));
  }, [visitsToDisplay]);

  const uniqueCities = useMemo(() => {
    const cities = new Set<string>();
    visitsToDisplay.forEach(visit => {
      if (visit.city) {
        cities.add(visit.city);
      }
    });
    return Array.from(cities).sort((a, b) => a.localeCompare(b));
  }, [visitsToDisplay]);

  const sortedVisitsForCallDay = useMemo(() => {
    if (visitsToDisplay.length === 0) return [];

    let processedVisits = [...visitsToDisplay];

    // Main filter to exclude closed deals, unless specifically filtering for them
    if (sortCriteria !== 'dealClosed') {
        processedVisits = processedVisits.filter(visit => !visit.dealClosed);
    }
    
    // Date filter is primary if selected
    if (selectedDate) {
        processedVisits = processedVisits.filter(visit => 
            isSameDay(new Date(visit.timestamp), selectedDate) ||
            (visit.futureMeetingSet && visit.futureMeetingDateTime && isSameDay(new Date(visit.futureMeetingDateTime), selectedDate))
        );
    } else {
        if (searchTerm.trim() !== '') {
            processedVisits = processedVisits.filter(visit =>
                visit.companyName.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        if (sortCriteria === 'city' && citySearchTerm.trim() !== '') {
            processedVisits = processedVisits.filter(visit =>
                visit.city?.toLowerCase() === citySearchTerm.toLowerCase()
            );
        }

        if (sortCriteria === 'futureMeetingsSet') {
            processedVisits = processedVisits.filter(visit => visit.futureMeetingSet && visit.futureMeetingDateTime);
        } else if (sortCriteria === 'inTrial') {
            processedVisits = processedVisits.filter(visit => visit.freeTrial && visit.freeTrialStartDate);
        } else if (sortCriteria === 'dealClosed') {
            processedVisits = processedVisits.filter(visit => visit.dealClosed);
        }
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
            const meetingTimeB = b.futureMeetingDateTime ? new Date(b.futureMeetingDateTime!).getTime() : Infinity;
            comparison = sortOrder === 'desc' ? meetingTimeB - meetingTimeA : meetingTimeA - meetingTimeB;
            if (comparison !== 0) return comparison;
            return timeB - timeA;
        } else if (sortCriteria === 'inTrial') {
            const trialTimeA = a.freeTrialStartDate ? new Date(a.freeTrialStartDate).getTime() : 0;
            const trialTimeB = b.freeTrialStartDate ? new Date(b.freeTrialStartDate!).getTime() : 0;
            comparison = sortOrder === 'desc' ? trialTimeB - trialTimeA : trialTimeA - trialTimeB;
            if (comparison !== 0) return comparison;
            return confidenceB - confidenceA;
        } else if (sortCriteria === 'dealClosed') {
            comparison = sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
            if (comparison !== 0) return comparison;
            return confidenceB - confidenceA;
        } else if (sortCriteria === 'timestamp') {
            comparison = sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
            if (comparison !== 0) return comparison;
            return confidenceB - confidenceA;
        } else { // 'partnershipConfidence'
            comparison = sortOrder === 'desc' ? confidenceB - confidenceA : confidenceA - confidenceB;
            if (comparison !== 0) return comparison;
            return timeB - timeA;
        }
    });
    return sorted;
  }, [visitsToDisplay, sortCriteria, sortOrder, selectedDate, searchTerm, citySearchTerm]);

  const scheduledVisits = useMemo(() => {
    return visitsToDisplay
      .filter(visit => visit.futureMeetingSet && visit.futureMeetingDateTime && new Date(visit.futureMeetingDateTime) >= new Date() && !visit.dealClosed)
      .sort((a, b) => new Date(a.futureMeetingDateTime!).getTime() - new Date(b.futureMeetingDateTime!).getTime());
  }, [visitsToDisplay]);

  const unscheduledFutureVisits = useMemo(() => {
    const scheduledIds = new Set(scheduledVisits.map(v => v.id));
    return visitsToDisplay
      .filter(visit => 
        visit.futureMeetingSet && 
        !visit.futureMeetingDateTime && 
        !scheduledIds.has(visit.id) &&
        !visit.notes?.startsWith('Flagged as a hotspot.') &&
        !visit.dealClosed
      )
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [visitsToDisplay, scheduledVisits]);

  const flaggedHotspots = useMemo(() => {
    const scheduledIds = new Set(scheduledVisits.map(v => v.id));
    return visitsToDisplay
      .filter(visit => 
        visit.notes?.startsWith('Flagged as a hotspot.') && 
        !visit.futureMeetingDateTime && 
        !scheduledIds.has(visit.id) &&
        !visit.dealClosed
      )
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [visitsToDisplay, scheduledVisits]);

  const activeFreeTrials = useMemo(() => {
    return visitsToDisplay
      .filter(visit => visit.freeTrial && visit.freeTrialStartDate && !visit.dealClosed)
      .sort((a, b) => new Date(b.freeTrialStartDate!).getTime() - new Date(a.freeTrialStartDate!).getTime());
  }, [visitsToDisplay]);

  const closedDeals = useMemo(() => {
    return visitsToDisplay
      .filter(visit => visit.dealClosed)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [visitsToDisplay]);

  const closedDealsCoolerSummary = useMemo(() => {
    const coolerCounts: Record<string, number> = {};
    closedDeals.forEach(visit => {
      if (visit.interestedUnits) {
        visit.interestedUnits.forEach(unit => {
          coolerCounts[unit] = (coolerCounts[unit] || 0) + 1;
        });
      }
    });
    return Object.entries(coolerCounts).sort(([, countA], [, countB]) => countB - countA);
  }, [closedDeals]);

  const totalTrialCommission = useMemo(() => {
    return activeFreeTrials.reduce((total, visit) => total + calculateCommission(visit), 0);
  }, [activeFreeTrials]);

  const totalClosedCommission = useMemo(() => {
    return closedDeals.reduce((total, visit) => total + calculateCommission(visit), 0);
  }, [closedDeals]);

  const pastVisitsByDay = useMemo(() => {
    const today = startOfDay(new Date());
    const grouped: { [key: string]: Visit[] } = {};
  
    visitsToDisplay
      .filter(visit => fieldDaySearchTerm.trim() === '' || visit.companyName.toLowerCase().includes(fieldDaySearchTerm.toLowerCase()))
      .forEach((visit) => {
        const visitDay = startOfDay(new Date(visit.timestamp));
        if (visitDay < today) {
          const dayKey = visitDay.toISOString().split('T')[0];
          if (!grouped[dayKey]) {
            grouped[dayKey] = [];
          }
          grouped[dayKey].push(visit);
        }
      });
  
    for (const dayKey in grouped) {
      grouped[dayKey].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
    return Object.entries(grouped).sort(([dateA], [dateB]) => new Date(dateB).getTime() - new Date(dateA).getTime());
  }, [visitsToDisplay, fieldDaySearchTerm]);

  const todaysVisits = useMemo(() => {
    return visitsToDisplay
      .filter(visit => isToday(new Date(visit.timestamp)))
      .filter(visit => fieldDaySearchTerm.trim() === '' || visit.companyName.toLowerCase().includes(fieldDaySearchTerm.toLowerCase()));
  }, [visitsToDisplay, fieldDaySearchTerm]);

  const todaysScheduledVisits = useMemo(() => {
    return scheduledVisits.filter(visit => isToday(new Date(visit.futureMeetingDateTime!)));
  }, [scheduledVisits]);

  const sortedVisitsTitle = useMemo(() => {
    if (selectedDate) {
        return `Visits on ${format(selectedDate, 'PPP')}`;
    }
    if (searchTerm.trim()) {
        return `Visits matching "${searchTerm.trim()}"`;
    }
    switch (sortCriteria) {
        case 'dealClosed': return 'All Closed Deals';
        case 'futureMeetingsSet': return 'Visits with Future Meetings';
        case 'inTrial': return 'Visits with Active Trials';
        case 'city': return citySearchTerm.trim() ? `Visits in ${citySearchTerm.trim()}` : 'Visits by City';
        case 'partnershipConfidence': return 'Visits by Confidence';
        default: return 'Sorted Visits';
    }
  }, [sortCriteria, selectedDate, searchTerm, citySearchTerm]);

  // Callbacks
  const handleSaveFromForm = useCallback(async (payload: SaveVisitPayload, options: { andClose?: boolean; expandOnClose?: boolean; } = {}): Promise<Visit> => {
    const { andClose = true, expandOnClose = false } = options;
    const isNew = !payload.id || payload.id.startsWith('temp_');
    const optimisticVisit = {
      ...payload,
      id: payload.id || `temp_${crypto.randomUUID()}`,
      timestamp: payload.timestamp || new Date(),
    } as Visit;
  
    // Optimistic UI Update
    setVisits(prevVisits => {
      const existingIndex = prevVisits.findIndex(v => v.id === optimisticVisit.id);
      let newVisits;
      if (existingIndex > -1) {
        newVisits = [...prevVisits];
        newVisits[existingIndex] = optimisticVisit;
      } else {
        newVisits = [optimisticVisit, ...prevVisits];
      }
      localStorage.setItem('visits', JSON.stringify(newVisits));
      return newVisits;
    });
  
    if (andClose) {
      setIsVisitFormOpen(false);
    }
  
    try {
      const result = await saveVisitAction(payload);
  
      if (result.error) {
        throw new Error(result.error);
      }
  
      if (result.visit) {
        // Replace temp visit with real one after successful save
        setVisits(prevVisits => {
            const newVisits = prevVisits.map(v => v.id === optimisticVisit.id ? result.visit! : v);
            localStorage.setItem('visits', JSON.stringify(newVisits));
            return newVisits;
        });

        toast({
          title: !isNew ? (andClose ? "Visit Updated" : "Progress Saved") : "Visit Logged",
          description: `${result.visit.companyName} data saved successfully.`,
        });
  
        if (expandOnClose && result.visit.id) {
          setActiveTab('field-day');
          setTimeout(() => {
            setFieldDayAccordionValue(prev => {
              if (!prev.includes(result.visit!.id!)) {
                return [...prev, result.visit!.id!];
              }
              return prev;
            });
          }, 100);
        }
        return result.visit;
      }
      throw new Error("Save action did not return a visit object.");
    } catch (error: any) {
      toast({
        title: "Sync Error",
        description: `Could not save to cloud: ${error.message}. Your data is saved locally.`,
        variant: "destructive",
      });
      // Return the optimistic visit so followup actions can still work
      return optimisticVisit;
    }
  }, [toast]);

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

  const handleToggleVoiceFieldDaySearch = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({ variant: 'destructive', title: 'Voice Recognition Not Supported' });
      return;
    }

    if (isRecordingFieldDaySearch && fieldDaySearchRecognitionRef.current) {
      fieldDaySearchRecognitionRef.current.stop();
      return;
    }

    const recognition = new SpeechRecognition();
    fieldDaySearchRecognitionRef.current = recognition;

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsRecordingFieldDaySearch(true);
    recognition.onend = () => setIsRecordingFieldDaySearch(false);
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      toast({ variant: 'destructive', title: 'Voice Error', description: event.error });
      setIsRecordingFieldDaySearch(false);
    };
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (transcript) {
        setFieldDaySearchTerm(transcript);
      }
    };

    try {
      recognition.start();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Could not start recording', description: e.message });
    }
  }, [isRecordingFieldDaySearch, toast]);

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

  const handleAddHotLeads = useCallback((newLeads: HotLead[]) => {
    setHotLeads(prevHotLeads => {
        const updatedLeads = [...prevHotLeads, ...newLeads];
        localStorage.setItem('hotLeads', JSON.stringify(updatedLeads));
        return updatedLeads;
    });
  }, []);

  const handleUpdateVisit = useCallback(async (visitId: string, updatedData: Partial<Visit>) => {
    const visitToUpdate = visitsToDisplay.find(v => v.id === visitId);
    if (!visitToUpdate) return;
  
    const payload: SaveVisitPayload = { ...visitToUpdate, ...updatedData };
    await handleSaveFromForm(payload);
  
    toast({
        title: "Visit Updated",
        description: `${payload.companyName} has been updated.`,
    });
  }, [visitsToDisplay, toast, handleSaveFromForm]);

  const handleClearHotLeads = useCallback(() => {
    if (hotLeads.length === 0) return;
    setHotLeads([]);
    setConvertedHotLeads(new Set());
    localStorage.removeItem('hotLeads');
    localStorage.removeItem('convertedHotLeads');
    toast({ title: "Hot Leads Cleared", description: "The hot leads list has been cleared from this device." });
  }, [hotLeads.length, toast]);

  const handleDeleteHotLead = useCallback((leadId: string) => {
    setHotLeads(prevHotLeads => {
        const updatedLeads = prevHotLeads.filter(lead => lead.id !== leadId);
        localStorage.setItem('hotLeads', JSON.stringify(updatedLeads));
        return updatedLeads;
    });
    setConvertedHotLeads(prev => {
        const newSet = new Set(prev);
        newSet.delete(leadId);
        localStorage.setItem('convertedHotLeads', JSON.stringify(Array.from(newSet)));
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
    setHotLeads(prevLeads => {
        const newLeads = prevLeads.map(lead => 
            lead.id === leadId ? { ...lead, notes } : lead
        );
        localStorage.setItem('hotLeads', JSON.stringify(newLeads));
        return newLeads;
    });
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
        setHotLeads(prevLeads => {
            const newLeads = prevLeads.map(lead =>
              lead.id === leadId
                ? { ...lead, notes: (lead.notes ? `${lead.notes} ${newTranscript.trim()}` : newTranscript.trim()) }
                : lead
            );
            localStorage.setItem('hotLeads', JSON.stringify(newLeads));
            return newLeads;
        });
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
      const newItems = [newNewsItem.trim(), ...newsItems];
      setNewsItems(newItems);
      localStorage.setItem('companyNews', JSON.stringify(newItems));
      setNewNewsItem('');
      toast({ title: 'News Item Added' });
    }
  }, [newNewsItem, newsItems, toast]);

  const handleDeleteNewsItem = useCallback((indexToDelete: number) => {
    const newItems = newsItems.filter((_, index) => index !== indexToDelete);
    setNewsItems(newItems);
    localStorage.setItem('companyNews', JSON.stringify(newItems));
    toast({ title: 'News Item Removed' });
  }, [newsItems, toast]);
  
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
        const updatedDocs = [...companyDocs, newDoc];
        setCompanyDocs(updatedDocs);
        localStorage.setItem('companyDocs', JSON.stringify(updatedDocs));
        setNewDocName('');
        setNewDocUrl('');
        toast({ title: "Document Added", description: `${newDoc.name} has been added to your list.`});
      } catch (e) {
        toast({ variant: 'destructive', title: 'Invalid URL', description: 'Please enter a valid document URL.'});
      }
    } else {
      toast({ variant: 'destructive', title: 'Missing Information', description: 'Please provide both a name and a URL.' });
    }
  }, [newDocName, newDocUrl, companyDocs, toast]);

  const handleDeleteCompanyDoc = useCallback((docId: string) => {
    const updatedDocs = companyDocs.filter(doc => doc.id !== docId);
    setCompanyDocs(updatedDocs);
    localStorage.setItem('companyDocs', JSON.stringify(updatedDocs));
    toast({ title: "Document Removed" });
  }, [companyDocs, toast]);

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
    // This effect ensures the date is only set on the client, preventing hydration mismatch.
    setCurrentDate(new Date());
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
        const watchId = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                const currentTime = Date.now();

                if (lastLocation) {
                    const distance = haversineDistance(
                        { lat: lastLocation.lat, lng: lastLocation.lng },
                        { lat: latitude, lng: longitude }
                    );
                    const timeDiffSeconds = (currentTime - lastLocation.time) / 1000;
                    
                    if (timeDiffSeconds > 0) {
                        const speedMps = distance / timeDiffSeconds;
                        const speedMph = speedMps * 2.23694;
                        
                        setSpeedReadings(prevReadings => {
                            const newReadings = [...prevReadings, speedMph];
                            if (newReadings.length > 5) {
                                newReadings.shift(); // Keep only the last 5 readings
                            }
                            const avgSpeed = newReadings.reduce((a, b) => a + b, 0) / newReadings.length;
                            setCurrentSpeed(avgSpeed);
                            return newReadings;
                        });
                    }
                }
                setLastLocation({ lat: latitude, lng: longitude, time: currentTime });
            },
            (error) => {
                console.warn(`ERROR(${error.code}): ${error.message}`);
                setCurrentSpeed(0);
                setSpeedReadings([]);
            },
            {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0,
            }
        );

        return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [lastLocation]);

  useEffect(() => {
    setSelectedSalesperson(salespeople[0]);
  }, []);

  useEffect(() => {
    visitsRef.current = visits;
  }, [visits]);
  
  useEffect(() => {
    const loadLocalData = () => {
      try {
        const storedVisits = localStorage.getItem('visits');
        if (storedVisits) {
          const parsedVisits = JSON.parse(storedVisits).map((v: any) => ({
            ...v,
            timestamp: new Date(v.timestamp),
            futureMeetingDateTime: v.futureMeetingDateTime ? new Date(v.futureMeetingDateTime) : undefined,
            freeTrialStartDate: v.freeTrialStartDate ? new Date(v.freeTrialStartDate) : undefined,
          }));
          setVisits(parsedVisits);
        }

        const storedSuggestions = localStorage.getItem('submittedSuggestions');
        if (storedSuggestions) {
          setSubmittedSuggestions(JSON.parse(storedSuggestions).map((s: any) => ({ ...s, timestamp: new Date(s.timestamp) })));
        }

        const storedFiles = localStorage.getItem('managedFiles');
        if (storedFiles) setManagedFiles(JSON.parse(storedFiles));

        const storedCompanyDocs = localStorage.getItem('companyDocs');
        if (storedCompanyDocs) setCompanyDocs(JSON.parse(storedCompanyDocs));

        const storedHotLeads = localStorage.getItem('hotLeads');
        if (storedHotLeads) {
          setHotLeads(JSON.parse(storedHotLeads).map((hl: any) => ({ ...hl, addedAt: new Date(hl.addedAt) })));
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
          localStorage.setItem('companyNews', JSON.stringify(defaultNewsItems));
        }
      } catch (error) {
        console.error("Failed to load some local data:", error);
        toast({ variant: "destructive", title: "Local Data Issue", description: "Could not load some saved data from this device." });
      }
    };
    
    loadLocalData();

    if (!firebaseConfigured) {
      setIsSyncing(false);
      toast({
        variant: 'destructive',
        title: 'Firebase Not Configured',
        description: 'Syncing and real-time updates are disabled. Please check your .env file.',
        duration: 10000,
      });
    }
  }, [toast]);
  
  useEffect(() => {
    if (!db || !firebaseConfigured) {
        setIsSyncing(false);
        return;
    }
  
    const q = query(collection(db, "visits"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const visitsFromDb: Visit[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const visit: Visit = {
          id: doc.id,
          ...data,
          timestamp: (data.timestamp as Timestamp)?.toDate() || new Date(),
          futureMeetingDateTime: (data.futureMeetingDateTime as Timestamp)?.toDate(),
          freeTrialStartDate: (data.freeTrialStartDate as Timestamp)?.toDate(),
        } as Visit;
        visitsFromDb.push(visit);
      });

      // Merge with local data, Firebase is the source of truth
      setVisits(prevVisits => {
        const localVisits = new Map(prevVisits.map(v => [v.id, v]));
        visitsFromDb.forEach(dbVisit => localVisits.set(dbVisit.id, dbVisit));
        const mergedVisits = Array.from(localVisits.values());
        
        // Remove temp visits that have been replaced by real ones
        const finalVisits = mergedVisits.filter(v => {
            if (v.id.startsWith('temp_')) {
                // Check if a non-temp version exists
                return !mergedVisits.some(realV => !realV.id.startsWith('temp_') && realV.companyName === v.companyName && isSameDay(realV.timestamp, v.timestamp));
            }
            return true;
        });
        
        localStorage.setItem('visits', JSON.stringify(finalVisits));
        return finalVisits;
      });

      setIsSyncing(false);
    }, (error) => {
      console.error("Firestore real-time update error:", error);
      toast({
        variant: 'destructive',
        title: 'Connection Error',
        description: `Could not sync with the database. Using local data. Error: ${error.message}`
      });
      setIsSyncing(false);
    });
  
    return () => unsubscribe();
  }, [toast]);

  useEffect(() => {
    currentCityRef.current = currentCity;
  }, [currentCity]);
  
  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    const labels: { [key: string]: string } = {
      'field-day': 'Field Day',
      'planner': 'Planner',
      'call-day': 'Call Day',
      'visits': 'Visits Map',
      'ai-chat': 'Debbie AI',
      'about': 'About & Feedback',
    };
    setActiveTabLabel(labels[newTab] || '');
  };


  useEffect(() => {
    localStorage.setItem('submittedSuggestions', JSON.stringify(submittedSuggestions));
  }, [submittedSuggestions]);

  useEffect(() => {
    localStorage.setItem('companyDocs', JSON.stringify(companyDocs));
  }, [companyDocs]);

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
    setIsVisitFormOpen(true);
    setCurrentEditingVisit({
      id: `temp_${crypto.randomUUID()}`,
      timestamp: new Date(),
      visitNumber: todaysVisits.length + 1,
      companyName: '',
      latitude: undefined,
      longitude: undefined,
    } as Visit);
  };

  const handleEditVisit = (visit: Visit) => {
    setCurrentEditingVisit(visit);
    setIsVisitFormOpen(true);
  };

  const handleUpdateDealClosed = async (visitId: string, dealClosed: boolean) => {
    handleUpdateVisit(visitId, { dealClosed });
  };

  const handleLogFollowUp = (existingVisit: Visit) => {
    toast({ title: `Logging Follow-up for ${existingVisit.companyName}.` });
    
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
      visitNumber: todaysVisits.length + 1,
    };
    
    setCurrentEditingVisit(newVisitTemplate as Visit);
    setIsVisitFormOpen(true);
  };

  const handleDeleteVisit = async (visitId: string) => {
    // Optimistic Deletion
    const visitToDelete = visitsToDisplay.find(v => v.id === visitId);
    setVisits(prevVisits => {
        const newVisits = prevVisits.filter(v => v.id !== visitId);
        localStorage.setItem('visits', JSON.stringify(newVisits));
        return newVisits;
    });

    toast({
        title: 'Visit Deleted',
        description: `${visitToDelete?.companyName || 'The visit'} has been removed locally.`,
    });

    try {
        const result = await deleteVisitAction(visitId);
        if (result.error) {
            throw new Error(result.error);
        }
        // No need to update state again, as it's already done.
        // We could show a "synced" toast, but it might be noisy.
    } catch (error: any) {
        toast({
            variant: 'destructive',
            title: 'Sync Delete Failed',
            description: `Could not delete from cloud: ${error.message}. It remains deleted on this device.`,
        });
        // Here you might want to add logic to re-add the visit to the UI
        // or have a "pending deletes" queue if full offline-sync is needed.
        // For now, we'll keep it deleted optimistically.
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
    const recentVisits = visitsToDisplay.filter(visit => new Date(visit.timestamp) >= oneWeekAgo);
    
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
    
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 1);
    futureDate.setHours(10, 0, 0, 0);

    const newVisit: SaveVisitPayload = {
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
        visitNumber: todaysVisits.length + 1,
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
    
    handleSaveFromForm(newVisit);

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
    
    const newVisit: SaveVisitPayload = {
      timestamp: new Date(),
      companyName: lead.companyName,
      city: lead.city,
      latitude: lead.latitude,
      longitude: lead.longitude,
      notes: `Address: ${lead.address}\n\nHot Lead Notes:\n${lead.notes || 'No notes.'}`.trim(),
      decisionMakerContact: lead.phone,
      visitNumber: todaysVisits.length + 1,
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
      interestedUnits: [],
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
    
    handleSaveFromForm(newVisit);
    
    setConvertedHotLeads(prev => {
        const newSet = new Set(prev).add(lead.id);
        localStorage.setItem('convertedHotLeads', JSON.stringify(Array.from(newSet)));
        return newSet;
    });

    toast({
        title: "Added to Planner",
        description: `${lead.companyName} has been added to future visits to be scheduled.`,
    });
  };

  const handleHotspotCreation = useCallback(async () => {
    if (!lastLocation) {
        toast({ variant: 'destructive', title: 'Location Unknown', description: 'Cannot flag hotspot without a current location.' });
        return;
    }
  
    const hotspotToast = toast({ title: "Flagging Hotspot...", description: "Identifying location and creating a visit." });
  
    try {
        const companyDetails = await getCompanyNameFromCoordsAction({ latitude: lastLocation.lat, longitude: lastLocation.lng });
  
        if (companyDetails.error) {
            throw new Error(companyDetails.error);
        }
  
        const newVisit: SaveVisitPayload = {
            timestamp: new Date(),
            companyName: companyDetails.suggestedCompanyName || `Hotspot near ${companyDetails.address || 'your location'}`,
            city: companyDetails.city,
            latitude: lastLocation.lat,
            longitude: lastLocation.lng,
            notes: 'Flagged as a hotspot.',
            futureMeetingSet: true, // Mark for future planning
            futureMeetingDateTime: undefined, // But unscheduled
        };
  
        handleSaveFromForm(newVisit, { andClose: false, expandOnClose: false });
  
        hotspotToast.update({ id: hotspotToast.id, title: "Hotspot Flagged!", description: `${newVisit.companyName} added to your Planner.` });
    } catch (error: any) {
        hotspotToast.update({ id: hotspotToast.id, title: 'Error Flagging Hotspot', description: error.message, variant: 'destructive' });
    }
  }, [lastLocation, toast, handleSaveFromForm]);

  const handleConfirmStartupNavigation = async () => {
    if (!startupNavigationTarget) return;
  
    const { latitude, longitude, companyName } = startupNavigationTarget;
    
    setTargetDestination({ city: "Destination", description: `Navigating directly to ${companyName}.` });
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

  const handleCalendarSelect = useCallback(async (date?: Date) => {
      // If we are in "reschedule mode"
      if (visitToReschedule && date) {
          const updatedVisit = {
              ...visitToReschedule,
              futureMeetingDateTime: date,
          };
          const payload: SaveVisitPayload = updatedVisit;
          await handleSaveFromForm(payload, { andClose: false });

          toast({
              title: 'Meeting Rescheduled!',
              description: `${visitToReschedule.companyName} is now on ${format(date, 'PPP')}.`,
          });
          setVisitToReschedule(null); // Exit reschedule mode
      } else {
          // Normal date selection for filtering
          setSelectedDate(date);
          const meetingsOnDay = date ? visitsToDisplay.filter(v => 
              v.futureMeetingDateTime && isSameDay(new Date(v.futureMeetingDateTime), date)
          ) : [];
  
          if (meetingsOnDay.length > 0) {
              setVisitsForReschedule(meetingsOnDay);
              setIsRescheduleModalOpen(true);
          }
      }
  }, [visitToReschedule, visitsToDisplay, toast, handleSaveFromForm]);
  
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

  const handleInitiateReschedule = (visit: Visit) => {
    setVisitToReschedule(visit);
    setIsRescheduleModalOpen(false);
    setIsAllMeetingsModalOpen(false);
    toast({
        title: `Rescheduling: ${visit.companyName}`,
        description: "Please select a new date on the calendar.",
    });
    setActiveTab('call-day');
    setTimeout(() => {
      callDayFilterRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleImportReport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target?.result as string;
        try {
            const rows = text.split('\n').slice(1); // Skip header
            const imported: Visit[] = rows.filter(row => row.trim()).map(row => {
                // This is a simplified CSV parser and assumes no commas in quoted fields.
                // A more robust library would be better for production.
                const columns = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(col => col.replace(/"/g, ''));
                return {
                    id: columns[0] || `imported_${crypto.randomUUID()}`,
                    timestamp: new Date(columns[1]),
                    latitude: columns[2] ? parseFloat(columns[2]) : undefined,
                    longitude: columns[3] ? parseFloat(columns[3]) : undefined,
                    companyName: columns[4],
                    city: columns[5],
                    notes: columns[6],
                    contactInfo: (columns[7] || columns[8]) ? { info: columns[7], confidence: parseFloat(columns[8] || '0') } : undefined,
                    notesSummary: columns[9],
                    partnershipConfidence: columns[10] ? parseInt(columns[10]) : undefined,
                    hasBusinessCard: columns[11] === 'Yes',
                    businessCardImageFrontUrl: columns[12],
                    businessCardImageBackUrl: columns[13],
                    discussedCompetitors: columns[14] === 'Yes',
                    competitorName: columns[15],
                    coolerType: columns[16],
                    decisionMakerName: columns[17],
                    decisionMakerTitle: columns[18],
                    decisionMakerContact: columns[19],
                    visitNumber: columns[20] ? parseInt(columns[20]) : undefined,
                    interestedUnits: columns[21] ? columns[21].split('; ') : [],
                    hasTDSReading: columns[22] === 'Yes',
                    tdsValue: columns[23] ? parseFloat(columns[23]) : undefined,
                    futureMeetingSet: columns[24] === 'Yes',
                    futureMeetingDateTime: columns[25] ? new Date(columns[25]) : undefined,
                    freeTrial: columns[26] === 'Yes',
                    freeTrialStartDate: columns[27] ? new Date(columns[27]) : undefined,
                    dealClosed: columns[28] === 'Yes',
                    pricingDiscussed: columns[29] === 'Yes',
                    priceQuoted: columns[30] ? parseFloat(columns[30]) : undefined,
                    leaseTerm: columns[31] ? parseInt(columns[31]) : undefined,
                    installationFee: columns[32] ? parseFloat(columns[32]) : undefined,
                    creditApproved: columns[33] === 'Yes',
                    manualCommission: columns[34] ? parseFloat(columns[34]) : undefined,
                };
            });
            setImportedVisits(imported);
            toast({ title: 'Trail Imported', description: `Loaded ${imported.length} visits. You are now viewing another user's data.` });
        } catch (error) {
            console.error("Failed to parse CSV:", error);
            toast({ variant: 'destructive', title: 'Import Failed', description: 'Could not parse the CSV file. Please ensure it is a valid report.' });
        }
    };
    reader.readAsText(file);

    // Reset file input
    if (event.target) {
        event.target.value = '';
    }
  };


  const renderVisitCardAccordion = (visit: Visit, variant: 'default' | 'planner' = 'default') => (
    <AccordionItem value={visit.id} key={visit.id} className={cn("border bg-card rounded-lg overflow-hidden", variant === 'planner' ? 'border-orange-500 shadow-orange-500/20' : visit.dealClosed ? "border-green-500" : "border-primary/20")}>
      <AccordionTrigger className={cn("p-4 hover:no-underline w-full text-left [&[data-state=open]]:border-b", visit.dealClosed ? "[&[data-state=open]]:border-green-500" : "border-primary/20")}>
        <div className="flex flex-1 items-center justify-between min-w-0 gap-4">
          <div className="flex flex-1 items-center gap-3 min-w-0">
            <span className={cn("h-3 w-3 rounded-full shrink-0", visit.dealClosed ? "bg-green-500" : "bg-primary")}></span>
            <h4 className="font-semibold text-foreground truncate" title={visit.companyName}>{visit.companyName}</h4>
          </div>
          <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
            {(visit.interestedUnits && visit.interestedUnits.length > 0) ? (
                <span className="text-sm text-primary font-medium truncate">{`{${visit.interestedUnits[0].split('(')[0].trim()}${visit.interestedUnits.length > 1 ? `, +${visit.interestedUnits.length - 1}` : ''}}`}</span>
            ) : (
                <span>{format(new Date(visit.timestamp), 'MMM d, yy')}</span>
            )}
            {visit.partnershipConfidence && !visit.dealClosed && (
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
          variant={variant}
        />
      </AccordionContent>
    </AccordionItem>
  );

  const handleAddNewTrial = () => {
    setCurrentEditingVisit({
      id: `temp_${crypto.randomUUID()}`,
      timestamp: new Date(),
      companyName: '',
      freeTrial: true,
      futureMeetingSet: true,
      freeTrialStartDate: new Date(),
      futureMeetingDateTime: addDays(new Date(), 7),
    } as Visit);
    setIsVisitFormOpen(true);
  };
  

  return (
    <div className={cn("min-h-screen", visitToReschedule && "cursor-crosshair")}>
      <TerritoryUploadModal 
        isOpen={showTerritoryUploadModal}
        onClose={() => setShowTerritoryUploadModal(false)}
      />
      <div className={cn(
          "container mx-auto px-4 pt-2 pb-8 sm:px-6 lg:px-8 space-y-8",
          activeTab !== 'call-day' && visitToReschedule && "opacity-25 pointer-events-none"
      )}>
        <header className="flex flex-col items-center justify-center w-full pt-4 gap-2">
          <h1 className="text-6xl sm:text-8xl font-headline font-bold text-center aurora-text drop-shadow-lg" style={{ WebkitTextStroke: '1px hsl(var(--accent))' }}>
            Optimum Trailblazer
          </h1>
          <div className="w-full max-w-lg mx-auto mt-2">
            {selectedSalesperson && (
                <>
                {importedVisits ? (
                  <Alert variant="destructive" className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <AlertTitle>Viewing Imported Data</AlertTitle>
                      <AlertDescription>
                        You are currently viewing another user's report. To return to your data, click the button.
                      </AlertDescription>
                    </div>
                    <Button variant="outline" onClick={() => setImportedVisits(null)}>
                      <LogOut className="mr-2 h-4 w-4" />
                      Return to My Data
                    </Button>
                  </Alert>
                ) : (
                  <>
                  <div className="flex justify-center items-center gap-4 text-sm font-medium text-foreground mb-2">
                      <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-primary" />
                          <span className="font-semibold">{selectedSalesperson.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                           <CalendarIcon className="h-4 w-4 text-primary" />
                           <span className="font-semibold">{currentDate ? format(currentDate, 'MMM d, yyyy') : 'Loading...'}</span>
                      </div>
                  </div>

                  <Accordion type="single" collapsible>
                    <AccordionItem ref={dailyPlanRef} value="item-1" className="border-none">
                      <AccordionTrigger onClick={(e) => handleAccordionScroll(e, dailyPlanRef)} className={cn("p-3 bg-primary/10 backdrop-blur-sm rounded-lg border border-primary/20 hover:no-underline data-[state=open]:rounded-b-none", "bluish-glow")}>
                        <div className="flex items-center justify-between w-full gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <Compass className="h-5 w-5 text-primary flex-shrink-0" />
                            <div className="flex flex-col items-start">
                              <span className="font-semibold text-foreground truncate">Daily Plan</span>
                            </div>
                          </div>
                          <div className="flex justify-end min-w-[80px] items-center gap-2">
                            <div className="flex items-center text-green-400" title={`Current Speed: ${currentSpeed.toFixed(1)} MPH`}>
                              <Gauge className="mr-1 h-4 w-4" />
                              <span className="font-mono">{currentSpeed.toFixed(0)}</span>
                            </div>
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
                          
                          <Button variant="default" onClick={() => handleChangeDestination()}>
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
                  </>
                )}
              </>
            )}
          </div>
        </header>

        <div className="text-center text-sm font-medium text-foreground mb-2">{activeTabLabel}</div>
        
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-6 mb-2 bg-primary/10 backdrop-blur-sm p-1 rounded-full border-2 border-primary/30 shadow-inner">
            <TabsTrigger value="field-day" className="rounded-full border-transparent data-[state=active]:bg-orange-500 data-[state=active]:text-white data-[state=active]:shadow-lg flex items-center justify-center gap-2">
              <PlusCircle className="h-5 w-5" />
              <span className="hidden sm:inline">Field Day</span>
            </TabsTrigger>
            <TabsTrigger value="planner" className="rounded-full border-transparent data-[state=active]:bg-orange-500 data-[state=active]:text-white data-[state=active]:shadow-lg flex items-center justify-center gap-2">
              <FolderKanban className="h-5 w-5" />
              <span className="hidden sm:inline">Planner</span>
            </TabsTrigger>
            <TabsTrigger value="call-day" className="rounded-full border-transparent data-[state=active]:bg-orange-500 data-[state=active]:text-white data-[state=active]:shadow-lg flex items-center justify-center gap-2">
              <ListChecks className="h-5 w-5" />
              <span className="hidden sm:inline">Call Day</span>
            </TabsTrigger>
            <TabsTrigger
              value="visits"
              className="rounded-full border-transparent data-[state=active]:bg-orange-500 data-[state=active]:text-white data-[state=active]:shadow-lg flex items-center justify-center gap-2"
              onClick={(e) => {
                if (visitsToDisplay.length === 0) {
                  e.preventDefault();
                  toast({title: 'No visits to show at the moment!'});
                }
              }}
            >
              <MapPin className="h-5 w-5" />
              <span className="hidden sm:inline">Visits</span>
            </TabsTrigger>
            <TabsTrigger value="ai-chat" className="rounded-full border-transparent data-[state=active]:bg-orange-500 data-[state=active]:text-white data-[state=active]:shadow-lg flex items-center justify-center gap-2">
              <Bot className="h-5 w-5" />
              <span className="hidden sm:inline">Debbie</span>
            </TabsTrigger>
            <TabsTrigger value="about" className="rounded-full border-transparent data-[state=active]:bg-orange-500 data-[state=active]:text-white data-[state=active]:shadow-lg flex items-center justify-center gap-2">
              <InfoIcon className="h-5 w-5" />
              <span className="hidden sm:inline">About</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        
        <div className={cn("mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
             activeTab === 'call-day' && visitToReschedule && "relative z-40"
        )}>
          {activeTab === 'field-day' && (
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-center items-stretch gap-4">
                    <Button onClick={handleQuickLog} variant="default" size="sm" className="py-6 sm:py-2 text-base sm:text-sm" disabled={!!importedVisits}>
                        <PlusCircle className="mr-2 h-5 w-5" />
                        Quicklog
                    </Button>
                    <Button onClick={() => setIsFindCompanyModalOpen(true)} variant="secondary" size="sm" className="py-6 sm:py-2 text-base sm:text-sm" disabled={!!importedVisits}>
                      <UserPlus className="mr-2 h-4 w-4" /> Telemarketer Lead
                    </Button>
                </div>
                <Accordion type="single" collapsible>
                  <AccordionItem ref={todaysVisitsRef} value="todays-visits" className="border-none">
                    <AccordionTrigger onClick={(e) => handleAccordionScroll(e, todaysVisitsRef)} className={cn("p-4 bg-card rounded-lg shadow-lg hover:no-underline data-[state=open]:rounded-b-none", "bluish-glow")}>
                      <div className="flex items-center justify-center w-full">
                        <div className="flex items-center justify-center gap-2">
                          <PlusCircle className="h-5 w-5 text-primary" />
                          <h3 className="text-lg font-medium text-foreground text-center">
                            Today's Visits ({todaysVisits.length})
                          </h3>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="bg-card/60 backdrop-blur-sm border border-primary/20 rounded-b-lg shadow-lg border-t-0 p-4 pt-6">
                      <Accordion 
                        type="multiple"
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
                                    {visit.partnershipConfidence && !visit.dealClosed && (
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
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
                 <Accordion type="single" collapsible>
                  <AccordionItem ref={pastVisitsRef} value="past-visits" className="border-none">
                    <AccordionTrigger onClick={(e) => handleAccordionScroll(e, pastVisitsRef)} className={cn("p-4 bg-card rounded-lg shadow-lg hover:no-underline data-[state=open]:rounded-b-none", "bluish-glow")}>
                      <div className="flex items-center justify-center w-full">
                        <div className="flex items-center justify-center gap-2">
                          <ListChecks className="h-5 w-5 text-primary" />
                          <h3 className="text-lg font-medium text-foreground text-center">
                            Past Visits
                          </h3>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="bg-card/60 backdrop-blur-sm border border-primary/20 rounded-b-lg shadow-lg border-t-0 p-4 pt-6 space-y-2">
                       <div className="relative w-full max-w-sm mx-auto mb-4">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="text"
                                placeholder={isRecordingFieldDaySearch ? "Listening for search term..." : "Search company name..."}
                                className="pl-10 pr-20"
                                value={fieldDaySearchTerm}
                                onChange={(e) => setFieldDaySearchTerm(e.target.value)}
                                disabled={isRecordingFieldDaySearch}
                            />
                            {fieldDaySearchTerm && !isRecordingFieldDaySearch && (
                                <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => setFieldDaySearchTerm('')}
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
                                onClick={handleToggleVoiceFieldDaySearch}
                                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                                aria-label="Search with voice"
                                title="Search with voice"
                            >
                                {isRecordingFieldDaySearch ? (
                                <Mic className="h-4 w-4 text-red-500 animate-pulse" />
                                ) : (
                                <Mic className="h-4 w-4 text-foreground" />
                                )}
                            </Button>
                        </div>
                      <Accordion type="multiple" className="w-full space-y-4">
                        {pastVisitsByDay.map(([day, visitsOnDay]) => (
                          <AccordionItem value={day} key={day} className="border-none">
                            <AccordionTrigger className={cn("p-3 bg-card/80 rounded-lg shadow-md hover:no-underline data-[state=open]:rounded-b-none", "bluish-glow")}>
                              <div className="flex justify-between w-full items-center">
                                  <h4 className="font-semibold text-lg text-foreground">{format(addDays(new Date(day), 1), 'eeee, MMMM d, yyyy')}</h4>
                                  <Badge variant="secondary">{visitsOnDay.length} visit{visitsOnDay.length === 1 ? '' : 's'}</Badge>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="p-4 border border-t-0 rounded-b-lg bg-card/60">
                              <Accordion type="multiple" className="space-y-4">
                                {visitsOnDay.map(visit => renderVisitCardAccordion(visit))}
                              </Accordion>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
            </div>
          )}
          
          {activeTab === 'planner' && (
              <div className="space-y-6">
                  {scheduledVisits.length > 0 && (
                      <Accordion type="single" collapsible>
                          <AccordionItem ref={scheduledVisitsRef} value="scheduled-visits" className="border-none">
                              <AccordionTrigger onClick={(e) => handleAccordionScroll(e, scheduledVisitsRef)} className={cn("p-4 bg-card rounded-lg shadow-lg hover:no-underline data-[state=open]:rounded-b-none", "bluish-glow")}>
                                <div className="flex items-center justify-center w-full">
                                  <div className="flex items-center justify-center gap-2">
                                      <CalendarCheck className="h-5 w-5 text-green-500" />
                                      <h3 className="text-lg font-medium text-foreground text-center">
                                          Future Meetings (Scheduled) ({scheduledVisits.length})
                                      </h3>
                                  </div>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="bg-card/60 backdrop-blur-sm border border-primary/20 rounded-b-lg shadow-lg border-t-0 p-4 pt-6 space-y-4">
                                  <Accordion type="multiple" className="w-full space-y-4">
                                    {scheduledVisits.map(visit => renderVisitCardAccordion(visit, 'planner'))}
                                  </Accordion>
                              </AccordionContent>
                          </AccordionItem>
                      </Accordion>
                  )}

                  <Accordion type="single" collapsible>
                    <AccordionItem ref={unscheduledVisitsRef} value="unscheduled-visits" className="border-none">
                        <AccordionTrigger onClick={(e) => handleAccordionScroll(e, unscheduledVisitsRef)} className={cn("p-4 bg-card rounded-lg shadow-lg hover:no-underline data-[state=open]:rounded-b-none", "bluish-glow")}>
                          <div className="flex items-center justify-center w-full">
                            <div className="flex items-center justify-center gap-2">
                                <CalendarIcon className="h-5 w-5 text-blue-500" />
                                <h3 className="text-lg font-medium text-foreground text-center">
                                    Future Visits (Unscheduled) ({unscheduledFutureVisits.length})
                                </h3>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="bg-card/60 backdrop-blur-sm border border-primary/20 rounded-b-lg shadow-lg border-t-0 p-4 pt-6 space-y-4">
                          <div className="flex justify-center mb-4">
                              <Button onClick={handleAddNewFutureVisit} disabled={!!importedVisits}>
                                  <PlusSquare className="mr-2 h-4 w-4" /> Add Future Visit
                              </Button>
                          </div>
                          {unscheduledFutureVisits.length > 0 && (
                            <Accordion type="multiple" className="w-full space-y-4">
                              {unscheduledFutureVisits.map(visit => renderVisitCardAccordion(visit, 'planner'))}
                            </Accordion>
                          )}
                        </AccordionContent>
                    </AccordionItem>
                  </Accordion>


                  {flaggedHotspots.length > 0 && (
                      <Accordion type="single" collapsible>
                          <AccordionItem ref={flaggedHotspotsRef} value="flagged-hotspots" className="border-none">
                              <AccordionTrigger onClick={(e) => handleAccordionScroll(e, flaggedHotspotsRef)} className={cn("p-4 bg-card rounded-lg shadow-lg hover:no-underline data-[state=open]:rounded-b-none", "bluish-glow")}>
                                <div className="flex items-center justify-center w-full">
                                  <div className="flex items-center justify-center gap-2">
                                    <Flame className="h-5 w-5 text-red-500" />
                                    <h3 className="text-lg font-medium text-foreground text-center">
                                        Flagged Hotspots ({flaggedHotspots.length})
                                    </h3>
                                  </div>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="bg-card/60 backdrop-blur-sm border border-primary/20 rounded-b-lg shadow-lg border-t-0 p-4 pt-6 space-y-4">
                                <Accordion type="multiple" className="w-full space-y-4">
                                    {flaggedHotspots.map(visit => renderVisitCardAccordion(visit, 'planner'))}
                                </Accordion>
                              </AccordionContent>
                          </AccordionItem>
                      </Accordion>
                  )}

                  <div className="space-y-4">
                      <Accordion type="single" collapsible>
                          <AccordionItem ref={activeFreeTrialsRef} value="active-free-trials" className="border-none">
                              <AccordionTrigger onClick={(e) => handleAccordionScroll(e, activeFreeTrialsRef)} className={cn("p-4 bg-card rounded-lg shadow-lg hover:no-underline data-[state=open]:rounded-b-none", "bluish-glow")}>
                                  <div className="flex items-center justify-center w-full">
                                    <div className="flex items-center justify-center gap-2">
                                      <PackageCheck className="h-5 w-5 text-orange-500" />
                                      <h3 className="text-lg font-medium text-foreground text-center">
                                          In Trial ({activeFreeTrials.length})
                                      </h3>
                                    </div>
                                  </div>
                              </AccordionTrigger>
                              <AccordionContent className="bg-card/60 backdrop-blur-sm border border-primary/20 rounded-b-lg shadow-lg border-t-0 p-4 pt-6 space-y-4">
                                <div className="flex justify-center mb-4">
                                    <Button onClick={handleAddNewTrial} disabled={!!importedVisits}>
                                        <PlusSquare className="mr-2 h-4 w-4" /> Add New Trial
                                    </Button>
                                </div>
                                <Accordion type="multiple" className="w-full space-y-4">
                                  {activeFreeTrials.map(visit => renderVisitCardAccordion(visit, 'planner'))}
                                </Accordion>
                                {totalTrialCommission > 0 && (
                                    <Alert variant="default" className="mt-4 text-left">
                                        <PartyPopper className="h-4 w-4 text-orange-500" />
                                        <AlertTitle className="font-bold text-orange-400">Total Potential Commission</AlertTitle>
                                        <AlertDescription className="text-2xl font-bold text-foreground">
                                            ${totalTrialCommission.toFixed(2)}
                                        </AlertDescription>
                                    </Alert>
                                )}
                              </AccordionContent>
                          </AccordionItem>
                      </Accordion>
                      <Accordion type="single" collapsible>
                          <AccordionItem ref={dealsClosedRef} value="deals-closed" className="border-none">
                              <AccordionTrigger onClick={(e) => handleAccordionScroll(e, dealsClosedRef)} className={cn("p-4 bg-card rounded-lg shadow-lg hover:no-underline data-[state=open]:rounded-b-none", "bluish-glow")}>
                                  <div className="flex items-center justify-center w-full">
                                    <div className="flex items-center justify-center gap-2">
                                      <PartyPopper className="h-5 w-5 text-green-500" />
                                      <h3 className="text-lg font-medium text-foreground text-center">
                                          Deals Closed ({closedDeals.length})
                                      </h3>
                                    </div>
                                  </div>
                              </AccordionTrigger>
                              <AccordionContent className="bg-card/60 backdrop-blur-sm border border-primary/20 rounded-b-lg shadow-lg border-t-0 p-4 pt-6 space-y-4">
                                  {closedDealsCoolerSummary.length > 0 && (
                                    <div className="mb-4 rounded-lg border bg-background/50 p-3">
                                      <h4 className="mb-2 text-center font-semibold text-foreground">Closed Deal Unit Totals</h4>
                                      <div className="flex flex-wrap justify-center gap-2">
                                        {closedDealsCoolerSummary.map(([name, count]) => (
                                          <Badge key={name} variant="secondary" className="text-sm">
                                            {name}: <span className="ml-1.5 font-bold">{count}</span>
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  <Accordion type="multiple" className="w-full space-y-4">
                                    {closedDeals.map(visit => renderVisitCardAccordion(visit))}
                                  </Accordion>
                                  {totalClosedCommission > 0 && (
                                    <Alert variant="default" className="mt-4 text-left">
                                        <PartyPopper className="h-4 w-4 text-green-500" />
                                        <AlertTitle className="font-bold text-green-400">Total Closed Commission</AlertTitle>
                                        <AlertDescription className="text-2xl font-bold text-foreground">
                                            ${totalClosedCommission.toFixed(2)}
                                        </AlertDescription>
                                    </Alert>
                                  )}
                              </AccordionContent>
                          </AccordionItem>
                      </Accordion>
                  </div>
              </div>
          )}

          {activeTab === 'call-day' && (
            <div className="space-y-6">
              <Accordion type="single" collapsible>
                <AccordionItem ref={callDayFilterRef} value="item-1" className="border-none">
                  <AccordionTrigger onClick={(e) => handleAccordionScroll(e, callDayFilterRef)} className={cn("p-4 bg-card rounded-lg shadow-lg hover:no-underline data-[state=open]:rounded-b-none", "bluish-glow")}>
                    <div className="flex items-center justify-center w-full">
                      <div className="flex items-center justify-center gap-2">
                        <ListFilter className="h-5 w-5 text-primary" />
                        <h3 className="text-lg font-medium text-foreground text-center">
                            Filter &amp; Sort
                        </h3>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="bg-card/60 backdrop-blur-sm border border-primary/20 rounded-b-lg shadow-lg border-t-0 p-4">
                    <div className="flex flex-col gap-6 items-center">
                      <div className={cn("flex flex-col items-center w-full", visitToReschedule && "relative z-50 bg-background p-2 rounded-lg")}>
                        <div className="w-full mb-2 space-y-2">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={scheduledVisits.length === 0 || !!importedVisits}
                                    >
                                        <RefreshCw className="mr-2 h-4 w-4" />
                                        Reschedule an Appointment
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-64">
                                    {scheduledVisits.map(visit => (
                                        <DropdownMenuItem key={visit.id} onSelect={() => handleInitiateReschedule(visit)}>
                                            <div className="flex flex-col">
                                                <span>{visit.companyName}</span>
                                                <span className="text-xs text-muted-foreground">
                                                    {visit.futureMeetingDateTime ? format(new Date(visit.futureMeetingDateTime), 'PP') : 'Unscheduled'}
                                                </span>
                                            </div>
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={handleCalendarSelect}
                          className={cn("rounded-md border", "bluish-glow")}
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
                        <div className="w-full mt-2">
                          {selectedDate && !visitToReschedule && (
                              <Button
                                  onClick={handleScheduleFromCalendar}
                                  size="sm"
                                  disabled={!!importedVisits}
                              >
                                  <PlusSquare className="mr-2 h-4 w-4" />
                                  Schedule on {format(selectedDate, 'MMM d')}
                              </Button>
                          )}
                        </div>
                      </div>

                      <Accordion type="single" collapsible className="w-full max-w-sm">
                        <AccordionItem value="sorters" className="border-b-0">
                          <AccordionTrigger className="text-sm flex items-center justify-center w-full">
                            Sort Options
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="flex flex-col sm:flex-row gap-4 items-center w-full pt-2">
                              <div className="flex flex-col gap-1.5 flex-1">
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
                                  <SelectTrigger id="sort-criteria">
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
                                <div className="flex flex-col gap-1.5 flex-1">
                                    <Label htmlFor="city-search" className="text-sm text-center">Filter by City</Label>
                                    <Select
                                        value={citySearchTerm}
                                        onValueChange={(value) => setCitySearchTerm(value === '_all_' ? '' : value)}
                                    >
                                        <SelectTrigger id="city-search">
                                            <SelectValue placeholder="Select a city..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="_all_">All Cities</SelectItem>
                                            {uniqueCities.map(city => (
                                                <SelectItem key={city} value={city}>{city}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                              ) : (
                                <div className="flex flex-col gap-1.5 flex-1">
                                  <Label htmlFor="sort-order" className="text-sm text-center">Order</Label>
                                  <Select
                                    value={sortOrder}
                                    onValueChange={(value) => setSortOrder(value as 'asc' | 'desc')}
                                  >
                                    <SelectTrigger id="sort-order">
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
                      <Separator />
                      <ExportPdfButton
                        visits={sortedVisitsForCallDay}
                        reportTitle={sortedVisitsTitle}
                        label="Export Sorted Visits to PDF"
                        size="sm"
                        salespersonName={selectedSalesperson?.name}
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
              
              <div className="mt-6 mb-4 flex justify-center">
                <ExportPdfButton
                  visits={visitsToDisplay}
                  label="Export All Visits to PDF"
                  salespersonName={selectedSalesperson?.name}
                  reportTitle="All Visits"
                  variant="default"
                />
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
                <Accordion type="single" collapsible defaultValue="visit-cards">
                  <AccordionItem ref={visitCardsRef} value="visit-cards" className="border-none">
                    <AccordionTrigger onClick={(e) => handleAccordionScroll(e, visitCardsRef)} className={cn("p-4 bg-card rounded-lg shadow-lg hover:no-underline data-[state=open]:rounded-b-none", "bluish-glow")}>
                      <div className="flex items-center justify-center w-full">
                        <div className="flex items-center justify-center gap-2">
                          <ListChecks className="h-5 w-5 text-primary" />
                          <h3 className="text-lg font-medium text-foreground text-center">
                            {sortedVisitsTitle} ({sortedVisitsForCallDay.length})
                          </h3>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="bg-card/60 backdrop-blur-sm border border-primary/20 rounded-b-lg shadow-lg border-t-0 p-4 pt-6">
                      <div className="relative w-full max-w-sm mx-auto mb-6">
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
                            <Mic className="h-4 w-4 text-foreground" />
                          )}
                        </Button>
                      </div>
                      <CallDayVisitList 
                        visits={sortedVisitsForCallDay}
                        onEdit={handleEditVisit}
                        onDelete={handleDeleteVisit}
                        onUpdateDealClosed={handleUpdateDealClosed}
                        onZoom={setZoomedVisit}
                        onLogFollowUp={handleLogFollowUp}
                        onDictateNotes={handleDictateNotes}
                      />
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}
            </div>
          )}

          {activeTab === 'visits' && (
            <Accordion type="single" collapsible>
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
                      {visitsToDisplay.length > 0 && (
                           <div className="flex flex-col items-center gap-2">
                                <Badge variant="default" className="text-lg font-medium bg-accent text-accent-foreground hover:bg-accent/90 border-transparent">
                                    Your Visits: {visitsToDisplay.length}
                                </Badge>
                                <div className="flex flex-wrap gap-2 justify-center">
                                    <ExportHotLeadsPdfButton hotLeads={hotLeads} className="h-8 px-2 text-xs" />
                                    <Button onClick={handleEmailManager} variant="default" size="sm" className="h-8 px-2 text-xs" disabled={!!importedVisits}>
                                    Email Manager
                                    </Button>
                                </div>
                            </div>
                      )}
                  </div>
                  <MapPlaceholder visits={visitsToDisplay} />
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
              <Accordion type="single" collapsible>
                <AccordionItem ref={debbieRef} value="debbie-chat" className="border-none">
                  <AccordionTrigger onClick={(e) => handleAccordionScroll(e, debbieRef)} className={cn("p-4 bg-card rounded-lg shadow-lg hover:no-underline data-[state=open]:rounded-b-none data-[state=open]:mb-0", "bluish-glow")}>
                    <div className="flex w-full items-center">
                      <div className="flex items-center justify-start w-10 shrink-0">
                        <Bot className="h-7 w-7 text-primary" />
                      </div>
                      <h2 className="text-2xl font-headline font-semibold text-foreground flex-1 text-center">
                        Debbie AI Assistant
                      </h2>
                      <div className="w-10 shrink-0"></div>
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
                            {isRecordingChat ? <Mic className="h-4 w-4 text-red-500 animate-pulse" /> : <Mic className="h-4 w-4 text-foreground" />}
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
              <Accordion type="single" collapsible>
                <AccordionItem ref={newsFeedRef} value="news-feed" className="border-none">
                  <AccordionTrigger onClick={(e) => handleAccordionScroll(e, newsFeedRef)} className={cn("p-4 bg-card rounded-lg shadow-lg hover:no-underline data-[state=open]:rounded-b-none data-[state=open]:mb-0", "bluish-glow")}>
                    <div className="flex w-full items-center">
                      <div className="flex items-center justify-start w-10 shrink-0">
                        <Newspaper className="h-7 w-7 text-primary" />
                      </div>
                      <h2 className="text-2xl font-headline font-semibold text-foreground flex-1 text-center">Optimum News</h2>
                      <div className="w-10 shrink-0"></div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-0">
                    <UiCard className="w-full rounded-t-none border-t-0 bg-card border border-primary/20 flex flex-col">
                      <UiCardContent className="pt-6">
                        {newsItems.length > 0 ? (
                            <ul className="space-y-3 text-sm text-foreground">
                              {newsItems.map((item, index) => (
                                <li key={index} className="flex justify-between items-start group">
                                  <span className="flex-grow"><span className="text-primary font-bold mr-2">→</span>{item}</span>
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
              
              <Accordion type="single" collapsible>
                <AccordionItem ref={eagleEyeRef} value="eagle-eye-feed" className="border-none">
                  <AccordionTrigger onClick={(e) => handleAccordionScroll(e, eagleEyeRef)} className={cn("p-4 bg-card rounded-lg shadow-lg hover:no-underline data-[state=open]:rounded-b-none data-[state=open]:mb-0", "bluish-glow")}>
                    <div className="flex w-full items-center">
                      <div className="flex items-center justify-start w-10 shrink-0">
                        <UserCog className="h-7 w-7 text-primary" />
                      </div>
                      <h2 className="text-2xl font-headline font-semibold text-foreground flex-1 text-center">
                        Eagle Eye
                      </h2>
                      <div className="w-10 shrink-0"></div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-0">
                    <UiCard className="w-full rounded-t-none border-t-0 bg-card border border-primary/20 flex flex-col">
                      <UiCardHeader>
                        <UiCardTitle>Live Chat &amp; Notifications</UiCardTitle>
                        <UiCardDescription>
                          This section will contain live updates, messages, and notifications from the Eagle Eye command station.
                        </UiCardDescription>
                      </UiCardHeader>
                      <UiCardContent className="space-y-4">
                         <div className="text-center text-sm text-muted-foreground p-8 rounded-md border border-dashed">
                            Real-time chat and notification functionality will be implemented here.
                        </div>
                      </UiCardContent>
                    </UiCard>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <Accordion type="single" collapsible>
                <AccordionItem ref={companyDocsRef} value="company-docs" className="border-none">
                  <AccordionTrigger onClick={(e) => handleAccordionScroll(e, companyDocsRef)} className={cn("p-4 bg-card rounded-lg shadow-lg hover:no-underline data-[state=open]:rounded-b-none data-[state=open]:mb-0", "bluish-glow")}>
                    <div className="flex w-full items-center">
                      <div className="flex items-center justify-start w-10 shrink-0">
                        <FileText className="h-7 w-7 text-primary" />
                      </div>
                      <h2 className="text-2xl font-headline font-semibold text-foreground flex-1 text-center">Company Documents</h2>
                      <div className="w-10 shrink-0"></div>
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
                                          <Button variant="destructive" size="icon" className="h-7 w-7" onClick={() => handleDeleteCompanyDoc(doc.id)}>
                                              <Trash2 className="h-4 w-4" />
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
            </div>
          )}
          
          {activeTab === 'about' && (
            <div className="p-6 bg-card rounded-xl shadow-xl min-h-[300px] flex flex-col items-start space-y-6">
                <div className="w-full text-center">
                    <h2 className="text-2xl font-headline font-semibold text-primary flex items-center justify-center">
                        <InfoIcon className="mr-3 h-7 w-7" /> App Guide
                    </h2>
                </div>

                <Tabs defaultValue="about-field-day" className="w-full">
                    <TabsList className="grid w-full grid-cols-7 mb-4 bg-primary/10 backdrop-blur-sm p-1 rounded-full border border-primary/20">
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
                        <TabsTrigger value="about-data" className="rounded-full border-transparent data-[state=active]:bg-primary/20 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg flex items-center justify-center">
                           <Database className="h-5 w-5" />
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
                                <strong>Flag Hotspot:</strong> Tap the <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-red-500 text-white shadow-md align-middle"><Flame className="h-4 w-4" /></span> button to mark locations that look promising while you are driving but have other arrangements.
                            </li>
                            <li>
                                <strong>Quicklog:</strong> Use <span className="inline-block bg-accent text-black px-2 py-1 rounded-md text-xs font-semibold">Quicklog</span> to create a new record for any business.
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
                                <strong>Smart Scheduling &amp; Calendar:</strong> If your notes mention a meeting, Debbie automatically schedules it. This syncs with the calendar in the "Call Day" tab, which uses color-coding: <span className="text-orange-500 font-bold">Orange</span> for future meetings, <span className="text-green-500 font-bold">Green</span> for closed deals, <span className="text-cyan-400 font-bold">Turquoise</span> for days you were out in the field, and <span className="text-red-500 font-bold">Red</span> for when a free trial ends.
                            </li>
                            <li>
                                <strong>Document Analysis:</strong> In the chat, you can upload PDFs or CSVs to give Debbie context for your questions. You can also upload files for long-term memory via the "Manage Files" button.
                            </li>
                             <li>
                                <strong>Lead Generation:</strong> Use the "Find Company" feature to search for businesses in your territory. The results are automatically added as "Hot Leads" in this tab, ready for you to review and convert into future visits.
                            </li>
                        </ul>
                    </TabsContent>
                    
                    <TabsContent value="about-data" className="text-foreground text-base leading-relaxed p-4 bg-background/20 rounded-lg">
                        <DataUsageDashboard visits={visits} hotLeads={hotLeads} managedFiles={managedFiles} />
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
                                        <Mic className="h-4 w-4 text-foreground" />
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
                    <Button variant="outline" onClick={() => setIsDestinationModalOpen(false)} disabled={isFindingParking || isExtractingCities}>
                        {isFindingParking || isExtractingCities ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Close'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        
        <Dialog open={isRescheduleModalOpen} onOpenChange={setIsRescheduleModalOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Reschedule a Meeting</DialogTitle>
                    <DialogDescription>
                        Select a meeting from {selectedDate ? format(selectedDate, 'PPP') : 'the selected date'} to reschedule.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-2 py-4">
                    {visitsForReschedule.map(visit => (
                        <div key={visit.id} className="flex items-center justify-between p-2 rounded-md border">
                            <div>
                                <p className="font-semibold">{visit.companyName}</p>
                                <p className="text-sm text-muted-foreground">
                                    {visit.futureMeetingDateTime ? format(new Date(visit.futureMeetingDateTime), 'p') : 'Time not set'}
                                </p>
                            </div>
                            <Button size="sm" onClick={() => handleInitiateReschedule(visit)}>Reschedule</Button>
                        </div>
                    ))}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsRescheduleModalOpen(false)}>Cancel</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <Dialog open={isAllMeetingsModalOpen} onOpenChange={setIsAllMeetingsModalOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Reschedule an Appointment</DialogTitle>
                    <DialogDescription>
                        Select one of your upcoming scheduled appointments to reschedule.
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-96 my-4">
                  <div className="space-y-2 pr-4">
                      {scheduledVisits.map(visit => (
                          <div key={visit.id} className="flex items-center justify-between p-2 rounded-md border">
                              <div>
                                  <p className="font-semibold">{visit.companyName}</p>
                                  <p className="text-sm text-muted-foreground">
                                      {visit.futureMeetingDateTime ? format(new Date(visit.futureMeetingDateTime), 'PPp') : 'Time not set'}
                                  </p>
                              </div>
                              <Button size="sm" onClick={() => handleInitiateReschedule(visit)}>Reschedule</Button>
                          </div>
                      ))}
                  </div>
                </ScrollArea>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAllMeetingsModalOpen(false)}>Cancel</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        
        <FindCompanyModal
            isOpen={isFindCompanyModalOpen}
            onClose={() => setIsFindCompanyModalOpen(false)}
            onAddAsVisit={handleAddFoundCompanyAsVisit}
            onAddHotLeads={handleAddHotLeads}
            destinationCities={destinationCities}
            isTelemarketerLeadMode={true}
            hotLeads={hotLeads}
            onDeleteHotLead={handleDeleteHotLead}
            onUpdateHotLeadNotes={handleUpdateHotLeadNotes}
            convertedHotLeads={convertedHotLeads}
            onAddHotLeadAsVisit={handleAddHotLeadAsVisit}
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
              <DialogTitle>Navigate to Today's Meeting?</DialogTitle>
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
        className="fixed bottom-6 right-6 h-16 w-16 rounded-full bg-red-500 text-white shadow-lg flex items-center justify-center z-50 transition-transform hover:scale-110 active:scale-100 disabled:bg-gray-500 disabled:cursor-not-allowed"
        aria-label="Flag Hotspot"
        disabled={!!importedVisits || currentSpeed < 25}
        title={currentSpeed < 25 ? "Enable by driving over 25 MPH" : "Flag Hotspot"}
      >
        <Flame className="h-8 w-8" />
      </button>
      <footer className="text-center py-8 text-muted-foreground text-sm border-t mt-12">
        <p>&copy; {currentDate ? new Date().getFullYear() : '...'} Optimum Trailblazer. Your personal sales companion.</p>
         <p className="text-xs mt-1">
            {firebaseConfigured ? "Data is being synced with the cloud in real-time." : "Data is saved locally to your browser."}
         </p>
      </footer>
    </div>
  );
}
    

    







