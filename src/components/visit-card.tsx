
'use client';

import type { Visit } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, CalendarDays, Edit, FileText, Info, Loader2, MapPin, Sparkles, Star, Trash2, CheckSquare, Square, Swords, Box, ShieldAlert, Hash, PackageCheck, Droplets, AlertTriangle, CheckCircle2, ShieldQuestion, Wind, CalendarCheck, CalendarX, FileType, CalendarClock, Contact, PlusSquare, Mic, Navigation } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';
import { summarizeNotesAction } from '@/app/actions';
import { useState } from 'react';
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
    if (tds <= 50) return { message: "Optimum Water Quality. Ideal for RO/DI.", icon: <CheckCircle2 className="mr-1 h-3 w-3" />, className: "bg-green-500 hover:bg-green-600 text-white border-green-600" };
    if (tds > 50 && tds <= 100) return { message: "High Quality Bottled Water.", icon: <CheckCircle2 className="mr-1 h-3 w-3" />, className: "bg-blue-500 hover:bg-blue-600 text-white border-blue-600" };
    if (tds > 100 && tds <= 150) return { message: "Spring Water.", icon: <Wind className="mr-1 h-3 w-3" /> , className: "bg-sky-500 hover:bg-sky-600 text-white border-sky-600" };
    if (tds > 150 && tds <= 275) return { message: "Marginally Acceptable Water.", icon: <AlertTriangle className="mr-1 h-3 w-3" />, className: "text-yellow-700 border-yellow-500 bg-yellow-50 hover:bg-yellow-100 dark:text-yellow-400 dark:border-yellow-600 dark:bg-yellow-900/30 dark:hover:bg-yellow-900/50" };
    if (tds > 275 && tds <= 500) return { message: "HIGH TDS Water (Tap/Mineral Spring).", icon: <AlertTriangle className="mr-1 h-3 w-3" />, className: "text-orange-700 border-orange-500 bg-orange-50 hover:bg-orange-100 dark:text-orange-400 dark:border-orange-600 dark:bg-orange-900/30 dark:hover:bg-orange-900/50" };
    if (tds > 500) return {
      message: (
        <div className="text-left text-xs w-full">
          <p className="font-semibold uppercase text-center text-base">Warning!!!!!!</p>
          <p className="font-semibold uppercase text-center text-xs">EPA Maximum Contaminant Level Exceeded</p>
          <p className="font-medium text-center">({tds} PPM)</p>
          <ul className="list-disc list-outside mt-1 space-y-0.5 pl-4">
            <li>Salesperson must inform about potential for more service calls (approx. $149 each).</li>
            <li>Techs may need to install a pre-filter.</li>
          </ul>
        </div>
      ),
      icon: <ShieldAlert className="mr-1 h-4 w-4" />, className: "items-start bg-destructive text-destructive-foreground"
    };
    return { message: "TDS Level Undefined.", icon: <ShieldQuestion className="mr-1 h-3 w-3" />, className: "text-gray-700 border-gray-500 bg-gray-50 hover:bg-gray-100 dark:text-gray-400 dark:border-gray-600 dark:bg-gray-900/30 dark:hover:bg-gray-900/50" };
  };

  const tdsInfo = getTDSInfo();
  const isHtmlCard = visit.businessCardImageUrl?.trim().startsWith('<!DOCTYPE html>');
  
  if (variant === 'planner' && !isZoomedView) {
    return (
      <Card
        className={cn(
          "flex flex-col h-full shadow-xl hover:shadow-2xl transition-shadow duration-300 bg-card border-2",
          'border-orange-500 shadow-lg shadow-orange-500/20',
          'cursor-pointer'
        )}
        onClick={() => onZoom?.(visit)}
      >
        <CardHeader className="p-3">
          <CardTitle className="font-headline text-lg flex items-start">
            <Building2 className="mr-2 h-4 w-4 shrink-0 mt-1" />
            {visit.companyName}
          </CardTitle>
          {visit.futureMeetingDateTime && (
              <Badge variant="secondary" className="mt-1 w-fit">
                <CalendarClock className="mr-2 h-3 w-3"/>
                {formatInTimeZone(new Date(visit.futureMeetingDateTime), timeZone, 'MMM d, h:mm a')}
              </Badge>
          )}
        </CardHeader>
        <CardContent className="p-3 pt-0 flex-grow">
          <div className="text-sm text-muted-foreground bg-muted p-2 rounded-md whitespace-pre-wrap h-full">
            {visit.notes || 'No notes for this visit.'}
          </div>
        </CardContent>
        <CardFooter className="flex justify-between items-center gap-2 border-t pt-2 mt-auto p-3">
            {visit.latitude && visit.longitude ? (
              <Button
                variant="default"
                size="sm"
                className="h-8 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(`https://www.google.com/maps/dir/?api=1&destination=${visit.latitude},${visit.longitude}`, '_blank', 'noopener,noreferrer');
                }}
                aria-label={`Navigate to ${visit.companyName}`}
              >
                <Navigation className="mr-1 h-3 w-3" />
                Navigate
              </Button>
            ) : <div />}
            <div className="flex justify-end items-center gap-2">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); onEdit(visit); }} aria-label={`Edit visit to ${visit.companyName}`}>
                  <Edit className="h-4 w-4" />
                </Button>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()} aria-label={`Delete visit to ${visit.companyName}`}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>This action will permanently delete the visit log for {visit.companyName}.</AlertDialogDescription>
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
  }

  return (
    <Card 
      className={cn(
        "flex flex-col h-full shadow-xl hover:shadow-2xl transition-shadow duration-300 bg-card border-2",
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
        <div className="flex justify-between items-start gap-4">
            <div className="space-y-1.5 min-w-0 flex-1">
                <div 
                    className="flex items-center gap-2 cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); setIsCoordsVisible(p => !p); }}
                >
                    <CardTitle className="font-headline text-xl text-accent-foreground flex-1 break-words">{visit.companyName}</CardTitle>
                </div>
                {isCoordsVisible && visit.latitude && visit.longitude && (
                    <p className="text-xs text-muted-foreground flex items-center justify-start w-full">
                        <MapPin className="mr-1 h-3 w-3" /> Lat: {visit.latitude.toFixed(4)}, Lng: {visit.longitude.toFixed(4)}
                    </p>
                )}
            </div>
            {visit.visitNumber && (
                <Badge variant="secondary" className="text-base font-semibold px-2 py-1 shrink-0">
                    <Hash className="mr-1 h-4 w-4" />{visit.visitNumber}
                </Badge>
            )}
        </div>
        
        {visit.partnershipConfidence && visit.partnershipConfidence > 0 && (
            <div className="flex flex-col items-start mt-2">
            <div className="flex">
                {[1, 2, 3, 4, 5].map((starValue) => (
                <Star
                    key={starValue}
                    className={cn("h-5 w-5", starValue <= (visit.partnershipConfidence ?? 0) ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/50")}
                />
                ))}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">Partnership Confidence</div>
            </div>
        )}
      </CardHeader>

      <CardContent className="flex-grow p-4 pt-0 overflow-y-auto">
        {isZoomedView ? (
          <Accordion type="multiple" value={openAccordionItems} onValueChange={setOpenAccordionItems} className="w-full space-y-2">
            {/* Future Meeting */}
            {visit.futureMeetingSet && visit.futureMeetingDateTime && (
              <AccordionItem value="future-meeting">
                <AccordionTrigger className="text-base font-semibold text-primary hover:no-underline">
                  <CalendarClock className="mr-2 h-5 w-5" /> Future Meeting
                </AccordionTrigger>
                <AccordionContent className="bg-muted p-3 rounded-md">
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
                <AccordionContent className="bg-muted p-3 rounded-md space-y-3">
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
                <AccordionContent className="space-y-2 text-sm bg-muted p-3 rounded-md">
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
                <AccordionContent className="space-y-2 text-sm bg-muted p-3 rounded-md">
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
                <AccordionContent className="bg-muted p-3 rounded-md">
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
                        className="rounded-md border bg-background"
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
                <AccordionContent className="bg-muted p-3 rounded-md">
                  <Badge variant={tdsInfo.className.includes('bg-destructive') ? 'destructive' : 'default'} className={cn("text-sm h-auto whitespace-normal text-left w-full justify-start", tdsInfo.className)}>
                    <div className="flex items-start p-1 w-full">
                      <span className="shrink-0 mt-0.5 mr-2">{tdsInfo.icon}</span>
                      <span className="flex-1">{tdsInfo.message}</span>
                    </div>
                  </Badge>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Free Trial */}
            {visit.freeTrial && (
              <AccordionItem value="free-trial">
                <AccordionTrigger className="text-base font-semibold text-primary hover:no-underline">
                  <PackageCheck className="mr-2 h-5 w-5" /> Free Trial Details
                </AccordionTrigger>
                <AccordionContent className="space-y-2 text-sm bg-muted p-3 rounded-md">
                  <p><strong>Status:</strong> A free trial was set up.</p>
                  {visit.freeTrialStartDate && (
                    <p>
                      <strong>Start Date:</strong>{' '}
                      <span className="font-semibold text-foreground">
                        {formatInTimeZone(new Date(visit.freeTrialStartDate), timeZone, 'eeee, MMMM d, yyyy')}
                      </span>
                    </p>
                  )}
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        ) : (
          <div className="space-y-3">
             <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-muted-foreground pt-2">
                <div className="flex items-center">
                    {visit.hasBusinessCard ? <CheckSquare className="mr-2 h-4 w-4 text-green-500" /> : <Square className="mr-2 h-4 w-4 text-muted-foreground/50" />}
                    Business Card
                </div>
                <div className="flex items-center">
                    {visit.hasTDSReading ? <CheckSquare className="mr-2 h-4 w-4 text-green-500" /> : <Square className="mr-2 h-4 w-4 text-muted-foreground/50" />}
                    TDS Reading
                </div>
                <div className="flex items-center">
                    {visit.futureMeetingSet ? <CalendarCheck className="mr-2 h-4 w-4 text-green-500" /> : <CalendarX className="mr-2 h-4 w-4 text-muted-foreground/50" />}
                    Future Meeting
                </div>
                <div className="flex items-center">
                    {visit.freeTrial ? <CheckSquare className="mr-2 h-4 w-4 text-green-500" /> : <Square className="mr-2 h-4 w-4 text-muted-foreground/50" />}
                    Free Trial
                </div>
            </div>
            {visit.notesSummary && (
                <div className="pt-2">
                    <h4 className="font-semibold text-xs mb-1 flex items-center text-primary">
                        <Sparkles className="h-3 w-3 mr-1.5" />
                        AI Summary
                    </h4>
                    <p className="text-sm text-foreground bg-muted p-2 rounded-md whitespace-pre-wrap">{visit.notesSummary}</p>
                </div>
            )}
          </div>
        )}
      </CardContent>

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
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); onDictateNotes(visit); }} aria-label={`Dictate notes for ${visit.companyName}`}>
                <Mic className="h-4 w-4" />
              </Button>
            )}
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); onEdit(visit); }} aria-label={`Edit visit to ${visit.companyName}`}>
              <Edit className="h-4 w-4" />
            </Button>
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()} aria-label={`Delete visit to ${visit.companyName}`}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>This action will permanently delete the visit log for {visit.companyName}.</AlertDialogDescription>
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
