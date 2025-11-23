

'use client';

import type { Visit, CompanyDoc } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarDays, Edit, FileText, Info, Loader2, Sparkles, Star, Trash2, CheckSquare, Square, Swords, Box, ShieldAlert, Hash, PackageCheck, Droplets, AlertTriangle, CheckCircle2, ShieldQuestion, Wind, CalendarCheck, CalendarX, FileType, CalendarClock, Contact, PlusSquare, Mic, Navigation, MapPin, LocateFixed, DollarSign, RefreshCw, X, ChevronsUp, Compass, Mail, CalendarIcon, ClipboardList, Phone, Image as ImageIcon } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';
import { summarizeNotesAction } from '@/app/actions';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import NextImage from 'next/image';
import { COMPETITOR_DETAILS } from '@/lib/competitor-details';
import { COOLER_PRICING_MAP } from '@/lib/cooler-pricing';
import { Separator } from './ui/separator';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { calculateCommission } from '@/app/page';

interface VisitCardProps {
  visit: Visit;
  onEdit: (visit: Visit) => void;
  onDelete: (visitId: string) => void;
  onUpdateDealClosed: (visitId: string, dealClosed: boolean) => void;
  onZoom?: (visit: Visit | null) => void;
  isZoomedView?: boolean;
  onLogFollowUp?: (visit: Visit) => void;
  onDictateNotes?: (visit: Visit) => void;
  variant?: 'default' | 'planner';
  isOnCallList: boolean;
  onToggleCallList: (visitId: string) => void;
}

