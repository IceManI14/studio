
'use client';

import { useState, useEffect, useRef } from 'react';
import type { Visit, Salesperson, ChatMessage } from '@/lib/types';
import { Button } from '@/components/ui/button';
import VisitForm from '@/components/visit-form';
import VisitCard from '@/components/visit-card';
import ExportButton from '@/components/export-button';
import ExportPdfButton from '@/components/export-pdf-button';
import GoogleMapComponent from '@/components/google-map';
import { PlusCircle, ListChecks, User, InfoIcon, Sunset, Send, PartyPopper, MessagesSquare, Hash, Mail, ListFilter, Bot, MapPin, Brain, Loader2, Paperclip, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
import { format, subDays } from 'date-fns';
import SalespersonSelectorModal from '@/components/salesperson-selector-modal';
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import Image from 'next/image';
import { Card as UiCard, CardContent as UiCardContent, CardHeader as UiCardHeader, CardFooter as UiCardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getAiChatResponseAction } from '@/app/actions';

interface SubmittedSuggestion {
  text: string;
  salespersonName: string;
  timestamp: string;
}

const AVAILABLE_AI_MODELS = [
  { id: 'googleai/gemini-1.5-flash-latest', name: 'Gemini 1.5 Flash' },
  { id: 'googleai/gemini-1.0-pro', name: 'Gemini 1.0 Pro' },
];

const SALESPEOPLE: Salesperson[] = [
  { id: 'sales_1', name: 'Jim Karat' },
  { id: 'sales_2', name: 'Chris Canestrari' },
  { 
    id: 'sales_3', 
    name: 'Paul W. Lyman',
    territory: [
      "Auburn", "Chester", "Kingston", "Seabrook", "Exeter", "Stratham", 
      "Newmarket", "Durham", "Portsmouth", "Deerfield", "Nottingham", 
      "Hampton", "Rye", "Sandown", "Raymond", "Hampstead", "Dover", 
      "Tilton", "Belmont", "Franklin", "Laconia", "New Hampton", 
      "Meredith", "Gilford", "Kittery", "York", "Ogunquit", "Wells", "Kennebunk"
    ]
  },
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
  const [coldCallCount, setColdCallCount] = useState<number>(0);
  const [selectedSalesperson, setSelectedSalesperson] = useState<Salesperson | null>(null);
  const [userCurrentLatitude, setUserCurrentLatitude] = useState<number | undefined>();
  const [userCurrentLongitude, setUserCurrentLongitude] = useState<number | undefined>();
  const { toast } = useToast();
  const [sortedVisitsForCallDay, setSortedVisitsForCallDay] = useState<Visit[]>([]);
  const [isEndDayConfirmOpen, setIsEndDayConfirmOpen] = useState(false);
  const [suggestionText, setSuggestionText] = useState('');
  const [submittedSuggestions, setSubmittedSuggestions] = useState<SubmittedSuggestion[]>([]);
  const [sortCriteria, setSortCriteria] = useState<'partnershipConfidence' | 'timestamp'>('partnershipConfidence');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
     { id: 'ai_welcome', sender: 'ai', text: 'Hello! I am your Optimum Trailblazer AI Assistant. How can I help you plan your day or analyze visit data?', timestamp: new Date() }
  ]);
  const [chatInput, setChatInput] = useState('');
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const [isAiResponding, setIsAiResponding] = useState(false);
  const [selectedAiModel, setSelectedAiModel] = useState<string>(AVAILABLE_AI_MODELS[0].id);
  const [selectedPdf, setSelectedPdf] = useState<File | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);

  const callDayCardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const isAutoScrollingRef = useRef(false);


  const getVisitsStorageKey = (): string | null => {
    if (!selectedSalesperson) return null;
    return `trailblazerVisits_${selectedSalesperson.id}`;
  };

  const getSuggestionsStorageKey = (): string | null => {
    if (!selectedSalesperson) return null;
    return `trailblazerSuggestions_${selectedSalesperson.id}`;
  };

  const getColdCallCountStorageKey = (): string | null => {
    if (!selectedSalesperson) return null;
    return `trailblazerColdCallCount_${selectedSalesperson.id}`;
  };

  useEffect(() => {
    const storedSalespersonId = localStorage.getItem(SELECTED_SALESPERSON_ID_KEY);
    if (storedSalespersonId) {
      const foundSalesperson = SALESPEOPLE.find(s => s.id === storedSalespersonId);
      if (foundSalesperson) {
        setSelectedSalesperson(foundSalesperson);
      } else {
        localStorage.removeItem(SELECTED_SALESPERSON_ID_KEY); 
      }
    }
  }, []);

  useEffect(() => {
    if (!selectedSalesperson) {
      setVisits([]); 
      setSubmittedSuggestions([]); 
      setColdCallCount(0);
      setUserCurrentLatitude(undefined);
      setUserCurrentLongitude(undefined);
      return;
    }
    const visitsStorageKey = getVisitsStorageKey();
    const suggestionsStorageKey = getSuggestionsStorageKey();
    const coldCallCountStorageKey = getColdCallCountStorageKey();

    if (visitsStorageKey) {
      const storedVisits = localStorage.getItem(visitsStorageKey);
      if (storedVisits) {
        try {
          const parsedVisits = JSON.parse(storedVisits).map((visit: any) => ({
            ...visit,
            timestamp: new Date(visit.timestamp),
            visitNumber: visit.visitNumber,
          }));
          setVisits(parsedVisits);
        } catch (error) {
          console.error("Failed to parse visits from localStorage", error);
          localStorage.removeItem(visitsStorageKey);
          setVisits([]);
        }
      } else {
        setVisits([]);
      }
    }

    if (suggestionsStorageKey) {
      const storedSuggestionsRaw = localStorage.getItem(suggestionsStorageKey);
      if (storedSuggestionsRaw) {
        try {
          const parsedSuggestions = JSON.parse(storedSuggestionsRaw);
          const transformedSuggestions = parsedSuggestions.map((item: any) => {
            if (typeof item === 'string') {
              return {
                text: item,
                salespersonName: selectedSalesperson.name,
                timestamp: new Date(0).toISOString(), 
              };
            }
            return item;
          });
          setSubmittedSuggestions(transformedSuggestions);
        } catch (error) {
          console.error("Failed to parse suggestions from localStorage", error);
          localStorage.removeItem(suggestionsStorageKey);
          setSubmittedSuggestions([]);
        }
      } else {
        setSubmittedSuggestions([]);
      }
    }

    if (coldCallCountStorageKey) {
      const storedColdCallCount = localStorage.getItem(coldCallCountStorageKey);
      if (storedColdCallCount) {
        setColdCallCount(parseInt(storedColdCallCount, 10) || 0);
      } else {
        setColdCallCount(0);
      }
    } else {
      setColdCallCount(0);
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserCurrentLatitude(position.coords.latitude);
          setUserCurrentLongitude(position.coords.longitude);
          toast({
            title: "Current Location Acquired",
            description: `Lat: ${position.coords.latitude.toFixed(4)}, Lng: ${position.coords.longitude.toFixed(4)}`
          });
        },
        (error) => {
          setUserCurrentLatitude(undefined);
          setUserCurrentLongitude(undefined);
          let errorMessage = "Could not retrieve location.";
          if (error.code === error.PERMISSION_DENIED) {
            errorMessage = "Location access denied. Please enable it in your browser settings.";
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            errorMessage = "Location information is unavailable.";
          } else if (error.code === error.TIMEOUT) {
            errorMessage = "Location request timed out.";
          }
          toast({
            title: "Location Error",
            description: errorMessage,
            variant: "default" 
          });
        }
      );
    } else {
      toast({
        title: "Geolocation Not Supported",
        description: "Your browser does not support geolocation.",
        variant: "default"
      });
      setUserCurrentLatitude(undefined);
      setUserCurrentLongitude(undefined);
    }

  }, [selectedSalesperson, toast]);

  useEffect(() => {
    if (!selectedSalesperson) return;
    const visitsStorageKey = getVisitsStorageKey();
    if (!visitsStorageKey) return;

    if (visits.length > 0 || localStorage.getItem(visitsStorageKey)) {
        localStorage.setItem(visitsStorageKey, JSON.stringify(visits));
    }

    if (coldCallCount >= 30) {
      const today = new Date().toISOString().split('T')[0];
      const milestoneKey = `thirtyDoorsMilestoneAchieved_${selectedSalesperson.id}_${today}`;

      if (!localStorage.getItem(milestoneKey)) {
        toast({
          title: (
            <div className="flex items-center">
              <PartyPopper className="mr-2 h-5 w-5 text-accent" />
              Milestone Achieved!
            </div>
          ),
          description: "Congratulations! You've hit 30 doors today! Keep up the great work!",
          duration: 7000, 
        });
        localStorage.setItem(milestoneKey, 'true');
      }
    }
  }, [visits, coldCallCount, selectedSalesperson, toast]);

  useEffect(() => {
    if (!selectedSalesperson) return;
    const coldCallCountStorageKey = getColdCallCountStorageKey();
    if (!coldCallCountStorageKey) return;
    localStorage.setItem(coldCallCountStorageKey, coldCallCount.toString());
  }, [coldCallCount, selectedSalesperson]);

  useEffect(() => {
    if (visits.length > 0) {
      const sorted = [...visits].sort((a, b) => {
        const confidenceA = a.partnershipConfidence ?? 0;
        const confidenceB = b.partnershipConfidence ?? 0;
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();

        let comparison = 0;

        if (sortCriteria === 'partnershipConfidence') {
          comparison = sortOrder === 'desc' ? confidenceB - confidenceA : confidenceA - confidenceB;
          if (comparison !== 0) return comparison;
          return timeB - timeA; 
        } else { 
          comparison = sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
          if (comparison !== 0) return comparison;
          return confidenceB - confidenceA; 
        }
      });
      setSortedVisitsForCallDay(sorted);
    } else {
      setSortedVisitsForCallDay([]);
    }
  }, [visits, sortCriteria, sortOrder]);

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


  const handleSelectSalesperson = (salesperson: Salesperson) => {
    setSelectedSalesperson(salesperson);
    localStorage.setItem(SELECTED_SALESPERSON_ID_KEY, salesperson.id);
    setColdCallCount(0); 
    setIsVisitFormOpen(false);
    setCurrentEditingVisit(undefined);
    setChatMessages([ { id: 'ai_welcome_new_user', sender: 'ai', text: `Hello ${salesperson.name}! I am your Optimum Trailblazer AI Assistant. How can I help you?`, timestamp: new Date() }]);
    toast({ title: `Profile Switched: ${salesperson.name}`, description: "Your view has been updated." });
  };

  const handleOpenAddVisitForm = () => {
    const newVisitNumber = coldCallCount + 1;
    setColdCallCount(prevCount => prevCount + 1);

    const currentTime = new Date();

    setCurrentEditingVisit({
      id: '',
      timestamp: currentTime,
      companyName: '',
      notes: '',
      latitude: userCurrentLatitude, 
      longitude: userCurrentLongitude, 
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
      decisionMakerContact: '',
      visitNumber: newVisitNumber,
      interestedUnit: undefined,
      hasTDSReading: false,
      tdsValue: undefined,
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

  const confirmEndDay = () => {
    const numberOfVisits = visits.length;
    setColdCallCount(0);
    const coldCallCountStorageKey = getColdCallCountStorageKey();
    if (coldCallCountStorageKey) {
      localStorage.setItem(coldCallCountStorageKey, '0');
    }
    const today = new Date().toISOString().split('T')[0];
    const milestoneKey = `thirtyDoorsMilestoneAchieved_${selectedSalesperson?.id}_${today}`;
    localStorage.removeItem(milestoneKey);

    toast({
      title: "Field Day Ended",
      description: `Great work ${selectedSalesperson?.name}! You have completed ${numberOfVisits} visit${numberOfVisits === 1 ? '' : 's'} today. Your session has been reset. Tomorrow is a new day!`,
    });
    setIsEndDayConfirmOpen(false);
  };

  const handleSubmitSuggestion = () => {
    if (suggestionText.trim() === '' || !selectedSalesperson) {
      toast({
        title: 'Empty Suggestion',
        description: 'Please type your suggestion before submitting.',
        variant: 'default',
      });
      return;
    }

    const suggestionsStorageKey = getSuggestionsStorageKey();
    if (suggestionsStorageKey) {
      const newSuggestionObject: SubmittedSuggestion = {
        text: suggestionText.trim(),
        salespersonName: selectedSalesperson.name,
        timestamp: new Date().toISOString(),
      };
      const newSuggestionsArray = [...submittedSuggestions, newSuggestionObject];
      setSubmittedSuggestions(newSuggestionsArray);
      localStorage.setItem(suggestionsStorageKey, JSON.stringify(newSuggestionsArray));
    }

    console.log('App Suggestion:', {
      salesperson: selectedSalesperson.name,
      suggestion: suggestionText.trim(),
      timestamp: new Date().toISOString(),
    });
    toast({
      title: 'Suggestion Submitted!',
      description: 'Thank you for your feedback.',
    });
    setSuggestionText('');
  };

  const handleEmailSuggestions = () => {
    if (!selectedSalesperson || submittedSuggestions.length === 0) {
      toast({
        title: 'No Suggestions to Email',
        description: 'There are no submitted suggestions to send.',
        variant: 'default',
      });
      return;
    }

    const subject = `App Improvement Suggestion`;
    let body = `Suggestions for the Optimum Trailblazer App:\n\n`;
    submittedSuggestions.forEach((suggestion, index) => {
      body += `${index + 1}. Suggestion: ${suggestion.text}\n`;
      body += `   Submitted by: ${suggestion.salespersonName}\n`;
      body += `   Date: ${format(new Date(suggestion.timestamp), 'MMM d, yyyy, h:mm a')}\n\n`;
    });

    body += `\n\n---\nEmail generated by Optimum Trailblazer App`;

    const gmailBaseUrl = 'https://mail.google.com/mail/?view=cm&fs=1';
    const params = new URLSearchParams({
      to: 'paull@drinkoptimum.com',
      su: subject,
      body: body,
    });
    const gmailLink = `${gmailBaseUrl}&${params.toString()}`;
    
    window.open(gmailLink, '_blank');
  };

  const handleEmailChris = () => {
    if (!selectedSalesperson) {
        toast({ title: "No Salesperson Selected", description: "Please select a salesperson profile first.", variant: "default" });
        return;
    }

    const chrisEmail = "chrisc@drinkoptimum.com";
    const currentDate = format(new Date(), 'MMMM d, yyyy');
    const subject = `Visits for the day! - ${selectedSalesperson.name} - ${currentDate}`;
    
    let body = `Hello Chris,\n\nHere is the daily route information for ${selectedSalesperson.name} for ${currentDate}.\n\n`;
    body += `The detailed visit data can be found in the PDF report, which can be downloaded using the 'Export PDF' button and then manually attached to this email.\n\n`;
    body += `A summary is also included below:\n\n`;
    
    if (visits.length > 0) {
      body += `Summary of Visits (${visits.length} total):\n`;
      visits.forEach((visit, index) => {
        body += `\n${index + 1}. ${visit.companyName}`;
        if (visit.notesSummary) {
          body += `\n   Summary: ${visit.notesSummary}`;
        }
        if (visit.contactInfo?.info) {
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
    
    body += `\n\nBest regards,\n${selectedSalesperson.name || 'Optimum Trailblazer App'}`;

    const gmailBaseUrl = 'https://mail.google.com/mail/?view=cm&fs=1';
    const params = new URLSearchParams({
      to: chrisEmail,
      su: subject,
      body: body,
    });
    const gmailLink = `${gmailBaseUrl}&${params.toString()}`;
    
    window.open(gmailLink, '_blank');

    toast({
      title: "Opening Gmail...",
      description: "Please manually attach the exported PDF to the email before sending.",
    });
  };

  const handlePdfSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
        toast({ title: "Invalid File Type", description: "Please select a PDF file.", variant: "destructive" });
        setSelectedPdf(null);
        if (pdfInputRef.current) pdfInputRef.current.value = '';
        return;
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({ title: "File Too Large", description: "Please select a PDF file smaller than 5MB.", variant: "destructive" });
        setSelectedPdf(null);
        if (pdfInputRef.current) pdfInputRef.current.value = '';
        return;
      }
      setSelectedPdf(file);
    } else {
      setSelectedPdf(null);
    }
  };

  const handleClearPdf = () => {
    setSelectedPdf(null);
    if (pdfInputRef.current) {
      pdfInputRef.current.value = '';
    }
  };

  const handleSendChatMessage = async () => {
    if (chatInput.trim() === '' || !selectedSalesperson || isAiResponding || isUploadingPdf) return;

    let messageText = chatInput.trim();
    let pdfUrlForAi: string | undefined = undefined;
    
    setIsAiResponding(true); 

    if (selectedPdf) {
      setIsUploadingPdf(true);
      const formData = new FormData();
      formData.append('pdfFile', selectedPdf);
      try {
        const response = await fetch('/api/upload-pdf', {
          method: 'POST',
          body: formData,
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to upload PDF');
        }
        const uploadResult = await response.json();
        pdfUrlForAi = uploadResult.url;
        toast({ title: 'PDF Attached', description: `${selectedPdf.name} uploaded and sent to AI.`, duration: 3000});
        messageText += ` (Attached PDF: ${selectedPdf.name})`;
      } catch (uploadError: any) {
        toast({ title: 'PDF Upload Failed', description: uploadError.message, variant: 'destructive' });
        setIsUploadingPdf(false);
        setIsAiResponding(false);
        return;
      } finally {
        setIsUploadingPdf(false);
        setSelectedPdf(null); 
        if (pdfInputRef.current) pdfInputRef.current.value = '';
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
      });

      if (result.error) {
        toast({ title: "AI Chat Error", description: result.error, variant: "destructive" });
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
      toast({ title: "AI Chat Failed", description: "Could not get response from AI.", variant: "destructive" });
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
        <header className="flex flex-col items-center space-y-4">
          <div className="flex flex-col items-center">
            <div className="mb-2">
              <Image src="/logo.png" alt="Optimum Logo" width={250} height={60} priority />
            </div>
            <h1
              className="text-4xl sm:text-5xl font-headline font-bold text-primary drop-shadow-sm text-center"
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
          </div>
          {selectedSalesperson && (
            <div className="flex items-center justify-center text-sm text-muted-foreground bg-card p-2 rounded-md shadow-sm w-full max-w-xs">
              <User className="mr-2 h-4 w-4 text-primary" />
              Active User: <button onClick={() => setSelectedSalesperson(null)} className="font-semibold text-accent hover:underline ml-1 focus:outline-none">{selectedSalesperson.name} (Switch)</button>
            </div>
          )}
        </header>

        <Tabs defaultValue="field-day" className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-6 border bg-transparent p-1 rounded-md">
            <TabsTrigger value="field-day"><PlusCircle className="mr-2 h-4 w-4 sm:hidden lg:inline-block" />Field Day</TabsTrigger>
            <TabsTrigger value="call-day"><ListChecks className="mr-2 h-4 w-4 sm:hidden lg:inline-block" />Call Day</TabsTrigger>
            <TabsTrigger value="visits"><MapPin className="mr-2 h-4 w-4 sm:hidden lg:inline-block" />Visits</TabsTrigger>
            <TabsTrigger value="ai-chat"><Bot className="mr-2 h-4 w-4 sm:hidden lg:inline-block" />Debbie</TabsTrigger>
            <TabsTrigger value="about"><InfoIcon className="mr-2 h-4 w-4 sm:hidden lg:inline-block" />About</TabsTrigger>
          </TabsList>

          <TabsContent value="field-day">
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-center items-center gap-2 mb-3 p-3 bg-card rounded-lg shadow">
                    <h2 className="text-lg font-semibold text-foreground text-center">
                      Welcome {selectedSalesperson.name}! Good Luck Today!
                    </h2>
                </div>
                <div className="flex justify-center items-center gap-4 w-full">
                    <Button onClick={handleOpenAddVisitForm} size="lg" className="shadow-md hover:shadow-lg transition-shadow">
                        <PlusCircle className="mr-2 h-5 w-5" /> Hit New Door
                    </Button>
                    <AlertDialog open={isEndDayConfirmOpen} onOpenChange={setIsEndDayConfirmOpen}>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="lg" className="shadow-md hover:shadow-lg transition-shadow">
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
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-center items-center gap-2 mb-4 p-4 bg-card rounded-lg shadow">
                <h2 className="text-2xl font-semibold text-foreground text-center">
                  Call Day Priority List
                </h2>
              </div>

              <div className="p-4 bg-card rounded-lg shadow mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <ListFilter className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-medium text-foreground">Sort Options</h3>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start sm:items-center">
                  <div className="flex flex-col gap-1.5 w-full sm:w-auto">
                    <Label htmlFor="sort-criteria" className="text-sm">Sort By</Label>
                    <Select
                      value={sortCriteria}
                      onValueChange={(value) => setSortCriteria(value as 'partnershipConfidence' | 'timestamp')}
                    >
                      <SelectTrigger id="sort-criteria" className="w-full sm:w-[220px]">
                        <SelectValue placeholder="Select criteria" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="partnershipConfidence">Partnership Confidence</SelectItem>
                        <SelectItem value="timestamp">Date Visited</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5 w-full sm:w-auto">
                    <Label htmlFor="sort-order" className="text-sm">Order</Label>
                    <Select
                      value={sortOrder}
                      onValueChange={(value) => setSortOrder(value as 'asc' | 'desc')}
                    >
                      <SelectTrigger id="sort-order" className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Select order" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="desc">Descending</SelectItem>
                        <SelectItem value="asc">Ascending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {sortedVisitsForCallDay.length === 0 ? (
                <div className="text-center py-10 bg-card rounded-lg shadow">
                  <p className="text-xl text-muted-foreground mb-4">No visits to display. Log visits in "Field Day" first.</p>
                </div>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
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
                        onUpdateVisit={handleUpdateVisitInList}
                      />
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-4 text-sm text-muted-foreground text-center">
                Logged in as: {selectedSalesperson.name}
              </p>
            </div>
          </TabsContent>

          <TabsContent value="visits">
            <section aria-labelledby="map-section-title" className="p-6 bg-card rounded-xl shadow-xl space-y-6">
              <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center justify-center">
                  <h2 id="visits-section-title" className="text-2xl font-headline font-semibold flex items-center text-foreground">
                      <MapPin className="mr-3 h-7 w-7 text-primary" /> Company Visits Map
                  </h2>
                  {visits.length > 0 && (
                      <Badge variant="default" className="text-lg font-medium bg-accent text-accent-foreground hover:bg-accent/90 border-transparent">
                          {selectedSalesperson.name} Visits: {visits.length}
                      </Badge>
                  )}
              </div>

              <div className="flex flex-wrap gap-2 justify-center">
                 <ExportPdfButton visits={visits} className="h-8 px-2 text-xs" />
                 <ExportButton visits={visits} className="h-8 px-2 text-xs" />
                 <Button onClick={handleEmailChris} variant="default" size="sm" className="h-8 px-2 text-xs">
                   Email Chris
                 </Button>
              </div>
              
              <GoogleMapComponent visits={visits} />
               <p className="mt-4 text-sm text-muted-foreground text-center">Visits for: {selectedSalesperson.name}</p>
            </section>
          </TabsContent>

          <TabsContent value="ai-chat">
            <UiCard className="w-full max-w-2xl mx-auto shadow-xl">
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
                <p className="text-sm text-muted-foreground pt-2">Ask questions about your visits or get planning help. Recent visits and attached PDFs are used as context.</p>
              </UiCardHeader>
              <UiCardContent className="p-0">
                <ScrollArea className="h-[450px] w-full p-4 border-t border-b">
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
                            <AvatarFallback>{selectedSalesperson?.name.substring(0, 1) || 'U'}</AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    </div>
                  ))}
                  {isAiResponding && !isUploadingPdf && ( 
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
                {selectedPdf && (
                  <div className="w-full flex items-center justify-between p-2 text-xs bg-secondary rounded-md">
                    <div className="flex items-center gap-2 truncate">
                      <Paperclip className="h-4 w-4 text-primary shrink-0" />
                      <span className="truncate" title={selectedPdf.name}>{selectedPdf.name}</span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={handleClearPdf} className="h-6 w-6 shrink-0">
                      <XCircle className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      <span className="sr-only">Clear PDF</span>
                    </Button>
                  </div>
                )}
                 {isUploadingPdf && (
                    <div className="w-full flex items-center gap-2 text-xs text-primary p-1">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Uploading PDF: {selectedPdf?.name}...
                    </div>
                 )}
                <div className="flex w-full items-center space-x-2">
                  <Input
                    id="pdf-upload-input"
                    type="file"
                    accept="application/pdf"
                    onChange={handlePdfSelect}
                    className="hidden"
                    ref={pdfInputRef}
                    disabled={isAiResponding || isUploadingPdf}
                  />
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={() => pdfInputRef.current?.click()}
                    disabled={isAiResponding || isUploadingPdf}
                    aria-label="Attach PDF"
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Input
                    type="text"
                    placeholder="Type your message..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) => { if (e.key === 'Enter' && !isAiResponding && !isUploadingPdf) handleSendChatMessage(); }}
                    className="flex-1"
                    disabled={isAiResponding || isUploadingPdf}
                  />
                  <Button onClick={handleSendChatMessage} disabled={!chatInput.trim() || isAiResponding || isUploadingPdf}>
                    {(isAiResponding && !isUploadingPdf) || isUploadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    <span className="sr-only">Send</span>
                  </Button>
                </div>
              </UiCardFooter>
            </UiCard>
             <p className="mt-4 text-sm text-muted-foreground text-center">
                Chatting as: {selectedSalesperson.name}
              </p>
          </TabsContent>


          <TabsContent value="about">
            <div className="p-6 bg-card rounded-xl shadow-xl min-h-[300px] flex flex-col items-start justify-start space-y-6">
              <div>
                <h2 className="text-2xl font-headline font-semibold text-primary flex items-center">
                  <InfoIcon className="mr-3 h-7 w-7" /> About Optimum Trailblazer
                </h2>
                <p className="text-foreground text-base leading-relaxed mt-2 pl-4">
                  This app is intended to help you streamline your efforts in acquiring new clients and partners alike.
                  It will help you organize the data you collect and also help guide you on your journey as you build Optimum Water Bridges.
                </p>
                <ul className="list-disc list-inside text-foreground text-base leading-relaxed mt-3 space-y-1">
                   <li>
                    When you "hit new door", the app begins to scrape the web for the company data at which you are currently located.
                    It will hopefully give a a quick run down of what you are up against as a salesperson,
                    and potentially help you get to the decision maker more efficiently.
                  </li>
                  <li>
                    When you "log the meeting" the app creates a visit card that stores very important information for your future. The more information you add to this, the more powerful the app becomes. The AI chat will have more ammunition to work with! So be as detailed as you can to become a more optimum salesperson.
                  </li>
                </ul>
              </div>

              <div className="w-full pt-4 border-t">
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
                        <li key={index} className="text-sm leading-relaxed">
                          {suggestion.text}
                          <span className="block text-xs text-muted-foreground mt-0.5">
                            &mdash; by {suggestion.salespersonName} on {format(new Date(suggestion.timestamp), 'MMM d, yyyy, h:mm a')}
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

              <p className="text-sm text-muted-foreground mt-auto pt-4">
                Currently logged in as: {selectedSalesperson.name}
              </p>
            </div>
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

