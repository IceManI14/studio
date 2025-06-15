
'use client';

import type { Visit } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, CalendarDays, Edit, FileText, Info, Loader2, MapPin, Sparkles, Star, Trash2, CheckSquare, Square } from 'lucide-react';
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
      onUpdateVisit(updatedVisit); // This should update the visit in the parent's state
      toast({ title: "Notes Re-summarized", description: "Summary has been updated."});
    } catch (error) {
      toast({ title: "Error Summarizing", description: "Could not re-summarize notes.", variant: "destructive" });
    } finally {
      setIsSummarizing(false);
    }
  };
  
  return (
    <Card className="flex flex-col shadow-lg hover:shadow-xl transition-shadow duration-300">
      <CardHeader>
        <div className="flex justify-between items-start">
            <CardTitle className="font-headline text-xl text-primary flex items-center">
                <Building2 className="mr-2 h-5 w-5" /> {visit.companyName}
            </CardTitle>
            <Badge variant={visit.contactInfo && visit.contactInfo.confidence > 0.7 ? "default" : "secondary"} className="ml-2 whitespace-nowrap">
                {visit.contactInfo ? `${(visit.contactInfo.confidence * 100).toFixed(0)}% Conf.` : 'No Contact'}
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
        </div>
        <CardDescription className="flex items-center text-sm mt-2">
          <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />
          Logged on {format(new Date(visit.timestamp), 'MMM d, yyyy, HH:mm')}
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
        
        {visit.notes && (
           <div className="p-3 bg-secondary/30 rounded-md">
            <h4 className="font-medium text-foreground flex items-center mb-1">
              <FileText className="mr-2 h-4 w-4 text-primary" /> Original Notes
            </h4>
            <p className="text-muted-foreground max-h-20 overflow-y-auto whitespace-pre-wrap break-words">{visit.notes}</p>
          </div>
        )}

        {visit.notesSummary && (
          <div className="p-3 bg-accent/10 rounded-md border border-accent/50">
            <h4 className="font-medium text-accent-foreground flex items-center mb-1">
              <Sparkles className="mr-2 h-4 w-4 text-accent" /> Notes Summary
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
