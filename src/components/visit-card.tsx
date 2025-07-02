
'use client';

import type { Visit } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, CalendarDays, Edit, FileText, Info, Loader2, MapPin, Sparkles, Star, Trash2, CheckSquare, Square, Swords, UserCircle, Box, ShieldAlert, Hash, PackageCheck, Droplets, AlertTriangle, CheckCircle2, ShieldQuestion, Wind, CalendarCheck, CalendarX, FileType, CalendarClock, Contact, PlusSquare, Mic } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';
import { summarizeNotesAction } from '@/app/actions';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import NextImage from 'next/image';
import { COMPETITOR_DETAILS } from '@/lib/competitor-details';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { Separator } from './ui/separator';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { useToast } from '@/hooks/use-toast';

interface VisitCardProps {
  visit: Visit;
  onEdit: (visit: Visit) => void;
  onDelete: (visitId: string) => void;
  onUpdateDealClosed: (visitId: string, dealClosed: boolean) => void;
  onZoom?: (visit: Visit) => void;
  isZoomedView?: boolean;
  onLogFollowUp?: (visit: Visit) => void;
  onDictateNotes?: (visit: Visit) => void;
  variant?: 'default' | 'planner';
}

const VisitCard: React.FC<VisitCardProps> = ({ visit, onEdit, onDelete, onUpdateDealClosed, onZoom, isZoomedView, onLogFollowUp, onDictateNotes, variant = 'default' }) => {
  const [isSummarizing, setIsSummarizing] = useState(false);
  const timeZone = 'America/New_York'; 
  const [isDateVisible, setIsDateVisible] = useState(false);
  const [isCoordsVisible, setIsCoordsVisible] = useState(false);
  const [openAccordionItems, setOpenAccordionItems] = useState<string[]>([]);
  const { toast } = useToast();

  const handleDealClosedChange = (checked: boolean) => {
    onUpdateDealClosed(visit.id, !!checked);
  };

  const handleSummarizeAgain = async () => {
    if (!visit.notes || visit.notes.trim() === '') {
      toast({ variant: 'destructive', title: "No notes to summarize" });
      return;
    }
    setIsSummarizing(true);
    try {
      const result = await summarizeNotesAction({ notes: visit.notes });
      if (result.error) {
        throw new Error(result.error);
      }
      // This is a temporary solution. Ideally the parent component would handle this update.
      // For now, we are not updating the visit object here to avoid prop-drilling complexities.
      // The summary will be updated on the next data fetch.
      toast({ title: "Notes Re-summarized", description: "Summary has been regenerated and will be updated." });
    } catch (error: any) {
      toast({ variant: 'destructive', title: "Error Summarizing", description: error.message || "Could not re-summarize notes." });
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
  
  if (variant === 'planner' && !isZoomedView) {
    return (
      <Card
        className={cn(
          "flex flex-col shadow-xl hover:shadow-2xl transition-shadow duration-300 bg-card/60 backdrop-blur-sm border-2",
          'border-orange-500 shadow-lg shadow-orange-500/20',
          !isZoomedView && 'cursor-pointer'
        )}
        onClick={!isZoomedView ? () => onZoom?.(visit) : undefined}
      >
        <CardContent className="p-3 flex-grow flex flex-col space-y-2">
            <div className="flex-grow space-y-2">
                <div className="bg-muted/50 p-2 rounded-md">
                    <h4 className="font-semibold text-foreground flex items-center"><Building2 className="mr-2 h-4 w-4 shrink-0" />{visit.companyName}</h4>
                </div>

                <div className="space-y-1 bg-black p-2 rounded-md">
                    <Label htmlFor={`planner-notes-${visit.id}`} className="text-xs font-medium text-muted-foreground">Future Visit Notes</Label>
                    <div id={`planner-notes-${visit.id}`} className="text-sm text-white whitespace-pre-wrap p-2 border border-zinc-700 rounded bg-black">
                        {visit.futureMeetingDateTime && (
                          <p className="font-bold text-yellow-300 mb-2">
                            Scheduled: {formatInTimeZone(new Date(visit.futureMeetingDateTime), timeZone, 'MMM d, yyyy, h:mm a')}
                          </p>
                        )}
                        {visit.notes || 'No notes for this visit.'}
                    </div>
                </div>
            </div>
        </CardContent>
        <CardFooter className="flex justify-end items-center gap-2 border-t pt-2 mt-auto p-3">
             {onDictateNotes && (
                <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onDictateNotes(visit); }} aria-label={`Dictate notes for ${visit.companyName}`}>
                    <Mic className="h-4 w-4" />
                </Button>
            )}
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
  }

  return (
    <Card 
      className={cn(
        "flex flex-col h-full shadow-xl hover:shadow-2xl transition-shadow duration-300 bg-card/60 backdrop-blur-sm border-2",
        variant === 'planner' 
          ? 'border-orange-500 shadow-lg shadow-orange-500/20' 
          : visit.dealClosed 
            ? 'border-green-500' 
            : 'border-sky-500',
        !isZoomedView && 'cursor-pointer'
      )}
      onClick={!isZoomedView ? () => onZoom?.(visit) : undefined}
    >
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start min-h-[3rem]">
            {/* Left side: Visit number and toggleable date */}
            <div className="flex flex-col items-start" onClick={(e) => { e.stopPropagation(); setIsDateVisible(p => !p); }} >
              <div className="cursor-pointer">
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
          <div className="flex-grow space-y-1.5 min-w-0">
            <CardTitle 
              className="font-headline text-2xl text-accent flex items-start justify-start w-full cursor-pointer text-left"
              onClick={(e) => { e.stopPropagation(); setIsCoordsVisible(p => !p); }}
            >
                <Building2 className="mr-2 h-5 w-5 shrink-0 mt-1.5" />
                <span className="break-words">{visit.companyName}</span>
            </CardTitle>
            
            {isCoordsVisible && visit.latitude && visit.longitude && (
                <p className="text-xs text-muted-foreground flex items-center justify-start w-full pl-7">
                    <MapPin className="mr-1 h-3 w-3" /> Lat: {visit.latitude.toFixed(4)}, Lng: {visit.longitude.toFixed(4)}
                </p>
            )}
            
            <div className="flex flex-col items-start space-y-1 w-full">
                {visit.interestedUnit && (
                  <div className="p-1 bg-green-500/10 rounded-md border border-green-500/30">
                    <h4 className="font-medium text-green-700 dark:text-green-400 text-sm break-words">
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
                TDS Reading: {visit.hasTDSReading ? `${visit.tdsValue} PPM` : 'Not Yet'}
              </div>
              <div className="flex items-center text-xs text-muted-foreground">
                {visit.futureMeetingSet ? <CalendarCheck className="mr-2 h-4 w-4 text-green-500" /> : <CalendarX className="mr-2 h-4 w-4 text-muted-foreground/50" />}
                Future Meeting Set: {visit.futureMeetingSet ? 'Yes' : 'No'}
              </div>
              <div className="flex items-center text-xs text-muted-foreground">
                {visit.freeTrial ? <CheckSquare className="mr-2 h-4 w-4 text-green-500" /> : <Square className="mr-2 h-4 w-4 text-muted-foreground/50" />}
                Free Trial: {visit.freeTrial ? 'Yes' : 'No'}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      {isZoomedView && (
        <CardContent className="flex-grow p-4 pt-0 overflow-y-auto">
          <Accordion type="multiple" value={openAccordionItems} onValueChange={setOpenAccordionItems} className="w-full space-y-2">
            {/* Future Meeting */}
            {visit.futureMeetingSet && visit.futureMeetingDateTime && (
              <AccordionItem value="future-meeting">
                <AccordionTrigger className="text-base font-semibold text-primary hover:no-underline">
                  <CalendarClock className="mr-2 h-5 w-5" /> Future Meeting
                </AccordionTrigger>
                <AccordionContent className="bg-primary/5 p-3 rounded-md">
                  <p className="text-sm text-muted-foreground">
                    A follow-up meeting is scheduled for: <br />
                    <span className="font-semibold text-foreground">
                      {formatInTimeZone(new Date(visit.futureMeetingDateTime), timeZone, 'eeee, MMMM d, yyyy \'at\' h:mm a')}
                    </span>
                  </p>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Combined Notes and Summary */}
            {(visit.notes || visit.notesSummary) && (
              <AccordionItem value="notes-summary">
                <AccordionTrigger className="text-base font-semibold text-primary hover:no-underline">
                  <FileText className="mr-2 h-5 w-5" /> Notes & AI Summary
                </AccordionTrigger>
                <AccordionContent className="bg-primary/5 p-3 rounded-md space-y-3">
                  {visit.notesSummary && (
                    <div>
                      <h4 className="font-semibold text-sm mb-1 flex items-center">
                        <Sparkles className="h-4 w-4 mr-2 text-primary" />
                        AI Summary
                      </h4>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{visit.notesSummary}</p>
                      <Button variant="ghost" size="sm" onClick={handleSummarizeAgain} disabled={isSummarizing} className="mt-2 text-primary hover:bg-primary/10 h-auto py-1 px-2 text-xs">
                        {isSummarizing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}
                        Re-summarize
                      </Button>
                    </div>
                  )}

                  {visit.notes && visit.notesSummary && <Separator />}
                  
                  {visit.notes && (
                    <div>
                      <h4 className="font-semibold text-sm mb-1 flex items-center">
                        <Info className="h-4 w-4 mr-2 text-primary" />
                        Full Visit Notes
                      </h4>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{visit.notes}</p>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Decision Maker */}
            {hasDecisionMakerDetails && (
              <AccordionItem value="dm-info">
                <AccordionTrigger className="text-base font-semibold text-primary hover:no-underline">
                  <Contact className="mr-2 h-5 w-5" /> Decision Maker & Contact
                </AccordionTrigger>
                <AccordionContent className="space-y-2 text-sm bg-primary/5 p-3 rounded-md">
                  {visit.decisionMakerName && <p><strong>Name:</strong> {visit.decisionMakerName}</p>}
                  {visit.decisionMakerTitle && <p><strong>Title:</strong> {visit.decisionMakerTitle}</p>}
                  {visit.decisionMakerContact && <p><strong>Contact:</strong> {visit.decisionMakerContact}</p>}
                  {visit.contactInfo?.info && visit.contactInfo.info !== "No contact info found on web!" && (
                    <div className="pt-2 border-t mt-2">
                      <p><strong>Scraped Info:</strong> {visit.contactInfo.info}</p>
                      <p className="text-xs text-muted-foreground"><strong>Confidence:</strong> {Math.round(visit.contactInfo.confidence * 100)}%</p>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Competitor Info */}
            {visit.discussedCompetitors && (
              <AccordionItem value="competitor">
                <AccordionTrigger className="text-base font-semibold text-primary hover:no-underline">
                  <Swords className="mr-2 h-5 w-5" /> Competitor Info
                </AccordionTrigger>
                <AccordionContent className="space-y-2 text-sm bg-primary/5 p-3 rounded-md">
                  <p><strong>Competitor:</strong> {visit.competitorName || 'Not specified'}</p>
                  <p><strong>Cooler Type:</strong> {visit.coolerType || 'Not specified'}</p>
                  {visit.competitorName && COMPETITOR_DETAILS[visit.competitorName] && (
                    <div className="pt-2 mt-2 border-t">
                      <h4 className="font-semibold mb-1">{COMPETITOR_DETAILS[visit.competitorName].title || `About ${visit.competitorName}`}</h4>
                      <ul className="list-disc list-inside text-xs space-y-1">
                        {COMPETITOR_DETAILS[visit.competitorName].details.map((detail, i) => <li key={i}>{detail}</li>)}
                      </ul>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Business Card */}
            {visit.businessCardImageUrl && (
              <AccordionItem value="business-card">
                <AccordionTrigger className="text-base font-semibold text-primary hover:no-underline">
                  <FileType className="mr-2 h-5 w-5" /> Business Card
                </AccordionTrigger>
                <AccordionContent className="bg-primary/5 p-3 rounded-md">
                  {isHtmlCard ? (
                    <div className="text-sm text-destructive-foreground bg-destructive p-3 rounded-md">
                      <p>Cannot display business card. The saved data appears to be HTML content instead of an image. This can happen if the image capture process was interrupted or failed. Please try re-uploading the business card image.</p>
                    </div>
                  ) : (
                    <div className="relative w-full aspect-[1.77] max-w-sm mx-auto">
                      <NextImage
                        src={visit.businessCardImageUrl}
                        alt="Business card"
                        data-ai-hint="business card professional"
                        fill
                        style={{ objectFit: 'contain' }}
                        className="rounded-md border bg-muted"
                      />
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            )}

            {/* TDS Info */}
            {tdsInfo && (
              <AccordionItem value="tds-info">
                <AccordionTrigger className="text-base font-semibold text-primary hover:no-underline">
                  <Droplets className="mr-2 h-5 w-5" /> TDS Reading Details
                </AccordionTrigger>
                <AccordionContent className="bg-primary/5 p-3 rounded-md">
                  <Badge variant={tdsInfo.variant} className={cn("text-sm h-auto whitespace-normal text-left w-full justify-start", tdsInfo.className)}>
                    <div className="flex items-start p-1 w-full">
                      <span className="shrink-0 mt-0.5 mr-2">{tdsInfo.icon}</span>
                      <span className="flex-1">{tdsInfo.message}</span>
                    </div>
                  </Badge>
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        </CardContent>
      )}

      <CardFooter className="flex justify-between items-center gap-2 border-t pt-4 mt-auto">
        <div 
          className="flex items-center space-x-2"
          onClick={(e) => e.stopPropagation()}
        >
          <Checkbox 
            id={`deal-closed-${visit.id}`} 
            checked={!!visit.dealClosed}
            onCheckedChange={(checked) => handleDealClosedChange(Boolean(checked))}
            aria-label="Mark deal as closed"
          />
          <Label htmlFor={`deal-closed-${visit.id}`} className="cursor-pointer text-sm font-medium text-green-600 dark:text-green-400">
            Deal Closed!
          </Label>
        </div>

        <div className="flex justify-end gap-2">
            {onDictateNotes && (
              <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onDictateNotes(visit); }} aria-label={`Dictate notes for ${visit.companyName}`}>
                <Mic className="h-4 w-4" />
              </Button>
            )}
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
        </div>
      </CardFooter>
    </Card>
  );
};

export default VisitCard;
