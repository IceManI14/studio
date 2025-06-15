
'use client';

import type { Visit } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, CalendarDays, Edit, FileText, Info, Loader2, MapPin, Sparkles, Star, Trash2, CheckSquare, Square, Swords, UserCircle, Box, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';
import { summarizeVisitNotes } from '@/ai/flows/summarize-visit-notes';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface VisitCardProps {
  visit: Visit;
  onEdit: (visit: Visit) => void;
  onDelete: (visitId: string) => void;
  onUpdateVisit: (updatedVisit: Visit) => void;
}

const COMPETITOR_DETAILS: Record<string, { title?: string; details: string[] }> = {
  "Quench": {
    details: [
      "Filtration only",
      "Terrible Service",
      "Offer R/O",
      "Pricing: $45-$80 for Hot/Cold (qty dependent)",
      "Offer Ice and water units",
      "Owns BEVI ($350/month per unit)",
      "Acquired: Waterlogic, Blue Reserve, Eastern Pure, Stonybrook",
      "Similar contracts to Optimum"
    ]
  },
  "Atlantic Pure": {
    title: "Mostly Rhode Island and Southern MA",
    details: [
      "Wellsys dealer",
      "Brand new company",
      "Sometimes Ultra Filtration instead of RO in W9",
      "Pricing: $49-$69 per unit",
      "Offer Ice and water",
      "Contracts: Same as Optimum, use Pure Water"
    ]
  },
  "Boston Bean": {
    title: "Coffee Company",
    details: [
      "Filtration only",
      "Offer Alpine coolers and occasional ION",
      "NO RO",
      "Pricing: $40-$80 (qty dependent)",
      "Offers BEVI"
    ]
  },
  "Ready Refresh/Primo": {
    details: [
      "5 Gallon Bottles and Filtration",
      "Bottled Brands: Nestle Pure Life, Poland Spring, Crystal Rock, Primo, Vermont Pure",
      "Filtration Line: Accupure",
      "Terrible service",
      "Rarely offer RO",
      "Cleaning Fee: $95 (recommended every 3 months, often charged unknowingly)",
      "Filtration Cost: $40-$50",
      "Bottle Pricing: $10-$15 (State contract: $4.75-$5.00/bottle + $10 delivery)"
    ]
  },
  "WB Mason": {
    title: "Paper company that offers water",
    details: [
      "5 gallons and filtration",
      "Bottled Brands: Blizzard water or Poland Spring",
      "Bottle Price: $5-$13",
      "Filtration Pricing: $25-$50",
      "Don’t offer RO"
    ]
  },
  "Cintas": {
    title: "Uniform company that offers water",
    details: [
      "Filtration only",
      "Pricing: $35-$60",
      "Don’t offer RO"
    ]
  },
  "Aramark": {
    details: [
      "Filtration only",
      "Pricing: $40-$80",
      "Charge for Filter changes (cost unknown)",
      "Don’t Offer RO"
    ]
  },
  "Other": {
    details: ["Details for this competitor are not pre-defined. Add specific notes if available."]
  }
};


const VisitCard: React.FC<VisitCardProps> = ({ visit, onEdit, onDelete, onUpdateVisit }) => {
  const [isSummarizing, setIsSummarizing] = useState(false);
  const { toast } = useToast();

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
        return `Competitor: ${visit.competitorName}`;
      }
      return 'Competitors: Discussed (Unspecified)';
    }
    return 'Competitors: Not Discussed';
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

  return (
    <Card className="flex flex-col shadow-lg hover:shadow-xl transition-shadow duration-300">
      <CardHeader>
        <div className="flex justify-between items-start">
            <CardTitle className="font-headline text-xl text-primary flex items-center">
                <Building2 className="mr-2 h-5 w-5" /> {visit.companyName}
            </CardTitle>
            <Badge variant={starRatingBadge.variant} className="ml-2 whitespace-nowrap">
                {starRatingBadge.text}
            </Badge>
        </div>
        <div className="flex flex-col space-y-1 mt-1">
          {visit.partnershipConfidence && visit.partnershipConfidence > 0 && (
            <div className="flex items-center">
              {[1, 2, 3, 4, 5].map((starValue) => (
                <Star
                  key={starValue}
                  className={cn(
                    "h-4 w-4",
                    starValue <= (visit.partnershipConfidence ?? 0)
                      ? "text-yellow-400 fill-yellow-400"
                      : "text-muted-foreground/50"
                  )}
                />
              ))}
               <span className="ml-2 text-xs text-muted-foreground">(Partnership Confidence)</span>
            </div>
          )}
          <div className="flex items-center text-xs text-muted-foreground">
            {visit.hasBusinessCard ? <CheckSquare className="mr-2 h-4 w-4 text-green-500" /> : <Square className="mr-2 h-4 w-4 text-muted-foreground/50" />}
            Business Card: {visit.hasBusinessCard ? 'Yes' : 'No'}
          </div>
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
        </div>
        <CardDescription className="flex items-center text-sm mt-2">
          <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />
          {format(new Date(visit.timestamp), 'MMM d, yyyy, HH:mm')}
        </CardDescription>
        {visit.latitude && visit.longitude && (
            <p className="text-xs text-muted-foreground flex items-center">
                <MapPin className="mr-1 h-3 w-3" /> Lat: {visit.latitude.toFixed(4)}, Lng: {visit.longitude.toFixed(4)}
            </p>
        )}
      </CardHeader>
      <CardContent className="flex-grow space-y-3 text-sm">
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
            <h4 className="font-medium text-foreground flex items-center mb-1 underline">
              <ShieldAlert className="mr-2 h-4 w-4 text-primary" />
              Competitor Intel: ({visit.competitorName})
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
          <div className="p-3 bg-accent/10 rounded-md border border-accent/50">
            <h4 className="font-medium text-accent-foreground flex items-center mb-1">
              <Sparkles className="mr-2 h-4 w-4 text-accent" /> Notes Summary
            </h4>
            <p className="text-accent whitespace-pre-wrap break-words">{visit.notesSummary}</p>
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

    