const VisitCard: React.FC<VisitCardProps> = ({ visit, onEdit, onDelete, onUpdateDealClosed, onZoom, isZoomedView, onLogFollowUp, onDictateNotes, variant = 'default', isOnCallList, onToggleCallList }) => {
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [showExtraInfo, setShowExtraInfo] = useState(false);
  const [isCardFlipped, setIsCardFlipped] = useState(false);
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
    
    if (!template.content) {
        toast({ variant: 'destructive', title: 'Invalid Template', description: 'This email template is missing content.' });
        return;
    }

    // Replace placeholders
    const subject = template.content.subject
        .replace(/{{contactName}}/g, contactName.trim())
        .replace(/{{companyName}}/g, visit.companyName);

    let body = template.content.body
        .replace(/{{contactName}}/g, contactName.trim())
        .replace(/{{companyName}}/g, visit.companyName)
        .replace(/{{address}}/g, extractAddressFromNotes(visit.notes) || 'N/A')
        .replace(/{{contactEmailOrPhone}}/g, visit.decisionMakerContact || 'N/A')
        .replace(/{{interestedUnitsList}}/g, visit.interestedUnits?.join(', ') || 'N/A')
        .replace(/{{trialStartDate}}/g, visit.freeTrialStartDate ? formatInTimeZone(new Date(visit.freeTrialStartDate), timeZone, 'PPP') : 'N/A')
        .replace(/{{notes}}/g, visit.notes || 'No notes provided.');

    const mailtoLink = `mailto:${template.name.toLowerCase().includes('work order') ? 'techs@drinkoptimum.com' : contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;
    toast({ title: "Opening Email Client", description: `Preparing '${template.name}' email for ${visit.companyName}.` });
  };
  
  const handleDealClosedChange = (checked: boolean | 'indeterminate') => {
    const isClosingDeal = !!checked;
    onUpdateDealClosed(visit.id, isClosingDeal);

    if (isClosingDeal) {
        const thanksTemplate = emailTemplates.find(t => t.name.toLowerCase().includes('thank you for business'));
        if (thanksTemplate) {
            handleGenerateEmail(thanksTemplate);
        } else {
             toast({ title: 'Deal Closed!', description: 'Remember to send a thank you email.' });
        }
    }
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

  const extractAddressFromNotes = (notes: string | undefined | null): string | null => {
      if (!notes) return null;
      const match = notes.match(/Address: (.*)/);
      if (match) return match[1].split('\n')[0].trim();
      
      const match2 = notes.match(/Company Address:\s*(.*)/);
      return match2 ? match2[1].split('\n')[0].trim() : null;
  };
  const address = extractAddressFromNotes(visit.notes);

  const tdsInfo = getTDSInfo();
  const isHtmlCardFront = visit.businessCardImageFrontUrl?.trim().startsWith('<!DOCTYPE html>');
  const isHtmlCardBack = visit.businessCardImageBackUrl?.trim().startsWith('<!DOCTYPE html>');
  const hasDecisionMakerDetails = visit.decisionMakerName || visit.decisionMakerTitle || visit.decisionMakerContact || (visit.contactInfo?.info && visit.contactInfo.info !== "No contact info found on web!");
  
  const potentialCommission = calculateCommission(visit);
  
  const hasSiteImages = visit.locationImageUrl || visit.underSinkImageUrl || visit.installedUnitImageUrl;

  const ZoomedContent = () => (
    <div className="space-y-4 text-sm">
        <div>
            <h4 className="font-semibold text-primary flex items-center mb-1"><CalendarDays className="mr-2 h-4 w-4" />Timestamp</h4>
            <p className="pl-6 text-muted-foreground">{formatInTimeZone(new Date(visit.timestamp), timeZone, 'PPPp')}</p>
        </div>
        
        {address && (
             <div>
                <h4 className="font-semibold text-primary flex items-center mb-1"><MapPin className="mr-2 h-4 w-4" />Address</h4>
                <p className="pl-6 text-muted-foreground">{address}</p>
            </div>
        )}

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
        
        {(hasSiteImages || hasDecisionMakerDetails || visit.businessCardImageFrontUrl || visit.businessCardImageBackUrl) && <Separator />}
        
        {hasSiteImages && (
            <div>
                <h4 className="font-semibold text-primary flex items-center mb-2"><ImageIcon className="mr-2 h-4 w-4" />Site & Install Photos</h4>
                <div className="pl-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                    {visit.locationImageUrl && (
                        <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">Location</p>
                            <NextImage src={visit.locationImageUrl} alt="Location photo" width={200} height={150} className="rounded-md border aspect-video object-cover" />
                        </div>
                    )}
                    {visit.underSinkImageUrl && (
                        <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">Under Sink</p>
                            <NextImage src={visit.underSinkImageUrl} alt="Under-sink photo" width={200} height={150} className="rounded-md border aspect-video object-cover" />
                        </div>
                    )}
                    {visit.installedUnitImageUrl && (
                        <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">Installed Unit</p>
                            <NextImage src={visit.installedUnitImageUrl} alt="Installed unit photo" width={200} height={150} className="rounded-md border aspect-video object-cover" />
                        </div>
                    )}
                </div>
            </div>
        )}

        {hasDecisionMakerDetails && (
            <div>
                <h4 className="font-semibold text-primary flex items-center mb-1"><Contact className="mr-2 h-4 w-4" />Decision Maker Info</h4>
                <div className="pl-6 space-y-1">
                    {visit.decisionMakerName && <p><strong>Name:</strong> {visit.decisionMakerName}</p>}
                    {visit.decisionMakerTitle && <p><strong>Title:</strong> {visit.decisionMakerTitle}</p>}
                    {visit.decisionMakerContact ? (
                      <p><strong>Contact:</strong> {visit.decisionMakerContact}</p>
                    ) : (
                      <div className="flex items-center gap-2">
                        <strong>Contact:</strong>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            window.open(`https://www.google.com/search?q=${encodeURIComponent(visit.companyName)}%20${encodeURIComponent(visit.city || '')}%20phone%20number`, '_blank');
                          }}
                        >
                           <svg className="h-3 w-3 mr-1" role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>Google</title><path d="M12.48 10.92v3.28h7.84c-.24 1.84-.85 3.18-1.73 4.1-1.05 1.05-2.36 1.67-4.06 1.67-3.4 0-6.17-2.83-6.17-6.23s2.77-6.23 6.17-6.23c1.87 0 3.14.75 3.96 1.5.8.75 1.25 1.8.96 3.14H12.48zM24 12c0-.75-.06-1.5-.18-2.22H12v4.4h6.8c-.27 1.43-1.12 2.6-2.25 3.33v2.8h3.5c2.04-1.87 3.22-4.6 3.22-7.83z" fill="currentColor"/></svg>
                          Find Phone
                        </Button>
                      </div>
                    )}
                    {visit.contactInfo?.info && visit.contactInfo.info !== "No contact info found on web!" && (
                    <div className="pt-2 border-t mt-2">
                        <p><strong>Scraped Info:</strong> {visit.contactInfo.info}</p>
                        <p className="text-xs text-muted-foreground"><strong>Confidence:</strong> {Math.round(visit.contactInfo.confidence * 100)}%</p>
                    </div>
                    )}
                </div>
            </div>
        )}
        
        {(visit.businessCardImageFrontUrl || visit.businessCardImageBackUrl) && (
          <div>
            <div className="flex justify-between items-center mb-1">
              <h4 className="font-semibold text-primary flex items-center"><FileType className="mr-2 h-4 w-4" />Business Card</h4>
              {visit.businessCardImageBackUrl && (
                <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setIsCardFlipped(!isCardFlipped)}>
                  <RefreshCw className="mr-1 h-3 w-3" />
                  Flip
                </Button>
              )}
            </div>
            <div className="pl-6 perspective-1000">
              <div className={cn("w-full aspect-[1.77] max-w-sm mx-auto relative rolodex-preserve-3d transition-transform duration-700", isCardFlipped ? "[transform:rotateY(180deg)]" : "")}>
                {/* Front of Card */}
                <div className="absolute w-full h-full [backface-visibility:hidden]">
                  {visit.businessCardImageFrontUrl ? (
                    isHtmlCardFront ? (
                      <div className="text-sm text-destructive-foreground bg-destructive p-3 rounded-md h-full flex items-center justify-center">
                        <p>Cannot display card front. The saved data is invalid. Please re-upload.</p>
                      </div>
                    ) : (
                      <NextImage
                        src={visit.businessCardImageFrontUrl}
                        alt="Business card front"
                        data-ai-hint="business card professional"
                        fill
                        style={{ objectFit: 'contain' }}
                        className="rounded-md border bg-background"
                      />
                    )
                  ) : (
                     <div className="h-full flex items-center justify-center bg-muted rounded-md text-muted-foreground">Front not available</div>
                  )}
                </div>
                {/* Back of Card */}
                <div className="absolute w-full h-full [backface-visibility:hidden] [transform:rotateY(180deg)]">
                  {visit.businessCardImageBackUrl ? (
                    isHtmlCardBack ? (
                       <div className="text-sm text-destructive-foreground bg-destructive p-3 rounded-md h-full flex items-center justify-center">
                        <p>Cannot display card back. The saved data is invalid. Please re-upload.</p>
                      </div>
                    ) : (
                      <NextImage
                        src={visit.businessCardImageBackUrl}
                        alt="Business card back"
                        data-ai-hint="business card professional"
                        fill
                        style={{ objectFit: 'contain' }}
                        className="rounded-md border bg-background"
                      />
                    )
                  ) : (
                     <div className="h-full flex items-center justify-center bg-muted rounded-md text-muted-foreground">Back not available</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}


        {(visit.discussedCompetitors || visit.hasTDSReading || visit.freeTrial || visit.futureMeetingSet || visit.pricingDiscussed || visit.creditApproved || typeof visit.manualCommission === 'number' || (visit.interestedUnits && visit.interestedUnits.length > 0)) && <Separator />}

        {(visit.interestedUnits && visit.interestedUnits.length > 0) && (
             <div>
                <h4 className="font-semibold text-primary flex items-center mb-1"><PackageCheck className="mr-2 h-4 w-4" />{visit.dealClosed ? 'Installed Coolers' : 'Potential Units of Interest'}</h4>
                <div className="pl-6 space-y-1">
                    <ul className="list-disc list-inside">
                        {visit.interestedUnits.map((unit, index) => (
                            <li key={index}>{unit}</li>
                        ))}
                    </ul>
                </div>
            </div>
        )}

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

        {(visit.pricingDiscussed || visit.creditApproved || typeof visit.manualCommission === 'number') && (
            <div>
                <h4 className="font-semibold text-primary flex items-center mb-1"><DollarSign className="mr-2 h-4 w-4" />Pricing & Commission</h4>
                <div className="pl-6 space-y-1">
                    {visit.pricingDiscussed && (
                        <p>
                            <strong>Pricing:</strong>
                            {visit.priceQuoted && visit.leaseTerm 
                                ? ` Quoted $${(typeof visit.priceQuoted === 'string' ? parseFloat(visit.priceQuoted) : visit.priceQuoted).toFixed(2)}/mo for ${visit.leaseTerm} months`
                                : " Discussed"
                            }
                        </p>
                    )}
                    {visit.installationFee && <p><strong>Installation Fee:</strong> ${ (typeof visit.installationFee === 'string' ? parseFloat(visit.installationFee) : visit.installationFee).toFixed(2)}</p>}
                    {visit.creditApproved && <p><strong>Credit:</strong> Approved for financing.</p>}
                    {typeof visit.manualCommission === 'number' && (
                       <p className="font-semibold text-primary"><strong>Manual Commission:</strong> ${(typeof visit.manualCommission === 'string' ? parseFloat(visit.manualCommission) : visit.manualCommission).toFixed(2)}</p>
                    )}
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
  );

  const NormalContent = () => (
    <div className="space-y-2">
      <div className="flex flex-col gap-y-1.5 text-sm text-muted-foreground">
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
          <div className="absolute top-3 right-3 flex items-center gap-1 z-10">
              <Button asChild variant="default" size="icon" className="h-8 w-8 shrink-0" onClick={(e) => e.stopPropagation()} disabled={!visit.latitude || !visit.longitude}>
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${visit.latitude},${visit.longitude}`} target="_blank" rel="noopener noreferrer" aria-label={`Navigate to ${visit.companyName}`}>
                      <Compass className="h-4 w-4" />
                  </a>
              </Button>
              {isZoomedView && (
                  <AlertDialog>
                      <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="icon" className="h-8 w-8 ml-2" onClick={(e) => e.stopPropagation()} aria-label={`Delete visit to ${visit.companyName}`}>
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
              )}
               {isZoomedView && (
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); onEdit(visit); }} aria-label={`Edit visit to ${visit.companyName}`}>
                    <Edit className="h-4 w-4" />
                  </Button>
              )}
              {isZoomedView && onLogFollowUp && (
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); onLogFollowUp(visit); }} aria-label={`Add Future Visit for ${visit.companyName}`}>
                  <CalendarIcon className="h-4 w-4" />
                </Button>
              )}
          </div>
          
          {!visit.dealClosed && (
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
          )}


          <div className="flex flex-col items-center justify-center w-full pt-12">
            <div className="flex items-center justify-center gap-2 text-sm font-medium mb-1">
                {(visit.interestedUnits && visit.interestedUnits.length > 0) && (
                  <div className="text-blue-400">
                    {`{${visit.interestedUnits[0].split('(')[0].trim()}${visit.interestedUnits.length > 1 ? `, +${visit.interestedUnits.length - 1}` : ''}}`}
                  </div>
                )}
                {potentialCommission !== null && (
                    <div className="flex items-center text-green-400" title={`Potential Commission: $${potentialCommission.value.toFixed(2)}${potentialCommission.reason ? ` (${potentialCommission.reason})` : ''}`}>
                        {potentialCommission.isOverride && <Edit className="h-3 w-3 mr-1" />}
                        <DollarSign className="h-4 w-4" />
                        {potentialCommission.value.toFixed(2)}
                    </div>
                )}
              </div>
              
              <CardTitle 
                className="font-headline text-3xl text-accent-foreground text-center break-words cursor-pointer hover:text-primary transition-colors"
                onClick={(e) => {
                    if (address || visit.timestamp) {
                      e.stopPropagation();
                      setShowExtraInfo(!showExtraInfo);
                    }
                }}
              >
                {visit.companyName}
              </CardTitle>
              
              {showExtraInfo && (
                <div className="text-center text-sm text-muted-foreground mt-1 animate-in fade-in-0 flex flex-col items-center">
                    {address && (
                        <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {address}
                        </div>
                    )}
                    <CardDescription className="text-xs pt-1">
                        {formatInTimeZone(new Date(visit.timestamp), timeZone, 'PPPp')}
                    </CardDescription>
                </div>
              )}
              
              <div className="text-center">
                  {visit.city && <CardDescription className="text-sm mt-1">{visit.city}</CardDescription>}
              </div>
          </div>
      </CardHeader>

      <CardContent className="flex-grow p-4 pt-0">
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
            onCheckedChange={handleDealClosedChange}
            aria-label="Mark deal as closed"
          />
          <Label htmlFor={`deal-closed-${visit.id}`} className="cursor-pointer text-sm font-medium text-green-600 dark:text-green-400">
            Deal Closed!
          </Label>
        </div>

        <div className="flex justify-end gap-1">
            <div 
              className="flex items-center space-x-2"
              onClick={(e) => e.stopPropagation()}
            >
              <Checkbox 
                id={`call-list-${visit.id}`} 
                checked={isOnCallList}
                onCheckedChange={() => onToggleCallList(visit.id)}
                aria-label="Add to call list"
              />
              <Label htmlFor={`call-list-${visit.id}`} className="cursor-pointer text-sm font-medium text-muted-foreground">
                Add to Call List
              </Label>
            </div>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={e => e.stopPropagation()}>
                        <Mail className="h-4 w-4" />
                        <span className="sr-only">Email Options</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent onClick={e => e.stopPropagation()}>
                    {emailTemplates.length > 0 ? (
                        emailTemplates.map(template => (
                            <DropdownMenuItem key={template.id} onSelect={() => handleGenerateEmail(template)}>
                                {template.name}
                            </DropdownMenuItem>
                        ))
                    ) : (
                        <DropdownMenuItem disabled>No email templates found.</DropdownMenuItem>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
            
            {onLogFollowUp && (
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); onLogFollowUp(visit); }} aria-label={`Log follow-up for ${visit.companyName}`}>
                <PlusSquare className="h-4 w-4" />
              </Button>
            )}
            {onDictateNotes && !isZoomedView && (
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); onDictateNotes(visit); }} aria-label={`Dictate notes for ${visit.companyName}`}>
                <Mic className="h-4 w-4" />
              </Button>
            )}
            {!isZoomedView && (
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); onEdit(visit); }} aria-label={`Edit visit to ${visit.companyName}`}>
                <Edit className="h-4 w-4" />
              </Button>
            )}
            {!isZoomedView && (
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
            )}
        </div>
      </CardFooter>
    </Card>
  );
};

export default VisitCard;
