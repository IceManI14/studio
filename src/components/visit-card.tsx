
'use client';

import type { Visit } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, CalendarDays, Edit, FileText, Info, Loader2, MapPin, Sparkles, Star, Trash2, CheckSquare, Square, Swords, UserCircle, Box, ShieldAlert, Image as ImageIcon, Hash, PackageCheck, Droplets, AlertTriangle, CheckCircle2, ShieldQuestion, Wind, CalendarCheck, CalendarX, CalendarIcon } from 'lucide-react';
import { format, formatInTimeZone } from 'date-fns-tz';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';
import { summarizeVisitNotes } from '@/ai/flows/summarize-visit-notes';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import NextImage from 'next/image'; // Renamed to avoid conflict with lucide-react Image icon
import { COMPETITOR_DETAILS } from '@/lib/competitor-details';

interface VisitCardProps {
  visit: Visit;
  onEdit: (visit: Visit) => void;
  onDelete: (visitId: string) => void;
  onUpdateVisit: (updatedVisit: Visit) => void;
}

const VisitCard: React.FC<VisitCardProps> = ({ visit, onEdit, onDelete, onUpdateVisit }) => {
  const [isSummarizing, setIsSummarizing] = useState(false);
  const { toast } = useToast();
  const timeZone = 'America/New_York'; // For EST/EDT

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

  const getCompetitorDisplay = () => {
    if (visit.discussedCompetitors) {
      if (visit.competitorName) {
        return <>Competitor <span className="text-accent">{`{${visit.competitorName}}`}</span></>;
      }
      return 'Competitors Discussed (Unspecified)';
    }
    return 'Competitors Not Discussed';
  };

  const hasDecisionMakerInfo = visit.decisionMakerName || visit.decisionMakerTitle || visit.decisionMakerContact;

  const getStarRatingBadgeInfo = () => {
    const pConfidence = visit.partnershipConfidence ?? 0;
    let text = "Not Rated";
    let variant: "default" | "outline" | "secondary" = "secondary";

    if (pConfidence >= 1 && pConfidence <= 5) {
      text = `${pConfidence} Star${pConfidence > 1 ? 's' : ''}`;
      if (pConfidence >= 4) {
        variant = "default";
      } else if (pConfidence === 3) {
        variant = "outline";
      } else {
        variant = "secondary";
      }
    }
    return { text, variant };
  };

  const starRatingBadge = getStarRatingBadgeInfo();

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


  return (
    <Card className="flex flex-col shadow-lg hover:shadow-xl transition-shadow duration-300">
      <CardHeader>
        {/* Centered Top Section for Confidence */}
        <div className="flex flex-col items-center w-full mb-3">
          <div className="flex justify-center items-center gap-2 flex-wrap mb-1">
            {visit.visitNumber && (
              <Badge variant="outline" className="text-sm font-semibold px-1.5 py-0.5">
                <Hash className="mr-1 h-3 w-3" />{visit.visitNumber}
              </Badge>
            )}
            {visit.partnershipConfidence && visit.partnershipConfidence > 0 && (
              <span className="text-xs text-muted-foreground">(Partnership Confidence)</span>
            )}
            {visit.partnershipConfidence && visit.partnershipConfidence > 0 && (
              <Badge variant={starRatingBadge.variant} className="whitespace-nowrap">
                {starRatingBadge.text}
              </Badge>
            )}
          </div>

          {visit.partnershipConfidence && visit.partnershipConfidence > 0 && (
            <div className="flex justify-center items-center mt-1">
              {[1, 2, 3, 4, 5].map((starValue) => (
                <Star
                  key={starValue}
                  className={cn(
                    "h-5 w-5", // Star icons
                    starValue <= (visit.partnershipConfidence ?? 0)
                      ? "text-yellow-400 fill-yellow-400"
                      : "text-muted-foreground/50"
                  )}
                />
              ))}
            </div>
          )}
        </div>

        {/* Company Info and Timestamp */}
        <div className="flex-grow space-y-1">
            <div className="flex justify-between items-baseline">
                <CardTitle className="font-headline text-xl text-primary flex items-center">
                    <Building2 className="mr-2 h-5 w-5" /> {visit.companyName}
                </CardTitle>
                {visit.latitude && visit.longitude && (
                    <p className="text-xs text-muted-foreground flex items-center ml-2 whitespace-nowrap">
                        <MapPin className="mr-1 h-3 w-3" /> Lat: {visit.latitude.toFixed(4)}, Lng: {visit.longitude.toFixed(4)}
                    </p>
                )}
            </div>
            <div className="flex items-center text-sm text-muted-foreground">
                <CalendarDays className="mr-2 h-3 w-3" />
                {formatInTimeZone(new Date(visit.timestamp), timeZone, 'MMM d, yyyy, h:mm a')}
            </div>
        </div>

        {/* Other Details Section */}
        <div className="flex flex-col space-y-1 mt-2">
          <div className="flex items-center text-xs text-muted-foreground">
            {visit.discussedCompetitors ? <Swords className="mr-2 h-4 w-4 text-orange-500" /> : <Square className="mr-2 h-4 w-4 text-muted-foreground/50" />}
            {getCompetitorDisplay()}
          </div>
          {visit.coolerType && visit.discussedCompetitors && (
            <div className="flex items-center text-xs text-muted-foreground">
                <Box className="mr-2 h-4 w-4 text-blue-500" />
                Cooler: {visit.coolerType}
            </div>
          )}
          <div className="flex items-center text-xs text-muted-foreground">
            {visit.hasBusinessCard ? <CheckSquare className="mr-2 h-4 w-4 text-green-500" /> : <Square className="mr-2 h-4 w-4 text-muted-foreground/50" />}
            Business Card: {visit.hasBusinessCard ? 'Yes' : 'No'}
          </div>
          <div className="flex items-center text-xs text-muted-foreground">
            {visit.hasTDSReading ? <CheckSquare className="mr-2 h-4 w-4 text-green-500" /> : <Square className="mr-2 h-4 w-4 text-muted-foreground/50" />}
            TDS Reading: {visit.hasTDSReading ? (visit.tdsValue !== undefined ? `Value Logged` : 'Yes (No Value)') : 'Not Yet'}
          </div>
           <div className="flex items-center text-xs text-muted-foreground">
            {visit.futureMeetingSet ? <CalendarCheck className="mr-2 h-4 w-4 text-green-500" /> : <CalendarX className="mr-2 h-4 w-4 text-muted-foreground/50" />}
            Future Meeting Set: {visit.futureMeetingSet ? 'Yes' : 'No'}
            {visit.futureMeetingSet && visit.futureMeetingDate && (
              <span className="ml-1 flex items-center text-green-600 dark:text-green-400">
                 (<CalendarIcon className="h-3 w-3 mr-1" /> {format(new Date(visit.futureMeetingDate), 'MMM d, yyyy')})
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-grow space-y-3 text-sm">
        {visit.businessCardImageUrl && visit.hasBusinessCard && (
          <div className="p-3 bg-secondary/30 rounded-md">
            <h4 className="font-medium text-foreground flex items-center mb-1">
              <ImageIcon className="mr-2 h-4 w-4 text-primary" /> Business Card
            </h4>
            <div className="relative w-full aspect-[1.6/1] max-w-xs mx-auto mt-2">
              <NextImage
                src={visit.businessCardImageUrl}
                alt="Business Card"
                layout="fill"
                objectFit="contain"
                className="rounded-md border"
              />
            </div>
          </div>
        )}

        {visit.hasTDSReading && visit.tdsValue !== undefined && (
           <div className="p-2 bg-secondary/30 rounded-md text-center">
            <div className="flex justify-center items-center space-x-2 mb-1">
              <h4 className="font-medium text-foreground flex items-center">
                <Droplets className="mr-2 h-4 w-4 text-primary" /> TDS Reading Analysis
              </h4>
              <p className="text-muted-foreground font-semibold">{visit.tdsValue} PPM</p>
            </div>
            {tdsInfo && (
              <Badge
                variant={tdsInfo.variant}
                className={cn(
                  "text-xs mt-1 whitespace-normal h-auto py-1 px-1.5 inline-flex", 
                  typeof tdsInfo.message === 'string' ? "items-center" : "items-start", 
                  tdsInfo.className
                )}
              >
                {tdsInfo.icon}
                <span className="ml-1">{tdsInfo.message}</span>
              </Badge>
            )}
          </div>
        )}

        {visit.contactInfo?.info && (
          <div className="p-3 bg-secondary/30 rounded-md">
            <h4 className="font-medium text-foreground flex items-center mb-1">
              <Info className="mr-2 h-4 w-4 text-primary" /> Contact Info
            </h4>
            <p className="text-muted-foreground whitespace-pre-wrap break-words">{visit.contactInfo.info}</p>
          </div>
        )}

        {hasDecisionMakerInfo && (
          <div className="p-3 bg-secondary/30 rounded-md">
            <h4 className="font-medium text-foreground flex items-center mb-1">
              <UserCircle className="mr-2 h-4 w-4 text-primary" /> Decision Maker
            </h4>
            {visit.decisionMakerName && <p className="text-muted-foreground"><strong>Name:</strong> {visit.decisionMakerName}</p>}
            {visit.decisionMakerTitle && <p className="text-muted-foreground"><strong>Title:</strong> {visit.decisionMakerTitle}</p>}
            {visit.decisionMakerContact && <p className="text-muted-foreground"><strong>Contact:</strong> {visit.decisionMakerContact}</p>}
          </div>
        )}

        {visit.interestedUnit && (
          <div className="p-3 bg-green-500/10 rounded-md border border-green-500/30">
            <h4 className="font-medium text-green-700 dark:text-green-400 flex items-center mb-1">
              <PackageCheck className="mr-2 h-4 w-4" /> Potential Unit Interest
            </h4>
            <p className="text-green-600 dark:text-green-300">{visit.interestedUnit}</p>
          </div>
        )}

        {visit.notes && (
           <div className="p-3 bg-secondary/30 rounded-md">
            <h4 className="font-medium text-foreground flex items-center mb-1">
              <FileText className="mr-2 h-4 w-4 text-primary" /> Original Notes
            </h4>
            <p className="text-muted-foreground max-h-20 overflow-y-auto whitespace-pre-wrap break-words">{visit.notes}</p>
          </div>
        )}

        {visit.discussedCompetitors && visit.competitorName && COMPETITOR_DETAILS[visit.competitorName] && (
          <div className="p-3 bg-secondary/30 rounded-md">
            <h4 className="font-medium text-foreground flex items-center mb-1">
              <ShieldAlert className="mr-2 h-4 w-4 text-primary" />
              Competitor Intel <span className="text-accent">{`{${visit.competitorName}}`}</span>
            </h4>
            {COMPETITOR_DETAILS[visit.competitorName].title && (
                <p className="text-sm text-muted-foreground italic mb-1">{COMPETITOR_DETAILS[visit.competitorName].title}</p>
            )}
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5 text-xs">
              {COMPETITOR_DETAILS[visit.competitorName].details.map((detail, index) => (
                <li key={index}>{detail}</li>
              ))}
            </ul>
          </div>
        )}

        {visit.notesSummary && (
          <div className="p-3 bg-secondary/30 rounded-md">
            <h4 className="font-medium text-foreground flex items-center mb-1">
              <Sparkles className="mr-2 h-4 w-4" /> Notes Summary
            </h4>
            <p className="text-muted-foreground whitespace-pre-wrap break-words">{visit.notesSummary}</p>
          </div>
        )}
        {!visit.notesSummary && visit.notes && (
          <Button variant="link" size="sm" onClick={handleSummarizeAgain} disabled={isSummarizing} className="text-accent p-0 h-auto">
            {isSummarizing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {isSummarizing ? 'Summarizing...' : 'Summarize Notes'}
          </Button>
        )}

      </CardContent>
      <CardFooter className="flex justify-end gap-2 border-t pt-4">
        <Button variant="outline" size="sm" onClick={() => onEdit(visit)} aria-label={`Edit visit to ${visit.companyName}`}>
          <Edit className="h-4 w-4" />
        </Button>
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" aria-label={`Delete visit to ${visit.companyName}`}>
                    <Trash2 className="h-4 w-4" />
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
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
