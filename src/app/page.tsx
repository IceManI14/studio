
'use client';

import { useState, useEffect } from 'react';
import type { Visit, Salesperson } from '@/lib/types';
import { Button } from '@/components/ui/button';
import MapPlaceholder from '@/components/map-placeholder';
import VisitForm from '@/components/visit-form';
import VisitCard from '@/components/visit-card';
import ExportButton from '@/components/export-button';
import ExportPdfButton from '@/components/export-pdf-button';
import { PlusCircle, ListChecks, User, InfoIcon, Sunset, Send, PartyPopper, MessagesSquare, Hash, Mail, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
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
import { Card as UiCard, CardContent as UiCardContent, CardHeader as UiCardHeader } from '@/components/ui/card';

interface SubmittedSuggestion {
  text: string;
  salespersonName: string;
  timestamp: string;
}

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
  const [coldCallCount, setColdCallCount] = useState<number>(0);
  const [selectedSalesperson, setSelectedSalesperson] = useState<Salesperson | null>(null);
  const [userCurrentLatitude, setUserCurrentLatitude] = useState<number | undefined>();
  const [userCurrentLongitude, setUserCurrentLongitude] = useState<number | undefined>();
  const { toast } = useToast();
  const [sortedVisitsForCallDay, setSortedVisitsForCallDay] = useState<Visit[]>([]);
  const [isEndDayConfirmOpen, setIsEndDayConfirmOpen] = useState(false);
  const [suggestionText, setSuggestionText] = useState('');
  const [submittedSuggestions, setSubmittedSuggestions] = useState<SubmittedSuggestion[]>([]);


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

  // Effect to load visits, suggestions, and cold call count AFTER salesperson is selected & get mock GPS
  useEffect(() => {
    if (!selectedSalesperson) {
      setVisits([]); // Clear visits if no salesperson is selected
      setSubmittedSuggestions([]); // Clear suggestions
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
              // Old format: convert to new object format
              return {
                text: item,
                salespersonName: selectedSalesperson.name,
                timestamp: new Date(0).toISOString(), // Default for old entries
              };
            }
            // New format or already transformed: use as is
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


    // Simulate getting current location
    const randomLat = parseFloat((Math.random() * (49 - 25) + 25).toFixed(6));
    const randomLng = parseFloat((Math.random() * (-66 - -125) + -125).toFixed(6));
    setUserCurrentLatitude(randomLat);
    setUserCurrentLongitude(randomLng);
    toast({
      title: "Mock Location Acquired",
      description: `App initialized with mock location: Lat: ${randomLat.toFixed(4)}, Lng: ${randomLng.toFixed(4)}`
    });

  }, [selectedSalesperson, toast]);

  // Effect to save visits and check for 30-door milestone
  useEffect(() => {
    if (!selectedSalesperson) return;
    const visitsStorageKey = getVisitsStorageKey();
    if (!visitsStorageKey) return;

    if (visits.length > 0 || localStorage.getItem(visitsStorageKey)) {
        localStorage.setItem(visitsStorageKey, JSON.stringify(visits));
    }

    // Check for 30 doors milestone (based on coldCallCount, which represents doors hit)
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
          duration: 7000, // Make it last a bit longer
        });
        localStorage.setItem(milestoneKey, 'true');
      }
    }
  }, [visits, coldCallCount, selectedSalesperson, toast]);

  // Effect to save cold call count
  useEffect(() => {
    if (!selectedSalesperson) return;
    const coldCallCountStorageKey = getColdCallCountStorageKey();
    if (!coldCallCountStorageKey) return;
    localStorage.setItem(coldCallCountStorageKey, coldCallCount.toString());
  }, [coldCallCount, selectedSalesperson]);

  // Effect to sort visits for Call Day tab
  useEffect(() => {
    if (visits.length > 0) {
      const sorted = visits.slice().sort((a, b) => {
        const confidenceA = a.partnershipConfidence ?? 0;
        const confidenceB = b.partnershipConfidence ?? 0;

        if (confidenceB !== confidenceA) {
          return confidenceB - confidenceA;
        }
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });
      setSortedVisitsForCallDay(sorted);
    } else {
      setSortedVisitsForCallDay([]);
    }
  }, [visits]);


  const handleSelectSalesperson = (salesperson: Salesperson) => {
    setSelectedSalesperson(salesperson);
    localStorage.setItem(SELECTED_SALESPERSON_ID_KEY, salesperson.id);
    setIsVisitFormOpen(false);
    setCurrentEditingVisit(undefined);
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

    const chrisEmail = "chris@drinkoptimum.com";
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
    
    body += `\nBest regards,\n${selectedSalesperson.name || 'Optimum Trailblazer App'}`;

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
        <header className="text-center sm:text-left">
          <div className="flex flex-col items-center mb-4">

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
          </div>
          {selectedSalesperson && (
            <div className="flex items-center justify-center sm:justify-start text-sm text-muted-foreground mt-2 bg-card p-2 rounded-md shadow-sm">
              <User className="mr-2 h-4 w-4 text-primary" />
              Active User: <button onClick={() => setSelectedSalesperson(null)} className="font-semibold text-accent hover:underline ml-1 focus:outline-none">{selectedSalesperson.name} (Switch)</button>
            </div>
          )}
        </header>

        <Tabs defaultValue="field-day" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6 shadow-sm">
            <TabsTrigger value="field-day">Field Day</TabsTrigger>
            <TabsTrigger value="call-day">Call Day</TabsTrigger>
            <TabsTrigger value="daily-route">Daily Route</TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
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
              {sortedVisitsForCallDay.length === 0 ? (
                <div className="text-center py-10 bg-card rounded-lg shadow">
                  <p className="text-xl text-muted-foreground mb-4">No visits to display. Log visits in "Field Day" first.</p>
                </div>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {sortedVisitsForCallDay.map(visit => (
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
              <p className="mt-4 text-sm text-muted-foreground text-center">
                Organized by partnership confidence (highest first), then by date visited (most recent first).
                <br />
                Logged in as: {selectedSalesperson.name}
              </p>
            </div>
          </TabsContent>

          <TabsContent value="daily-route">
            <section aria-labelledby="map-section-title" className="p-6 bg-card rounded-xl shadow-xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center gap-4">
                  <div className="flex items-center gap-3">
                      <h2 id="visits-section-title" className="text-2xl font-headline font-semibold flex items-center text-foreground">
                          <ListChecks className="mr-3 h-7 w-7 text-primary" /> Company Visits
                      </h2>
                      {visits.length > 0 && (
                          <Badge variant="default" className="text-lg font-medium bg-accent text-accent-foreground hover:bg-accent/90 border-transparent">
                              {selectedSalesperson.name} Visited: {visits.length}
                          </Badge>
                      )}
                  </div>
                  <div className="flex gap-2">
                     <ExportPdfButton visits={visits} />
                     <ExportButton visits={visits} />
                     <Button onClick={handleEmailChris} variant="outline">
                       <UserPlus className="mr-2 h-4 w-4" /> Email Chris
                     </Button>
                  </div>
              </div>
              <MapPlaceholder visits={visits} />
               <p className="mt-4 text-sm text-muted-foreground text-center">Route for: {selectedSalesperson.name}</p>
            </section>
          </TabsContent>

          <TabsContent value="about">
            <div className="p-6 bg-card rounded-xl shadow-xl min-h-[300px] flex flex-col items-start justify-start space-y-6">
              <div>
                <h2 className="text-2xl font-headline font-semibold text-primary flex items-center">
                  <InfoIcon className="mr-3 h-7 w-7" /> About Optimum Trailblazer
                </h2>
                <p className="text-foreground text-base leading-relaxed mt-2">
                  This app is intended to help you streamline your efforts in acquiring new clients and partners alike.
                  It will help you organize the data you collect and also help guide you on your journey as you build Optimum Water Bridges.
                </p>
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
