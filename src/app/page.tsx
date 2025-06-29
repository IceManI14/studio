
'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import type { Visit, ChatMessage, Salesperson, Territory, ManagedFile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import VisitForm, { type VisitFormData } from '@/components/visit-form';
import VisitCard from '@/components/visit-card';
import ExportButton from '@/components/export-button';
import ExportPdfButton from '@/components/export-pdf-button';
import GoogleMapComponent from '@/components/google-map';
import { PlusCircle, ListChecks, User, InfoIcon, Sunset, Send, PartyPopper, MessagesSquare, Hash, Mail, ListFilter, Bot, MapPin, Brain, Loader2, Paperclip, XCircle, Swords, UserCog, AlertTriangle, WifiOff, Search, FolderKanban, Map } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
import { format, subDays, isSameDay } from 'date-fns';
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
import { Card as UiCard, CardContent as UiCardContent, CardHeader as UiCardHeader, CardFooter as UiCardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getAiChatResponseAction, getCompanyNameFromCoordsAction, findOptimalParkingAction, extractCitiesFromPdfAction, findCompanyAction, saveVisitAction, quickCreateVisitAction } from '@/app/actions';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { db, firebaseConfigured } from '@/lib/firebase';
import { collection, doc, setDoc, addDoc, deleteDoc, updateDoc, onSnapshot, query, orderBy, getDoc } from 'firebase/firestore';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import SalespersonSelectorModal from '@/components/salesperson-selector-modal';
import TerritoryUploadModal from '@/components/territory-upload-modal';
import FindCompanyModal from '@/components/find-company-modal';
import ManageFilesModal from '@/components/manage-files-modal';
import { fileToDataUri } from '@/lib/utils';
import { Calendar } from "@/components/ui/calendar";
import type { SaveVisitPayload } from '@/app/actions';


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
  const [isVisitFormOpen, setIsVisitFormOpen] = useState(false);
  const [currentEditingVisit, setCurrentEditingVisit] = useState<Visit | undefined>(undefined);
  const [coldCallCount, setColdCallCount] = useState<number>(0);
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

  const callDayCardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const isAutoScrollingRef = useRef(false);

  const [selectedSalesperson, setSelectedSalesperson] = useState<Salesperson | null>(null);
  const [isDestinationModalOpen, setIsDestinationModalOpen] = useState(false);
  const [targetDestination, setTargetDestination] = useState<string | null>(null);
  const [navigationUrl, setNavigationUrl] = useState<string | null>(null);
  const [currentCity, setCurrentCity] = useState<string | null>(null);
  const [isFetchingCity, setIsFetchingCity] = useState(false);
  const [isFindingParking, setIsFindingParking] = useState(false);
  const [isFetchingNewLocation, setIsFetchingNewLocation] = useState(false);
  const [showTerritoryUploadModal, setShowTerritoryUploadModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [destinationCities, setDestinationCities] = useState<string[]>([]);
  const [isExtractingCities, setIsExtractingCities] = useState(false);
  const [isFindCompanyModalOpen, setIsFindCompanyModalOpen] = useState(false);
  const [managedFiles, setManagedFiles] = useState<ManagedFile[]>([]);
  const [isManageFilesModalOpen, setIsManageFilesModalOpen] = useState(false);


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
          console.warn("The AI could not find any cities in the provided document. Falling back to the default list from your profile.");
          cities = activeSalesperson.territory.flatMap(t => t.cities || []);
        }
      } catch (e: any) {
        console.error(`Could not read cities from PDF: ${e.message}. Using default list.`);
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
      console.warn(`Welcome, ${salesperson.name}! You have no territories assigned. Please contact your manager to have them set up.`);
    } else {
       console.log(`Welcome, ${salesperson.name}! Your territory for today: ${salesperson.territory.map(t => t.name).join(', ')}`);
    }
  };

  const updateColdCallCount = async (newCount: number) => {
    if (!db) return;
    setColdCallCount(newCount);
    const statsDocRef = doc(db, 'app-state', 'daily-stats');
    try {
      await setDoc(statsDocRef, { coldCallCount: newCount }, { merge: true });
    } catch (error) {
      console.error("Error updating cold call count:", error);
    }
  };


  useEffect(() => {
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
              console.error("Location Lookup Failed", result.error);
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
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            errorMessage = "Location information is unavailable.";
          } else if (error.code === error.TIMEOUT) {
            errorMessage = "Location request timed out.";
          }
          console.error("Location Error", errorMessage);
          setCurrentCity("Location access denied.");
        }
      );
    } else {
      console.warn("Geolocation Not Supported: Your browser does not support geolocation.");
      setCurrentCity("Geolocation not supported.");
    }
    
    try {
        const storedFiles = localStorage.getItem('managedFiles');
        if (storedFiles) {
            setManagedFiles(JSON.parse(storedFiles));
        }
    } catch (e) {
        console.error("Failed to parse managed files from localStorage", e);
        localStorage.removeItem('managedFiles');
    }

    if (!firebaseConfigured || !db) return;

    // Firestore listener for visits
    const visitsQuery = query(collection(db, 'visits'), orderBy('timestamp', 'desc'));
    const unsubscribeVisits = onSnapshot(visitsQuery, (querySnapshot) => {
      const visitsData = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          timestamp: data.timestamp.toDate(),
          futureMeetingDateTime: data.futureMeetingDateTime?.toDate(),
        } as Visit;
      });
      setVisits(visitsData);
    }, (error) => {
      console.error("Error fetching visits:", error);
    });
    
    const suggestionsQuery = query(collection(db, 'suggestions'), orderBy('timestamp', 'desc'));
    const unsubscribeSuggestions = onSnapshot(suggestionsQuery, (snapshot) => {
      const suggestionsData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          text: data.text,
          timestamp: data.timestamp.toDate()
        } as SubmittedSuggestion;
      });
      setSubmittedSuggestions(suggestionsData);
    }, (error) => {
      console.error("Error fetching suggestions:", error);
    });

    const statsDocRef = doc(db, 'app-state', 'daily-stats');
    const unsubscribeStats = onSnapshot(statsDocRef, (docSnap) => {
        if (docSnap.exists()) {
            setColdCallCount(docSnap.data().coldCallCount || 0);
        } else {
            setDoc(statsDocRef, { coldCallCount: 0, milestoneAchievedDate: null });
        }
    }, (error) => {
        console.error("Error fetching daily stats:", error);
    });


    return () => {
      unsubscribeVisits && unsubscribeVisits();
      unsubscribeSuggestions && unsubscribeSuggestions();
      unsubscribeStats && unsubscribeStats();
    };

  }, []);

  useEffect(() => {
    // Check if this is the first time the user is using the app
    // and prompt them to upload their territory file for the AI.
    if (selectedSalesperson) { // Only run after a salesperson is selected
        const hasUploaded = localStorage.getItem('territoryPdfUploaded');
        if (!hasUploaded) {
            setShowTerritoryUploadModal(true);
        }
    }
  }, [selectedSalesperson]);

  useEffect(() => {
    if (coldCallCount >= 30) {
      const today = new Date().toISOString().split('T')[0];
      
      const checkAndSetMilestone = async () => {
        if (!db) return;
        const statsDocRef = doc(db, 'app-state', 'daily-stats');
        try {
            const docSnap = await getDoc(statsDocRef);
    
            if (docSnap.exists() && docSnap.data().milestoneAchievedDate === today) {
              // already achieved today, do nothing
            } else {
              // not achieved today, show toast and update doc
              console.log("Milestone Achieved! Congratulations! You've hit 30 doors today!");
              await updateDoc(statsDocRef, { milestoneAchievedDate: today });
            }
        } catch (error) {
            console.error("Error checking milestone:", error);
        }
      }
      checkAndSetMilestone();
    }
  }, [coldCallCount]);

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
        // Secondary sort by confidence descending
        return confidenceB - confidenceA;
      } else if (sortCriteria === 'partnershipConfidence') {
        comparison = sortOrder === 'desc' ? confidenceB - confidenceA : confidenceA - confidenceB;
        if (comparison !== 0) return comparison;
        return timeB - timeA; // Secondary sort by time descending
      } else { // sortCriteria === 'timestamp'
        comparison = sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
        if (comparison !== 0) return comparison;
        return confidenceB - confidenceA; // Secondary sort by confidence descending
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
    if (sortedVisitsForCallDay.length === 0 || typeof window === 'undefined' || !window.IntersectionObserver) {
      return;
    }
  
    const observerOptions = {
      root: null, 
      rootMargin: '0px',
      threshold: 0.1, 
    };
  
    const observerCallback: IntersectionObserverCallback = (entries) => {
      if (isAutoScrollingRef.current) return;
  
      entries.forEach((entry) => {
        const targetElement = entry.target as HTMLDivElement;
        const cardIndex = parseInt(targetElement.dataset.cardIndex || '-1', 10);
  
        if (cardIndex === -1 || cardIndex >= sortedVisitsForCallDay.length - 1) {
          return; 
        }
  
        if (!entry.isIntersecting && entry.boundingClientRect.y < 0) {
          const nextCardRef = callDayCardRefs.current[cardIndex + 1];
          if (nextCardRef) {
            const nextCardRect = nextCardRef.getBoundingClientRect();
            if (nextCardRect.top > window.innerHeight * 0.2 && nextCardRect.top > entry.boundingClientRect.bottom) {
              isAutoScrollingRef.current = true;
              nextCardRef.scrollIntoView({ behavior: 'smooth', block: 'start' });
              setTimeout(() => {
                isAutoScrollingRef.current = false;
              }, 700); 
            }
          }
        }
      });
    };
  
    const observer = new IntersectionObserver(observerCallback, observerOptions);
  
    const currentRefs = callDayCardRefs.current;
    currentRefs.forEach((cardEl) => {
      if (cardEl) {
        observer.observe(cardEl);
      }
    });
  
    return () => {
      currentRefs.forEach((cardEl) => {
        if (cardEl) {
          observer.unobserve(cardEl);
        }
      });
      observer.disconnect();
    };
  }, [sortedVisitsForCallDay]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // Only show the confirmation dialog if the visit form is open,
      // as that's when unsaved data is most likely to exist.
      if (isVisitFormOpen) {
        event.preventDefault();
        // Standard requires setting returnValue to an empty string.
        // Some older browsers might display the string assigned here, but modern ones won't.
        event.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isVisitFormOpen]);

  useEffect(() => {
    // This effect handles the mobile back button.
    const handlePopState = (event: PopStateEvent) => {
      // We always push a new state to cancel the browser's default back navigation.
      // We then handle the "back" action manually.
      window.history.pushState(null, '', window.location.href);

      // If the zoomed-in visit card dialog is open, the back button should close it.
      if (zoomedVisit) {
        setZoomedVisit(null);
      } else {
        // If no specific modal is open that we want to handle, prevent exiting the app.
        console.log("Back button action canceled to prevent accidental exit.");
      }
    };

    // When the component mounts, add the popstate listener.
    // A state is pushed into history when the component mounts to enable our custom back button handling.
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [zoomedVisit]); // Re-create the handler when zoomedVisit changes to have the latest state.

  const handleQuickLog = async () => {
    // This function will now prepare a new visit and open the form
    // instead of trying to save directly, to ensure stability.
    setIsFetchingNewLocation(true);

    const getFreshCoordinates = (): Promise<{ lat: number; lon: number }> => {
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("Geolocation is not supported by your browser."));
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (position) => resolve({ lat: position.coords.latitude, lon: position.coords.longitude }),
          (error) => {
            let message = "Could not retrieve location.";
            if (error.code === error.PERMISSION_DENIED) message = "Location access denied.";
            if (error.code === error.POSITION_UNAVAILABLE) message = "Location information is unavailable.";
            if (error.code === error.TIMEOUT) message = "Location request timed out.";
            reject(new Error(message));
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      });
    };

    try {
      const { lat, lon } = await getFreshCoordinates();
      
      // Create a template for the new visit, including a timestamp to calculate meeting duration
      const newVisitTemplate: Partial<Visit> = {
        latitude: lat,
        longitude: lon,
        timestamp: new Date(), // Set a start time for the visit
      };

      // Try to get company name but don't let it block the process
      try {
        const result = await getCompanyNameFromCoordsAction({ latitude: lat, longitude: lon });
        if (result && !result.error) {
            newVisitTemplate.companyName = result.suggestedCompanyName || '';
            newVisitTemplate.decisionMakerContact = result.phone || '';
            if (result.address) {
                newVisitTemplate.notes = `Suggested Address: ${result.address}`;
            }
        }
      } catch (e) {
        console.warn("Could not pre-fill company details, user can enter manually.", e);
      }

      // Open the form with the pre-filled data
      setCurrentEditingVisit(newVisitTemplate as Visit);
      setIsVisitFormOpen(true);

    } catch (error: any) {
      console.error("Could Not Get Location", error.message);
    } finally {
      setIsFetchingNewLocation(false);
    }
  };


  const handleEditVisit = (visit: Visit) => {
    setCurrentEditingVisit(visit);
    setIsVisitFormOpen(true);
  };

  const handleUpdateFromCard = async (updatedVisit: Visit) => {
    const payload: SaveVisitPayload = {
      id: updatedVisit.id,
      timestamp: updatedVisit.timestamp,
      companyName: updatedVisit.companyName,
      notes: updatedVisit.notes,
      latitude: updatedVisit.latitude,
      longitude: updatedVisit.longitude,
      partnershipConfidence: updatedVisit.partnershipConfidence,
      hasBusinessCard: updatedVisit.hasBusinessCard,
      businessCardImageUrl: updatedVisit.businessCardImageUrl,
      discussedCompetitors: updatedVisit.discussedCompetitors,
      competitorName: updatedVisit.competitorName,
      coolerType: updatedVisit.coolerType,
      decisionMakerName: updatedVisit.decisionMakerName,
      decisionMakerTitle: updatedVisit.decisionMakerTitle,
      decisionMakerContact: updatedVisit.decisionMakerContact,
      visitNumber: updatedVisit.visitNumber,
      interestedUnit: updatedVisit.interestedUnit,
      hasTDSReading: updatedVisit.hasTDSReading,
      tdsValue: updatedVisit.tdsValue,
      futureMeetingSet: updatedVisit.futureMeetingSet,
      futureMeetingDateTime: updatedVisit.futureMeetingDateTime,
      freeTrial: updatedVisit.freeTrial,
      dealClosed: updatedVisit.dealClosed,
      originalCompanyName: updatedVisit.companyName,
      originalNotes: updatedVisit.notes,
      existingContactInfo: updatedVisit.contactInfo,
      existingNotesSummary: updatedVisit.notesSummary,
      originalBusinessCardImageUrl: updatedVisit.businessCardImageUrl,
    };
    const result = await saveVisitAction(payload);
    if (result.error) {
        console.error("Failed to update visit from card", result.error);
    } else {
        console.log("Visit updated successfully from card.");
    }
  };

  const handleLogFollowUp = (existingVisit: Visit) => {
    console.log(`Logging Follow-up for ${existingVisit.companyName}.`);
  
    const newVisitTemplate: Partial<Visit> = {
      // No id, so it's a new visit
      companyName: existingVisit.companyName,
      latitude: existingVisit.latitude,
      longitude: existingVisit.longitude,
      // Pass existing info to avoid re-scraping
      contactInfo: existingVisit.contactInfo, 
      notes: `Follow-up to visit on ${formatInTimeZone(new Date(existingVisit.timestamp), 'America/New_York', 'PP')}.`,
      notesSummary: undefined,
      partnershipConfidence: undefined,
      hasBusinessCard: false,
      businessCardImageUrl: undefined,
      discussedCompetitors: false,
      competitorName: undefined,
      coolerType: undefined,
      decisionMakerName: existingVisit.decisionMakerName,
      decisionMakerTitle: existingVisit.decisionMakerTitle,
      decisionMakerContact: existingVisit.decisionMakerContact,
      interestedUnit: undefined,
      hasTDSReading: false,
      tdsValue: undefined,
      futureMeetingSet: false,
      futureMeetingDateTime: undefined,
      freeTrial: false,
      dealClosed: false,
    };
    
    setCurrentEditingVisit(newVisitTemplate as Visit);
    setIsVisitFormOpen(true);
  };

  const handleSaveFromForm = async (payload: SaveVisitPayload) => {
    const isNew = !payload.id;
    
    // The client is responsible for calculating the new visit number
    if (isNew) {
      payload.visitNumber = coldCallCount + 1;
    }

    const result = await saveVisitAction(payload);

    if (result.error) {
      console.error('Error saving visit', result.error);
    } else if (result.visit) {
      console.log('Potential Partner Logged', `${result.visit.companyName} details saved successfully.`);
      if (result.isNewVisit) {
        await updateColdCallCount(coldCallCount + 1);
      }
    }
  };


  const handleDeleteVisit = async (visitId: string) => {
    if (!db) return;
    try {
        await deleteDoc(doc(db, "visits", visitId));
        console.log('Visit Deleted', 'The visit log has been removed.');
    } catch (error) {
        console.error("Error deleting visit:", error);
    }
  };

  const confirmEndDay = async () => {
    const numberOfVisits = visits.length;
    await updateColdCallCount(0);
    
    if (db) {
        try {
            const statsDocRef = doc(db, 'app-state', 'daily-stats');
            await updateDoc(statsDocRef, { milestoneAchievedDate: null });
        } catch (e) {
            console.warn("Could not reset milestone date", e);
        }
    }

    console.log("Field Day Ended", `Great work! You have completed ${numberOfVisits} visit${numberOfVisits === 1 ? '' : 's'} today. Your session has been reset.`);
    setIsEndDayConfirmOpen(false);
  };

  const handleSubmitSuggestion = async () => {
    if (suggestionText.trim() === '' || !db) {
      console.warn('Empty Suggestion', 'Please type your suggestion before submitting.');
      return;
    }

    const newSuggestionObject: SubmittedSuggestion = {
      text: suggestionText.trim(),
      timestamp: new Date(),
    };
    
    try {
        await addDoc(collection(db, "suggestions"), newSuggestionObject);
        console.log('Suggestion Submitted!', 'Thank you for your feedback.');
        setSuggestionText('');
    } catch (error) {
        console.error("Error submitting suggestion:", error);
    }
  };

  const handleEmailSuggestions = () => {
    if (submittedSuggestions.length === 0) {
      console.log('No Suggestions to Email', 'There are no submitted suggestions to send.');
      return;
    }

    const subject = `App Improvement Suggestion`;
    let body = `Suggestions for the Optimum Trailblazer App:\n\n`;
    submittedSuggestions.forEach((suggestion, index) => {
      body += `${index + 1}. Suggestion: ${suggestion.text}\n`;
      body += `   Date: ${format(suggestion.timestamp, 'MMM d, yyyy, h:mm a')}\n\n`;
    });

    body += `\n\n---\nEmail generated by Optimum Trailblazer App`;

    const params = new URLSearchParams();
    params.append('subject', subject);
    params.append('body', body);
    const mailtoLink = `mailto:paull@drinkoptimum.com?${params.toString()}`;
    
    if (typeof window !== 'undefined') {
        window.location.href = mailtoLink;
    }
    console.log("Opening email client...", "Please send the composed email with your suggestions.");
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
        if (visit.notesSummary) {
          body += `\n   Summary: ${visit.notesSummary}`;
        }
        if (visit.contactInfo?.info && visit.contactInfo.info !== "No contact info found on web!") {
          body += `\n   Contact: ${visit.contactInfo.info}`;
        }
        if (visit.partnershipConfidence) {
          body += `\n   Confidence: ${visit.partnershipConfidence}/5`;
        }
        body += `\n   Visited: ${format(new Date(visit.timestamp), 'MMM d, h:mm a')}`;
        body += "\n";
      });
    } else {
      body += "No visits were logged today.\n";
    }
    
    body += `\n\nBest regards,\nOptimum Trailblazer App`;

    const params = new URLSearchParams();
    params.append('to', chrisEmail);
    params.append('su', subject);
    params.append('body', body);
    
    const gmailLink = `https://mail.google.com/mail/?view=cm&fs=1&${params.toString()}`;
    
    if (typeof window !== 'undefined') {
        window.open(gmailLink, '_blank');
    }

    console.log("Opening Gmail...", "Please manually attach the exported PDF to the email before sending.");
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const allowedTypes = ["application/pdf", "text/csv"];
      if (!allowedTypes.includes(file.type)) {
        console.error("Invalid File Type", "Please select a PDF or CSV file.");
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        console.error("File Too Large", "Please select a file smaller than 5MB.");
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
        console.log('File Attached', `${selectedFile.name} attached and will be sent to AI.`);
        messageText += ` (Attached File: ${selectedFile.name})`;
      } catch (processingError: any) {
        console.error('File Processing Failed', processingError.message);
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
            notesSummary: v.notesSummary,
            partnershipConfidence: v.partnershipConfidence
        })),
        pdfUrl: pdfUrlForAi,
        csvData: csvDataForAi,
        territoryPdfUrl: territoryPdfUrl,
        managedFiles: managedFiles,
      });

      if (result.error) {
        console.error("AI Chat Error", `Error: ${result.error}`);
        const aiErrorResponse: ChatMessage = {
          id: crypto.randomUUID(),
          sender: 'ai',
          text: `Sorry, I encountered an error: ${result.error}`,
          timestamp: new Date(),
        };
        setChatMessages(prev => [...prev, aiErrorResponse]);
      } else if (result.aiResponse) {
        const aiResponse: ChatMessage = {
          id: crypto.randomUUID(),
          sender: 'ai',
          text: result.aiResponse,
          timestamp: new Date(),
        };
        setChatMessages(prev => [...prev, aiResponse]);
      }
    } catch (e: any) {
      console.error("AI Chat Failed", "Could not get response from AI.");
       const aiFailureResponse: ChatMessage = {
          id: crypto.randomUUID(),
          sender: 'ai',
          text: "I'm having trouble connecting right now. Please try again later.",
          timestamp: new Date(),
        };
        setChatMessages(prev => [...prev, aiFailureResponse]);
    } finally {
      setIsAiResponding(false);
    }
  };

  const handleAddFoundCompanyAsVisit = (visitData: Partial<Visit>) => {
    const newVisit: Visit = {
        id: '',
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


  if (!firebaseConfigured) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center p-4 bg-background">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-bold text-destructive">Firebase Configuration Error</h1>
        <p className="mt-2 text-muted-foreground max-w-md">
          Your application is missing valid Firebase credentials. Please add your Firebase project configuration to your <strong>.env</strong> file.
        </p>
        <p className="mt-4 text-sm text-muted-foreground">The app will not function correctly until this is resolved.</p>
        <div className="mt-4 p-4 bg-muted rounded-md text-left text-xs text-muted-foreground w-full max-w-lg">
          <p>You need to set the following variables in your `.env` file:</p>
          <pre className="mt-2 whitespace-pre-wrap">
            {`NEXT_PUBLIC_FIREBASE_API_KEY="YOUR_KEY_HERE"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="YOUR_DOMAIN_HERE"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="YOUR_PROJECT_ID_HERE"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="YOUR_BUCKET_HERE"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="YOUR_SENDER_ID_HERE"
NEXT_PUBLIC_FIREBASE_APP_ID="YOUR_APP_ID_HERE"`}
          </pre>
        </div>
      </div>
    );
  }

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
            <div className="flex flex-col justify-center items-center gap-2 p-3 bg-primary/10 backdrop-blur-sm rounded-lg border border-primary/20 mt-6">
                <div 
                  className="flex items-center gap-2 cursor-pointer group"
                  onClick={() => handleChangeDestination()}
                >
                    <User className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-headline font-semibold text-foreground text-center transition-colors group-hover:text-primary">
                      {selectedSalesperson.name} | {targetDestination ? `Destination: ${targetDestination}` : `Today's Territory: ${selectedSalesperson.territory.map(t => t.name).join(', ')}`}
                    </h2>
                </div>
                {navigationUrl && (
                  <Button
                    onClick={() => window.open(navigationUrl, '_blank', 'noopener,noreferrer')}
                    className="mt-2"
                    variant="default"
                    size="sm"
                  >
                    <Map className="mr-2 h-4 w-4" />
                    Navigate to Destination
                  </Button>
                )}
                {isFetchingCity && (
                    <div className="flex items-center text-sm text-muted-foreground mt-2">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Determining current city...
                    </div>
                )}
                {currentCity && !isFetchingCity && (
                    <div className="flex items-center text-md font-medium text-foreground mt-2">
                        <MapPin className="mr-2 h-4 w-4 text-primary" />
                        <span>Current City: {currentCity}</span>
                    </div>
                )}
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row justify-center items-center gap-2 p-3 bg-primary/10 backdrop-blur-sm rounded-lg border border-primary/20 mt-6">
              <h2 className="text-lg font-headline font-semibold italic text-foreground text-center">
                Good Luck Today!
              </h2>
            </div>
          )}
        </header>
        
        <Tabs defaultValue="field-day" className="w-full">
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
                  console.log('No visits to show at the moment!');
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

          <TabsContent value="field-day">
            <div className="space-y-6">
                <div className="flex justify-center items-center gap-4 w-full">
                    <Button onClick={handleQuickLog} variant="default" size="sm" className="flex-1" disabled={isFetchingNewLocation}>
                        {isFetchingNewLocation ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <PlusCircle className="mr-2 h-5 w-5" />}
                        {isFetchingNewLocation ? 'Getting Location...' : 'Log Visit at Location'}
                    </Button>
                    <AlertDialog open={isEndDayConfirmOpen} onOpenChange={setIsEndDayConfirmOpen}>
                      <AlertDialogTrigger asChild>
                        <Button variant="default" size="sm" className="flex-1">
                          <Sunset className="mr-2 h-5 w-5" /> End Day!
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>End Your Field Day?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you are done for the day?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={confirmEndDay}>End Day</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                </div>

                {visits.length === 0 && coldCallCount === 0 ? (
                    <div className="text-center py-10 bg-card/60 backdrop-blur-sm border border-primary/20 rounded-lg shadow-lg px-4">
                      <p className="text-xl text-muted-foreground mb-4">No visits logged yet for field day.</p>
                      <p className="text-muted-foreground mb-4">
                          When you click <span className="inline-block bg-primary text-primary-foreground px-2 py-1 rounded-md text-xs font-semibold">Log Visit at Location</span> this app will help streamline your efforts
                      </p>
                    </div>
                ) : (
                    <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                      {visits.map(visit => (
                          <VisitCard
                          key={visit.id}
                          visit={visit}
                          onEdit={handleEditVisit}
                          onDelete={handleDeleteVisit}
                          onUpdateVisit={handleUpdateFromCard}
                          onZoom={setZoomedVisit}
                          onLogFollowUp={handleLogFollowUp}
                          />
                      ))}
                    </div>
                )}
            </div>
          </TabsContent>

          <TabsContent value="call-day">
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-center items-center gap-2 mb-4 p-4 bg-card/60 backdrop-blur-sm border border-primary/20 rounded-lg shadow-lg">
                <h2 className="text-2xl font-semibold text-foreground text-center">
                  Call Day Priority List
                </h2>
              </div>

              <div className="p-4 bg-card/60 backdrop-blur-sm border border-primary/20 rounded-lg shadow-lg mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <ListFilter className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-medium text-foreground">Filter & Sort Options</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  <div className="flex flex-col items-center">
                    <Label className="text-sm mb-2 block w-full text-left">Filter by Date</Label>
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
                      <Label htmlFor="sort-criteria" className="text-sm">Sort By</Label>
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
                          {sortCriteria === 'partnershipConfidence' ? (
                            <>
                              <SelectItem value="desc">High to Low</SelectItem>
                              <SelectItem value="asc">Low to High</SelectItem>
                            </>
                          ) : sortCriteria === 'timestamp' ? (
                            <>
                              <SelectItem value="desc">Newest to Oldest</SelectItem>
                              <SelectItem value="asc">Oldest to Newest</SelectItem>
                            </>
                          ) : sortCriteria === 'dealClosed' ? (
                            <>
                              <SelectItem value="desc">Closed Deals First</SelectItem>
                              <SelectItem value="asc">Open Deals First</SelectItem>
                            </>
                          ) : (
                             <>
                              <SelectItem value="desc">Descending</SelectItem>
                              <SelectItem value="asc">Ascending</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t">
                  <Button onClick={() => setIsFindCompanyModalOpen(true)} className="w-full">
                      <Search className="mr-2 h-4 w-4" /> Find Company by Name
                  </Button>
                </div>
              </div>


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
                      ref={(el) => {
                        if (index < callDayCardRefs.current.length) {
                           callDayCardRefs.current[index] = el;
                        }
                      }}
                      data-card-index={index.toString()}
                    >
                      <VisitCard
                        visit={visit}
                        onEdit={handleEditVisit}
                        onDelete={handleDeleteVisit}
                        onUpdateVisit={handleUpdateFromCard}
                        onZoom={setZoomedVisit}
                        onLogFollowUp={handleLogFollowUp}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="visits">
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
              />
            </section>
          </TabsContent>

          <TabsContent value="ai-chat">
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
                        {AVAILABLE_AI_MODELS.map(model => (
                          <SelectItem key={model.id} value={model.id} className="text-xs">
                            {model.name}
                          </SelectItem>
                        ))}
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
                          <p className="text-xs mt-1.5 opacity-80 text-right">
                            {format(message.timestamp, 'p')}
                          </p>
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
                  <Button 
                      variant="outline" 
                      size="icon" 
                      onClick={() => setIsManageFilesModalOpen(true)}
                      disabled={isAiResponding}
                      aria-label="Manage long-term files for AI"
                      title="Manage long-term files for AI"
                  >
                      <FolderKanban className="h-4 w-4" />
                  </Button>
                  <Input
                    id="file-upload-input"
                    type="file"
                    accept="application/pdf,text/csv"
                    onChange={handleFileSelect}
                    className="hidden"
                    ref={fileInputRef}
                    disabled={isAiResponding}
                  />
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isAiResponding}
                    aria-label="Attach a file for this message"
                    title="Attach a file for this message"
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Input
                    type="text"
                    placeholder="Type your message..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) => { if (e.key === 'Enter' && !isAiResponding) handleSendChatMessage(); }}
                    className="flex-1"
                    disabled={isAiResponding}
                  />
                  <Button onClick={handleSendChatMessage} disabled={!chatInput.trim() || isAiResponding}>
                    {isAiResponding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    <span className="sr-only">Send</span>
                  </Button>
                </div>
              </UiCardFooter>
            </UiCard>
            )}
          </TabsContent>

          <TabsContent value="about">
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
                                When you click the <span className="inline-block bg-primary text-primary-foreground px-2 py-1 rounded-md text-xs font-semibold">Log Visit at Location</span> button, the app uses your current location to find company information and pre-fills the visit form for you.
                            </li>
                            <li>
                                As you interact with the potential partner, use the form to <span className="inline-block bg-primary text-primary-foreground px-2 py-1 rounded-md text-xs font-semibold">Log the meeting!</span>. Capturing details like business cards, competitor info, and visit notes makes the app—and our AI assistant, Debbie—more powerful.
                            </li>
                            <li>
                                Once you're done for the day, click the <span className="inline-block bg-primary text-primary-foreground px-2 py-1 rounded-md text-xs font-semibold">End Day!</span> button. This resets your session and summarizes your daily accomplishments.
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
                                <Textarea
                                id="appSuggestion"
                                placeholder="Type your feedback or feature request here..."
                                value={suggestionText}
                                onChange={(e) => setSuggestionText(e.target.value)}
                                className="min-h-[100px]"
                                />
                                <Button onClick={handleSubmitSuggestion} disabled={!suggestionText.trim()}>
                                <Send className="mr-2 h-4 w-4" /> Add Suggestion
                                </Button>
                            </div>
                        </div>

                        {submittedSuggestions.length > 0 && (
                            <div className="w-full pt-4 mt-6 border-t">
                                <h3 className="text-2xl font-headline font-semibold text-primary mb-3">
                                List of Possible Improvements
                                </h3>
                                <div className="p-4 bg-secondary/30 rounded-lg border border-border max-h-60 overflow-y-auto">
                                <ol className="list-decimal list-inside space-y-2 text-foreground/90">
                                    {submittedSuggestions.map((suggestion, index) => (
                                    <li key={`${suggestion.timestamp}-${index}`} className="text-sm leading-relaxed">
                                        {suggestion.text}
                                        <span className="block text-xs text-muted-foreground mt-0.5">
                                        &mdash; on {format(suggestion.timestamp, 'MMM d, yyyy, h:mm a')}
                                        </span>
                                    </li>
                                    ))}
                                </ol>
                                </div>
                                <Button onClick={handleEmailSuggestions} variant="default" className="mt-4">
                                <Mail className="mr-2 h-4 w-4" /> Email Suggestions to Designer
                                </Button>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </div>
          </TabsContent>
        </Tabs>
        
        <Dialog open={!!zoomedVisit} onOpenChange={(isOpen) => { if (!isOpen) setZoomedVisit(null); }}>
          <DialogContent className="max-w-2xl p-0 bg-transparent border-0 shadow-none">
            {zoomedVisit && (
              <>
                <DialogTitle className="sr-only">Visit Details: {zoomedVisit.companyName}</DialogTitle>
                <DialogDescription className="sr-only">
                  Detailed view of the visit to {zoomedVisit.companyName}. You can see all recorded information, edit, or delete the visit from this view.
                </DialogDescription>
                <VisitCard
                  visit={zoomedVisit}
                  onEdit={(v) => {
                    setZoomedVisit(null);
                    handleEditVisit(v);
                  }}
                  onDelete={(id) => {
                    setZoomedVisit(null);
                    handleDeleteVisit(id);
                  }}
                  onUpdateVisit={(updated) => {
                    handleUpdateFromCard(updated);
                    setZoomedVisit(updated);
                  }}
                  isZoomedView={true}
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
                        {isExtractingCities
                            ? "Debbie is reading your territory file to find cities..."
                            : "Select a city to get an AI-optimized parking location for your day."
                        }
                    </DialogDescription>
                </DialogHeader>
                <div className="max-h-[400px] overflow-y-auto pr-2">
                    {isExtractingCities ? (
                        <div className="flex justify-center items-center h-32">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : destinationCities.length > 0 ? (
                        <div className="flex flex-col space-y-2">
                            {destinationCities.map(city => (
                                <Button
                                    key={city}
                                    variant="ghost"
                                    className="justify-start"
                                    disabled={isFindingParking}
                                    onClick={async () => {
                                        const destinationCity = city;
                                        setTargetDestination(destinationCity);
                                        setIsDestinationModalOpen(false);
                                        setIsFindingParking(true);
                                        
                                        try {
                                            const result = await findOptimalParkingAction({ city: destinationCity });

                                            if (result.error) {
                                                throw new Error(result.error);
                                            }

                                            if (result.latitude && result.longitude) {
                                                const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${result.latitude},${result.longitude}`;
                                                setNavigationUrl(googleMapsUrl);
                                            } else {
                                                throw new Error('AI did not return a valid location.');
                                            }
                                        } catch (e: any) {
                                            console.error('Could Not Find Location', e.message || 'An unexpected error occurred.');
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
                         <p className="text-muted-foreground text-center py-4">
                            No destination cities found. You can upload a territory PDF on the "About" tab or ensure your profile has default cities assigned.
                        </p>
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
          destinationCities={destinationCities}
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
          }}
          onSave={handleSaveFromForm}
          initialData={currentEditingVisit}
          salesperson={selectedSalesperson}
        />
      </div>
      <footer className="text-center py-8 text-muted-foreground text-sm border-t mt-12">
        <p>&copy; {new Date().getFullYear()} Optimum Trailblazer. Your personal sales companion.</p>
      </footer>
    </div>
  );
}
