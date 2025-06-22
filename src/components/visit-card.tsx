
'use client';

import type { Visit } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, CalendarDays, Edit, FileText, Info, Loader2, MapPin, Sparkles, Star, Trash2, CheckSquare, Square, Swords, UserCircle, Box, ShieldAlert, Hash, PackageCheck, Droplets, AlertTriangle, CheckCircle2, ShieldQuestion, Wind, CalendarCheck, CalendarX, FileType, CalendarClock, Contact } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';
import { summarizeVisitNotes } from '@/ai/flows/summarize-visit-notes';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import NextImage from 'next/image';
import { COMPETITOR_DETAILS } from '@/lib/competitor-details';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { Separator } from './ui/separator';

interface VisitCardProps {
  visit: Visit;
  onEdit: (visit: Visit) => void;
  onDelete: (visitId: string) => void;
  onUpdateVisit: (updatedVisit: Visit) => void;
  onZoom?: (visit: Visit) => void;
  isZoomedView?: boolean;
}

const VisitCard: React.FC<VisitCardProps> = ({ visit, onEdit, onDelete, onUpdateVisit, onZoom, isZoomedView }) => {
  const [isSummarizing, setIsSummarizing] = useState(false);
  const { toast } = useToast();
  const timeZone = 'America/New_York'; 
  const [isDateVisible, setIsDateVisible] = useState(false);
  const [isCoordsVisible, setIsCoordsVisible] = useState(false);

  const handleSummarizeAgain = async () => {
    if (!visit.notes || visit.notes.trim() === '') {
      toast({ title: "No notes to summarize", variant: "default" });
      return;
    }
    setIsSummarizing(true);
    try {
      const result = await summarizeVisitNotes({ notes: visit.notes });
      const updatedVisit = { ...visit, notesSummary: result.summary };
      onUpdateVisit(updatedVisit);
      toast({ title: "Notes Re-summarized", description: "Summary has been updated."});
    } catch (error) {
      toast({ title: "Error Summarizing", description: "Could not re-summarize notes.", variant: "destructive" });
    } finally {
      setIsSummarizing(false);
    }
  };

  const hasDecisionMakerDetails = visit.decisionMakerName || visit.decisionMakerTitle || visit.decisionMakerContact || (visit.contactInfo?.info && visit.contactInfo.info !== "No contact info found on web!");


  const getTDSInfo = () => {
    if (!visit.hasTDSReading || typeof visit.tdsValue !== 'number') {
      return null;
    }
    const tds = visit.tdsValue;
    if (tds <= 50) {
      return {
        message: "Optimum Water Quality. Ideal for RO/DI.",
        variant: "default" as const,
        icon: <CheckCircle2 className="mr-1 h-3 w-3" />,
        className: "bg-green-500 hover:bg-green-600 text-white border-green-600"
      };
    } else if (tds > 50 && tds <= 100) {
      return {
        message: "High Quality Bottled Water.",
        variant: "default" as const,
        icon: <CheckCircle2 className="mr-1 h-3 w-3" />,
        className: "bg-blue-500 hover:bg-blue-600 text-white border-blue-600"
      };
    } else if (tds > 100 && tds <= 150) {
      return {
        message: "Spring Water.",
        variant: "secondary" as const,
        icon: <Wind className="mr-1 h-3 w-3" /> ,
        className: "bg-sky-500 hover:bg-sky-600 text-white border-sky-600"
      };
    } else if (tds > 150 && tds <= 275) {
      return {
        message: "Marginally Acceptable Water.",
        variant: "outline" as const,
        icon: <AlertTriangle className="mr-1 h-3 w-3" />,
        className: "text-yellow-700 border-yellow-500 bg-yellow-50 hover:bg-yellow-100 dark:text-yellow-400 dark:border-yellow-600 dark:bg-yellow-900/30 dark:hover:bg-yellow-900/50"
      };
    } else if (tds > 275 && tds <= 500) {
      return {
        message: "HIGH TDS Water (Tap/Mineral Spring).",
        variant: "outline" as const,
        icon: <AlertTriangle className="mr-1 h-3 w-3" />,
        className: "text-orange-700 border-orange-500 bg-orange-50 hover:bg-orange-100 dark:text-orange-400 dark:border-orange-600 dark:bg-orange-900/30 dark:hover:bg-orange-900/50"
      };
    } else if (tds > 500) {
      return {
        message: (
          <div className="text-left text-xs w-full">
            <p className="font-semibold uppercase text-center text-base">
              Warning!!!!!!
            </p>
            <p className="font-semibold uppercase text-center text-xs">
              EPA Maximum Contaminant Level Exceeded
            </p>
            <p className="font-medium text-center">
              ({tds} PPM)
            </p>
            <ul className="list-disc list-outside mt-1 space-y-0.5 pl-4">
              <li>Salesperson must inform about potential for more service calls (approx. $149 each).</li>
              <li>Techs may need to install a pre-filter.</li>
            </ul>
          </div>
        ),
        variant: "destructive" as const,
        icon: <ShieldAlert className="mr-1 h-4 w-4" />,
        className: "items-start"
      };
    }
    return {
        message: "TDS Level Undefined.",
        variant: "outline" as const,
        icon: <ShieldQuestion className="mr-1 h-3 w-3" />,
        className: "text-gray-700 border-gray-500 bg-gray-50 hover:bg-gray-100 dark:text-gray-400 dark:border-gray-600 dark:bg-gray-900/30 dark:hover:bg-gray-900/50"
    };
  };

  const tdsInfo = getTDSInfo();
  const isHtmlCard = visit.businessCardImageUrl?.trim().startsWith('<!DOCTYPE html>');


  return (
    <Card 
      className={cn(
        "flex flex-col h-full shadow-lg hover:shadow-xl transition-shadow duration-300",
        !isZoomedView && 'cursor-pointer',
        isZoomedView && 'max-h-[90vh] overflow-y-auto'
      )}
      onClick={!isZoomedView ? () => onZoom?.(visit) : undefined}
    >
      <CardHeader className="space-y-2 pb-3">
        <div className="flex justify-between items-start min-h-[3rem]">
            {/* Left side: Visit number and toggleable date */}
            <div className="flex flex-col items-start">
              <div onClick={(e) => { e.stopPropagation(); setIsDateVisible(p => !p); }} className="cursor-pointer">
                  {visit.visitNumber && (
                      <Badge variant="secondary" className="text-base font-semibold px-2 py-1">
                          <Hash className="mr-1 h-4 w-4" />{visit.visitNumber}
                      </Badge>
                  )}
                  {isDateVisible && (
                      <div className="flex items-center text-xs text-muted-foreground mt-1">
                          <CalendarDays className="mr-1 h-3 w-3" />
                          {formatInTimeZone(new Date(visit.timestamp), timeZone, 'MMM d, yyyy, h:mm a')}
                      </div>
                  )}
              </div>
            </div>
            {/* Confidence stars on the right */}
            <div>
                {visit.partnershipConfidence && visit.partnershipConfidence > 0 && (
                  <div className="flex flex-col items-center">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((starValue) => (
                        <Star
                          key={starValue}
                          className={cn(
                            "h-5 w-5",
                            starValue <= (visit.partnershipConfidence ?? 0)
                              ? "text-yellow-400 fill-yellow-400"
                              : "text-muted-foreground/50"
                          )}
                        />
                      ))}
                    </div>
                    <div className="text-center text-xs text-muted-foreground mt-0.5">
                      (Partnership Confidence)
                    </div>
                  </div>
                )}
            </div>
        </div>
        
        <div className="flex flex-row justify-between items-start w-full">
          <div className="flex-grow space-y-1.5">
            <CardTitle 
              className="font-headline text-2xl text-primary flex items-center justify-center w-full cursor-pointer"
              onClick={(e) => { e.stopPropagation(); setIsCoordsVisible(p => !p); }}
            >
                <Building2 className="mr-2 h-5 w-5" /> {visit.companyName}
            </CardTitle>
            
            {isCoordsVisible && visit.latitude && visit.longitude && (
                <p className="text-xs text-muted-foreground flex items-center justify-center w-full">
                    <MapPin className="mr-1 h-3 w-3" /> Lat: {visit.latitude.toFixed(4)}, Lng: {visit.longitude.toFixed(4)}
                </p>
            )}
            
            <div className="flex flex-col items-start space-y-1 w-full">
                {visit.interestedUnit && (
                  <div className="p-1 bg-green-500/10 rounded-md border border-green-500/30">
                    <h4 className="font-medium text-green-700 dark:text-green-400 flex items-center text-sm">
                      Unit of Interest: {visit.interestedUnit}
                    </h4>
                  </div>
                )}
            </div>

            <div className="flex flex-col items-start space-y-1">
              <div className="flex items-center text-xs text-muted-foreground">
                {visit.hasBusinessCard ? <CheckSquare className="mr-2 h-4 w-4 text-green-500" /> : <Square className="mr-2 h-4 w-4 text-muted-foreground/50" />}
                Business Card: {visit.hasBusinessCard ? 'Yes' : 'No'}
              </div>
              <div className="flex items-center text-xs text-muted-foreground">
                {visit.hasTDSReading ? <CheckSquare className="mr-2 h-4 w-4 text-green-500" /> : <Square className="mr-2 h-4 w-4 text-muted-foreground/50" />}
                TDS Reading: {visit.hasTDSReading ? `Yes (${visit.tdsValue ?? 'N/A'} PPM)` : 'Not Yet'}
              </div>
              <div className="flex items-center text-xs text-muted-foreground">
                {visit.futureMeetingSet ? <CalendarCheck className="mr-2 h-4 w-4 text-green-500" /> : <CalendarX className="mr-2 h-4 w-4 text-muted-foreground/50" />}
                Future Meeting Set: {visit.futureMeetingSet ? 'Yes' : 'No'}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-grow space-y-3 text-sm pt-3">
        <Accordion type="multiple" className="w-full">
          {hasDecisionMakerDetails && (
            <AccordionItem value="decision-maker">
              <AccordionTrigger>
                <span className="font-medium text-foreground flex items-center">
                  <UserCircle className="mr-2 h-4 w-4 text-primary" /> Decision Maker
                </span>
              </AccordionTrigger>
              <AccordionContent>
                {visit.decisionMakerName && <p className="text-muted-foreground"><strong>Name:</strong> {visit.decisionMakerName}</p>}
                {visit.decisionMakerTitle && <p className="text-muted-foreground"><strong>Title:</strong> {visit.decisionMakerTitle}</p>}
                {visit.decisionMakerContact && <p className="text-muted-foreground"><strong>Direct Contact:</strong> {visit.decisionMakerContact}</p>}
                {visit.contactInfo?.info && visit.contactInfo.info !== "No contact info found on web!" && visit.contactInfo.info !== visit.decisionMakerContact &&
                  <p className="text-muted-foreground"><strong>General/Scraped Contact:</strong> <span className="whitespace-pre-wrap break-words">{visit.contactInfo.info}</span></p>
                }
                {visit.contactInfo?.info && visit.contactInfo.info !== "No contact info found on web!" && !visit.decisionMakerContact && visit.decisionMakerName &&
                  <p className="text-muted-foreground"><strong>Contact:</strong> <span className="whitespace-pre-wrap break-words">{visit.contactInfo.info}</span></p>
                }
              </AccordionContent>
            </AccordionItem>
          )}

          {visit.futureMeetingSet && visit.futureMeetingDateTime && (
             <AccordionItem value="future-meeting">
              <AccordionTrigger>
                <span className="font-medium text-foreground flex items-center">
                  <CalendarClock className="mr-2 h-4 w-4 text-primary" />
                  Future Meeting Details
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground">
                  {formatInTimeZone(new Date(visit.futureMeetingDateTime), timeZone, 'EEE, MMM d, yyyy @ p')}
                </p>
              </AccordionContent>
            </AccordionItem>
          )}

          {visit.hasTDSReading && visit.tdsValue !== undefined && tdsInfo && (
            <AccordionItem value="tds-analysis">
              <AccordionTrigger>
                <span className="font-medium text-foreground flex items-center">
                  <Droplets className="mr-2 h-4 w-4 text-primary" /> TDS Analysis: {visit.tdsValue} PPM
                </span>
              </AccordionTrigger>
              <AccordionContent>
                 <Badge
                    variant={tdsInfo.variant}
                    className={cn(
                      "text-xs mt-1 whitespace-normal h-auto py-1.5 px-2 flex w-full",
                      typeof tdsInfo.message === 'string' ? "items-center" : "items-start",
                      tdsInfo.className
                    )}
                  >
                    {tdsInfo.icon}
                    <div className="ml-2 w-full">{tdsInfo.message}</div>
                  </Badge>
              </AccordionContent>
            </AccordionItem>
          )}

          {visit.hasBusinessCard && visit.businessCardImageUrl && (
            <AccordionItem value="business-card">
              <AccordionTrigger>
                <span className="font-medium text-foreground flex items-center">
                  <Contact className="mr-2 h-4 w-4 text-primary" />
                  Business Card
                </span>
              </AccordionTrigger>
              <AccordionContent className="flex justify-center p-2">
                {isHtmlCard ? (
                  <div className="w-full h-[400px] overflow-hidden rounded-md border">
                    <iframe
                      srcDoc={visit.businessCardImageUrl}
                      className="w-full h-full border-0"
                      title="Digital Business Card"
                      sandbox="allow-scripts allow-same-origin"
                    />
                  </div>
                ) : (
                  <div className="relative w-full max-w-sm aspect-[1.6/1] mx-auto">
                    <NextImage
                      src={visit.businessCardImageUrl}
                      alt="Business Card"
                      data-ai-hint="business card professional"
                      fill
                      style={{ objectFit: 'contain' }}
                      className="rounded-md"
                    />
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          )}

          {visit.discussedCompetitors && visit.coolerType && (
            <AccordionItem value="cooler-info">
               <AccordionTrigger>
                <span className="font-medium text-foreground flex items-center">
                  <Box className="mr-2 h-4 w-4 text-blue-500" />
                  <span>Competitor Cooler: <span className="text-accent font-semibold">{visit.coolerType}</span></span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                {visit.competitorName && COMPETITOR_DETAILS[visit.competitorName] ? (
                  <>
                    <p className="text-sm font-semibold mb-1">Intel on {visit.competitorName}:</p>
                    {COMPETITOR_DETAILS[visit.competitorName].title && (
                      <p className="text-sm text-muted-foreground italic mb-1">{COMPETITOR_DETAILS[visit.competitorName].title}</p>
                    )}
                    <ul className="list-disc list-inside text-muted-foreground space-y-0.5 text-xs">
                      {COMPETITOR_DETAILS[visit.competitorName].details.map((detail, index) => (
                        <li key={index}>{detail}</li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">No specific intel available for this competitor.</p>
                )}
              </AccordionContent>
            </AccordionItem>
          )}
          
          {(visit.notesSummary || visit.notes) && (
            <AccordionItem value="notes-section">
              <AccordionTrigger>
                <span className="font-medium text-foreground flex items-center">
                  <FileText className="mr-2 h-4 w-4 text-primary" /> Notes
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-3">
                {visit.notesSummary && (
                  <div>
                    <h4 className="font-medium text-sm text-foreground flex items-center mb-1">
                      <Sparkles className="mr-2 h-4 w-4 text-yellow-500" />
                      AI Summary
                    </h4>
                    <p className="text-muted-foreground whitespace-pre-wrap break-words">{visit.notesSummary}</p>
                  </div>
                )}

                {visit.notesSummary && visit.notes && <Separator />}

                {visit.notes && (
                  <div>
                    <h4 className="font-medium text-sm text-foreground mb-1">Original Notes</h4>
                    <p className="text-muted-foreground max-h-28 overflow-y-auto whitespace-pre-wrap break-words">{visit.notes}</p>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
        
        {!visit.notesSummary && visit.notes && (
          <Button variant="link" size="sm" onClick={(e) => { e.stopPropagation(); handleSummarizeAgain(); }} disabled={isSummarizing} className="text-accent p-0 h-auto">
            {isSummarizing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {isSummarizing ? 'Summarizing...' : 'Summarize Notes'}
          </Button>
        )}

      </CardContent>
      <CardFooter className="flex justify-end gap-2 border-t pt-4 mt-auto">
        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onEdit(visit); }} aria-label={`Edit visit to ${visit.companyName}`}>
          <Edit className="h-4 w-4" />
        </Button>
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" onClick={(e) => e.stopPropagation()} aria-label={`Delete visit to ${visit.companyName}`}>
                    <Trash2 className="h-4 w-4" />
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the visit log for {visit.companyName}.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDelete(visit.id)}>Delete</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
};

export default VisitCard;
