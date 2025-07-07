
'use client';

import type { Visit } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarDays, Edit, FileText, Info, Loader2, Sparkles, Star, Trash2, CheckSquare, Square, Swords, Box, ShieldAlert, Hash, PackageCheck, Droplets, AlertTriangle, CheckCircle2, ShieldQuestion, Wind, CalendarCheck, CalendarX, FileType, CalendarClock, Contact, PlusSquare, Mic, Navigation, MapPin, LocateFixed, DollarSign } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';
import { summarizeNotesAction } from '@/app/actions';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import NextImage from 'next/image';
import { COMPETITOR_DETAILS } from '@/lib/competitor-details';
import { Separator } from './ui/separator';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from './ui/scroll-area';

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
  const [showLocation, setShowLocation] = useState(false);
  const timeZone = 'America/New_York';
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
  const hasDecisionMakerDetails = visit.decisionMakerName || visit.decisionMakerTitle || visit.decisionMakerContact || (visit.contactInfo?.info && visit.contactInfo.info !== "No contact info found on web!");
  const potentialCommission = (() => {
    if (!visit.pricingDiscussed) return null;
    const leaseCommission = (visit.priceQuoted && visit.leaseTerm) ? (visit.priceQuoted * (visit.leaseTerm / 12)) : 0;
    const installCommission = visit.installationFee ? (visit.installationFee / 2) : 0;
    const total = leaseCommission + installCommission;
    return total > 0 ? total : null;
  })();

  const ZoomedContent = () => (
    <ScrollArea className="h-96 pr-4">
        <div className="space-y-4 text-sm">
            <div>
                <h4 className="font-semibold text-primary flex items-center mb-1"><CalendarDays className="mr-2 h-4 w-4" />Timestamp</h4>
                <p className="pl-6 text-muted-foreground">{formatInTimeZone(new Date(visit.timestamp), timeZone, 'PPPp')}</p>
            </div>

            {visit.notes && (
                <div>
                    <h4 className="font-semibold text-primary flex items-center mb-1"><FileText className="mr-2 h-4 w-4" />Visit Notes</h4>
                    <p className="pl-6 whitespace-pre-wrap bg-muted p-2 rounded-md">{visit.notes}</p>
                </div>
            )}
            
            {visit.notesSummary && (
                <div>
                    <h4 className="font-semibold text-primary flex items-center mb-1"><Sparkles className="mr-2 h-4 w-4" />AI Summary</h4>
                    <p className="pl-6 whitespace-pre-wrap bg-muted p-2 rounded-md">{visit.notesSummary}</p>
                    <Button variant="ghost" size="sm" onClick={handleSummarizeAgain} disabled={isSummarizing} className="mt-2 text-primary hover:bg-primary/10 h-auto py-1 px-2 text-xs">
                        {isSummarizing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}
                        Re-summarize
                    </Button>
                </div>
            )}

            {(hasDecisionMakerDetails || visit.businessCardImageUrl) && <Separator />}

            {hasDecisionMakerDetails && (
                <div>
                    <h4 className="font-semibold text-primary flex items-center mb-1"><Contact className="mr-2 h-4 w-4" />Decision Maker Info</h4>
                    <div className="pl-6 space-y-1">
                        {visit.decisionMakerName && <p><strong>Name:</strong> {visit.decisionMakerName}</p>}
                        {visit.decisionMakerTitle && <p><strong>Title:</strong> {visit.decisionMakerTitle}</p>}
                        {visit.decisionMakerContact && <p><strong>Contact:</strong> {visit.decisionMakerContact}</p>}
                        {visit.contactInfo?.info && visit.contactInfo.info !== "No contact info found on web!" && (
                        <div className="pt-2 border-t mt-2">
                            <p><strong>Scraped Info:</strong> {visit.contactInfo.info}</p>
                            <p className="text-xs text-muted-foreground"><strong>Confidence:</strong> {Math.round(visit.contactInfo.confidence * 100)}%</p>
                        </div>
                        )}
                    </div>
                </div>
            )}
            
            {visit.businessCardImageUrl && (
                <div>
                    <h4 className="font-semibold text-primary flex items-center mb-1"><FileType className="mr-2 h-4 w-4" />Business Card</h4>
                    <div className="pl-6">
                        {isHtmlCard ? (
                             <div className="text-sm text-destructive-foreground bg-destructive p-3 rounded-md">
                                <p>Cannot display business card. The saved data is invalid. Please try re-uploading the image.</p>
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
                    </div>
                </div>
            )}

            {(visit.discussedCompetitors || visit.hasTDSReading || visit.freeTrial || visit.futureMeetingSet || visit.pricingDiscussed || visit.creditApproved) && <Separator />}

            {visit.discussedCompetitors && (
                <div>
                    <h4 className="font-semibold text-primary flex items-center mb-1"><Swords className="mr-2 h-4 w-4" />Competitor Info</h4>
                    <div className="pl-6 space-y-1">
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
                    </div>
                </div>
            )}

            {(visit.pricingDiscussed || visit.creditApproved) && (
                <div>
                    <h4 className="font-semibold text-primary flex items-center mb-1"><DollarSign className="mr-2 h-4 w-4" />Pricing</h4>
                    <div className="pl-6 space-y-1">
                        {visit.pricingDiscussed && (
                            <p>
                                <strong>Pricing:</strong>
                                {visit.priceQuoted && visit.leaseTerm 
                                    ? ` Quoted $${visit.priceQuoted.toFixed(2)}/mo for ${visit.leaseTerm} months`
                                    : " Discussed"
                                }
                            </p>
                        )}
                        {visit.installationFee && <p><strong>Installation Fee:</strong> ${visit.installationFee.toFixed(2)}</p>}
                        {visit.creditApproved && <p><strong>Credit:</strong> Approved for financing.</p>}
                    </div>
                </div>
            )}
            
            {tdsInfo && (
                <div>
                    <h4 className="font-semibold text-primary flex items-center mb-1"><Droplets className="mr-2 h-4 w-4" />TDS Reading</h4>
                    <div className="pl-6">
                        <Badge variant={tdsInfo.className.includes('bg-destructive') ? 'destructive' : 'default'} className={cn("text-sm h-auto whitespace-normal text-left w-full justify-start", tdsInfo.className)}>
                            <div className="flex items-start p-1 w-full">
                            <span className="shrink-0 mt-0.5 mr-2">{tdsInfo.icon}</span>
                            <span className="flex-1">{tdsInfo.message}</span>
                            </div>
                        </Badge>
                    </div>
                </div>
            )}

            {visit.freeTrial && (
                 <div>
                    <h4 className="font-semibold text-primary flex items-center mb-1"><PackageCheck className="mr-2 h-4 w-4" />Free Trial</h4>
                    <div className="pl-6 space-y-1">
                        <p><strong>Status:</strong> A free trial was set up.</p>
                        {visit.freeTrialStartDate && (
                            <p><strong>Start Date:</strong>{' '}
                                <span className="font-semibold text-foreground">
                                    {formatInTimeZone(new Date(visit.freeTrialStartDate), timeZone, 'PPP')}
                                </span>
                            </p>
                        )}
                    </div>
                </div>
            )}

             {visit.futureMeetingSet && (
                 <div>
                    <h4 className="font-semibold text-primary flex items-center mb-1"><CalendarClock className="mr-2 h-4 w-4" />Future Meeting</h4>
                     <div className="pl-6">
                        {visit.futureMeetingDateTime ? (
                            <p>Scheduled for: <span className="font-semibold">{formatInTimeZone(new Date(visit.futureMeetingDateTime), timeZone, 'PPPp')}</span></p>
                        ) : (
                            <p>A future meeting is planned but not yet scheduled.</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    </ScrollArea>
  );

  const NormalContent = () => (
    <div className="space-y-1">
        <div className="grid grid-cols-2 gap-y-2 text-sm text-muted-foreground">
            <div className="flex items-center h-6">
                {visit.hasBusinessCard ? <CheckSquare className="mr-2 h-4 w-4 text-green-500" /> : <Square className="mr-2 h-4 w-4 text-muted-foreground/50" />}
                Business Card
            </div>
            <div className="flex items-center h-6">
                {visit.futureMeetingSet ? <CalendarCheck className="mr-2 h-4 w-4 text-green-500" /> : <CalendarX className="mr-2 h-4 w-4 text-muted-foreground/50" />}
                Future Meeting
            </div>
            <div className="flex items-center h-6">
                {visit.hasTDSReading ? <CheckSquare className="mr-2 h-4 w-4 text-green-500" /> : <Square className="mr-2 h-4 w-4 text-muted-foreground/50" />}
                TDS Reading
            </div>
            <div className="flex items-center h-6">
                {visit.freeTrial ? <CheckSquare className="mr-2 h-4 w-4 text-green-500" /> : <Square className="mr-2 h-4 w-4 text-muted-foreground/50" />}
                Free Trial
            </div>
            <div className="flex items-center h-6">
                {visit.pricingDiscussed ? <CheckSquare className="mr-2 h-4 w-4 text-green-500" /> : <Square className="mr-2 h-4 w-4 text-muted-foreground/50" />}
                Pricing
            </div>
            <div className="flex items-center h-6">
                {visit.creditApproved ? <CheckSquare className="mr-2 h-4 w-4 text-green-500" /> : <Square className="mr-2 h-4 w-4 text-muted-foreground/50" />}
                Credit Approved
            </div>
        </div>
        {visit.notesSummary && (
            <div className="pt-2">
                <h4 className="font-semibold text-xs mb-1 flex items-center text-primary">
                    <Sparkles className="h-3 w-3 mr-1.5" />
                    AI Summary
                </h4>
                <p className="text-sm text-foreground bg-muted p-2 rounded-md whitespace-pre-wrap line-clamp-3">{visit.notesSummary}</p>
            </div>
        )}
    </div>
  );

  return (
    <Card 
      className={cn(
        "flex flex-col shadow-lg hover:shadow-xl transition-shadow duration-300 bg-card border-2",
        variant === 'planner' 
          ? 'border-orange-500 shadow-orange-500/20' 
          : visit.dealClosed 
            ? 'border-green-500' 
            : 'border-sky-500',
        !isZoomedView && 'cursor-pointer'
      )}
      onClick={!isZoomedView ? () => onZoom?.(visit) : undefined}
    >
      <CardHeader className="pb-3 relative">
          <div className="absolute top-2 left-2 flex flex-col items-start">
              <div className="text-xs text-muted-foreground mb-0.5">Partnership Confidence</div>
              <div className="flex">
                  {[1, 2, 3, 4, 5].map((starValue) => (
                      <Star
                          key={starValue}
                          className={cn("h-5 w-5 cursor-pointer transition-colors", starValue <= (visit.partnershipConfidence ?? 0) ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/50")}
                      />
                  ))}
              </div>
          </div>

          <div className="flex flex-col items-center justify-center w-full pt-12">
              <div className="flex items-center gap-4 text-sm font-medium mb-1">
                {visit.interestedUnit && (
                  <div className="text-blue-400">
                    {`{${visit.interestedUnit.split('(')[0].trim()}}`}
                  </div>
                )}
                {potentialCommission !== null && (
                    <div className="flex items-center text-green-400" title={`Potential Commission: $${potentialCommission.toFixed(2)}`}>
                        <DollarSign className="h-4 w-4" />
                        {potentialCommission.toFixed(2)}
                    </div>
                )}
              </div>
              <CardTitle 
                className="font-headline text-3xl text-accent-foreground text-center break-words cursor-pointer hover:text-primary transition-colors"
                onClick={(e) => {
                  if (!isZoomedView) e.stopPropagation();
                  setShowLocation(!showLocation);
                }}
              >
                {visit.companyName}
              </CardTitle>
              {visit.city && <CardDescription className="text-sm -mt-1">{visit.city}</CardDescription>}
              <CardDescription className="text-xs pt-1 text-center">
                  {formatInTimeZone(new Date(visit.timestamp), timeZone, 'PPPp')}
              </CardDescription>
              <div className="text-xs pt-1 text-center h-5">
                  {showLocation && visit.latitude && visit.longitude && (
                      <div className="flex items-center justify-center animate-in fade-in">
                          <LocateFixed className="mr-2 h-3 w-3" />
                          {visit.latitude.toFixed(4)}, {visit.longitude.toFixed(4)}
                      </div>
                  )}
              </div>
          </div>
      </CardHeader>

      <CardContent className="flex-grow p-4 pt-0 overflow-y-auto">
        {isZoomedView ? <ZoomedContent /> : <NormalContent />}
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
            {onLogFollowUp && isZoomedView && (
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); onLogFollowUp(visit); }} aria-label={`Log follow-up for ${visit.companyName}`}>
                <PlusSquare className="h-4 w-4" />
              </Button>
            )}
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
