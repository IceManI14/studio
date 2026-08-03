'use client';

import type { Visit, CompanyDoc } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  CalendarDays, 
  Edit, 
  FileText, 
  Loader2, 
  Sparkles, 
  Star, 
  Trash2, 
  CheckSquare, 
  Square, 
  Contact, 
  Compass, 
  Mail, 
  MapPin, 
  CheckCircle2, 
  X
} from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';
import { summarizeNotesAction } from '@/app/actions';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { calculateCommission } from '@/app/page';

interface VisitCardProps {
  visit: Visit;
  onEdit: (visit: Visit) => void;
  onDelete: (visitId: string) => void;
  onUpdateDealClosed: (visitId: string, dealClosed: boolean) => void;
  onZoom?: (visit: Visit | null) => void;
  isZoomedView?: boolean;
  isOnCallList: boolean;
  onToggleCallList: (visitId: string) => void;
}

const VisitCard: React.FC<VisitCardProps> = ({ 
  visit, 
  onEdit, 
  onDelete, 
  onUpdateDealClosed, 
  onZoom, 
  isZoomedView, 
  isOnCallList, 
  onToggleCallList 
}) => {
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [emailTemplates, setEmailTemplates] = useState<CompanyDoc[]>([]);
  const timeZone = 'America/New_York';
  const { toast } = useToast();

  useEffect(() => {
    const storedDocs = localStorage.getItem('companyDocs');
    if (storedDocs) {
      const allDocs: CompanyDoc[] = JSON.parse(storedDocs);
      setEmailTemplates(allDocs.filter(doc => doc.type === 'template'));
    }
  }, [visit]);

  const handleGenerateEmail = (template: CompanyDoc) => {
    const contactEmail = visit.decisionMakerContact && visit.decisionMakerContact.includes('@') ? visit.decisionMakerContact : '';
    const contactName = visit.decisionMakerName ? ` ${visit.decisionMakerName}` : '';
    
    if (!template.content) return;

    const subject = template.content.subject.replace(/{{contactName}}/g, contactName.trim()).replace(/{{companyName}}/g, visit.companyName);
    const body = template.content.body.replace(/{{contactName}}/g, contactName.trim()).replace(/{{companyName}}/g, visit.companyName);

    const mailtoLink = `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;
  };
  
  const handleDealClosedChange = (checked: boolean | 'indeterminate') => {
    onUpdateDealClosed(visit.id, !!checked);
    if (!!checked) toast({ title: 'Deal Closed!', description: 'Individual units will be counted in your monthly performance metrics.' });
  };

  const handleSummarizeAgain = async () => {
    if (!visit.notes?.trim()) return;
    setIsSummarizing(true);
    try {
      await summarizeNotesAction({ notes: visit.notes });
      toast({ title: "Re-summarized" });
    } catch (e) {
      toast({ variant: 'destructive', title: "Summarization Error" });
    } finally {
      setIsSummarizing(false);
    }
  };

  const commission = calculateCommission ? calculateCommission(visit) : null;

  const ZoomedContent = () => (
    <div className="space-y-6 text-sm p-6">
        <div className="flex justify-between items-start">
            <div>
                <h2 className="text-3xl font-black aurora-text leading-tight mb-1">{visit.companyName}</h2>
                <p className="text-muted-foreground flex items-center gap-1"><MapPin className="h-4 w-4" /> {visit.city || 'Location Unknown'}</p>
            </div>
            <div className="text-right">
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-1">Deal Confidence</p>
                <div className="flex gap-0.5 justify-end">
                    {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} className={cn("h-5 w-5", s <= (visit.partnershipConfidence || 0) ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/30")} />
                    ))}
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
                <div>
                    <h4 className="font-black text-primary flex items-center mb-2 uppercase tracking-wider text-xs"><CalendarDays className="mr-2 h-4 w-4" /> Visit Timestamp</h4>
                    <p className="bg-muted/30 p-3 rounded-xl border border-primary/5 font-medium">{formatInTimeZone(new Date(visit.timestamp), timeZone, 'PPPp')}</p>
                </div>
                {visit.notes && (
                    <div>
                        <h4 className="font-black text-primary flex items-center mb-2 uppercase tracking-wider text-xs"><FileText className="mr-2 h-4 w-4" /> Sales Notes</h4>
                        <p className="whitespace-pre-wrap bg-muted/30 p-4 rounded-xl border border-primary/5 text-muted-foreground leading-relaxed">{visit.notes}</p>
                    </div>
                )}
            </div>

            <div className="space-y-4">
                {visit.notesSummary && (
                    <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 space-y-2">
                        <div className="flex items-center justify-between">
                            <h4 className="font-black text-primary flex items-center uppercase tracking-wider text-xs"><Sparkles className="mr-2 h-4 w-4" /> AI Summary</h4>
                            <Button variant="ghost" size="sm" onClick={handleSummarizeAgain} disabled={isSummarizing} className="h-6 text-[10px]">
                                {isSummarizing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="mr-1 h-3 w-3" />} Re-summarize
                            </Button>
                        </div>
                        <p className="text-sm leading-relaxed">{visit.notesSummary}</p>
                    </div>
                )}
                {(visit.decisionMakerName || visit.decisionMakerContact) && (
                     <div className="bg-accent/5 p-4 rounded-xl border border-accent/10 space-y-2">
                        <h4 className="font-black text-accent flex items-center uppercase tracking-wider text-xs"><Contact className="mr-2 h-4 w-4" /> Decision Maker</h4>
                        <div className="space-y-1">
                            {visit.decisionMakerName && <p className="font-bold">{visit.decisionMakerName} <span className="font-normal text-muted-foreground ml-1">({visit.decisionMakerTitle || 'No Title'})</span></p>}
                            {visit.decisionMakerContact && <p className="text-sm text-muted-foreground flex items-center gap-2"><Mail className="h-3 w-3" /> {visit.decisionMakerContact}</p>}
                        </div>
                    </div>
                )}
                {commission && (
                    <div className="bg-green-500/5 p-4 rounded-xl border border-green-500/10">
                        <h4 className="font-black text-green-500 flex items-center uppercase tracking-wider text-xs mb-1">Potential Commission</h4>
                        <p className="text-2xl font-black text-green-500">${commission.value.toFixed(2)}</p>
                        <p className="text-[10px] text-muted-foreground">{commission.reason}</p>
                    </div>
                )}
            </div>
        </div>
    </div>
  );

  return (
    <Card className={cn("group transition-all duration-300 border-2 overflow-hidden", visit.dealClosed ? 'border-green-500/30' : 'border-primary/20', !isZoomedView && 'hover:border-primary/50 cursor-pointer')}>
      <CardHeader className="pb-3 relative bg-card/50">
          <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button asChild variant="outline" size="icon" className="h-8 w-8"><a href={`https://www.google.com/maps/dir/?api=1&destination=${visit.latitude},${visit.longitude}`} target="_blank"><Compass className="h-4 w-4" /></a></Button>
              <Button variant="outline" size="icon" onClick={() => onEdit(visit)} className="h-8 w-8"><Edit className="h-4 w-4" /></Button>
              <AlertDialog>
                  <AlertDialogTrigger asChild><Button variant="destructive" size="icon" className="h-8 w-8"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                  <AlertDialogContent className="bg-card border-2 border-primary/20"><AlertDialogHeader><AlertDialogTitle>Delete Visit Record?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This visit will be permanently removed from your history.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => onDelete(visit.id)} className="bg-red-500 hover:bg-red-600">Delete Permanently</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
              </AlertDialog>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
                <Badge variant={visit.dealClosed ? 'default' : 'secondary'} className={cn(visit.dealClosed && 'bg-green-600')}>{visit.dealClosed ? 'Deal Closed' : 'Prospect'}</Badge>
                {visit.hasTDSReading && <Badge variant="outline" className="border-blue-500/30 text-blue-500">TDS: {visit.tdsValue} PPM</Badge>}
            </div>
            <CardTitle className="text-2xl font-black tracking-tight text-foreground truncate pt-2">{visit.companyName}</CardTitle>
            <CardDescription className="flex items-center gap-1 font-medium"><MapPin className="h-3 w-3" /> {visit.city || 'Location Unknown'}</CardDescription>
          </div>
          
          <div className="pt-2">
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-1">Deal Confidence</p>
            <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className={cn("h-4 w-4", s <= (visit.partnershipConfidence || 0) ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/30")} />
                ))}
            </div>
          </div>
      </CardHeader>

      <CardContent className="p-4" onClick={() => !isZoomedView && onZoom?.(visit)}>
        {isZoomedView ? <ZoomedContent /> : (
            <div className="space-y-3">
                {visit.notesSummary ? (
                    <p className="text-sm text-muted-foreground line-clamp-2 italic leading-relaxed">"{visit.notesSummary}"</p>
                ) : (
                    <p className="text-sm text-muted-foreground/50 italic line-clamp-1">No summary available yet...</p>
                )}
                <div className="flex flex-wrap gap-2">
                    {visit.competitorName && <Badge variant="outline" className="text-[10px] border-red-500/20 text-red-500 uppercase font-black">{visit.competitorName}</Badge>}
                    {visit.interestedUnits && visit.interestedUnits.length > 0 && (
                        <Badge variant="outline" className="text-[10px] border-primary/20 text-primary uppercase font-black">
                            {visit.interestedUnits.length} {visit.interestedUnits.length === 1 ? 'Unit' : 'Units'} Interested
                        </Badge>
                    )}
                </div>
            </div>
        )}
      </CardContent>

      <CardFooter className="px-4 py-3 bg-muted/20 border-t flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Checkbox id={`closed-${visit.id}`} checked={!!visit.dealClosed} onCheckedChange={handleDealClosedChange} />
          <Label htmlFor={`closed-${visit.id}`} className="text-xs font-bold cursor-pointer text-green-600 dark:text-green-400">Mark as Closed</Label>
        </div>
        <div className="flex gap-1">
            <Button variant="ghost" size="icon" className={cn("h-8 w-8 transition-colors", isOnCallList && "text-primary")} onClick={(e) => { e.stopPropagation(); onToggleCallList(visit.id); }}>
                {isOnCallList ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
            </Button>
            <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}><Mail className="h-4 w-4" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-card border-2 border-primary/10">
                    {emailTemplates.length > 0 ? emailTemplates.map(t => <DropdownMenuItem key={t.id} onSelect={() => handleGenerateEmail(t)} className="font-bold">{t.name}</DropdownMenuItem>) : <DropdownMenuItem disabled>No templates found</DropdownMenuItem>}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </CardFooter>
    </Card>
  );
};

export default VisitCard;