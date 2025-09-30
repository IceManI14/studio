

'use client';

import { useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { findCompanyAction } from '@/app/actions';
import { Loader2, MapPin, Phone, PlusSquare, Mic, Trash2, Building, User, CheckCircle } from 'lucide-react';
import type { Visit, Territory, FoundPlace, HotLead } from '@/lib/types';
import { ScrollArea } from './ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Textarea } from './ui/textarea';
import ExportHotLeadsPdfButton from './export-hot-leads-pdf-button';


interface FindCompanyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAddAsVisit: (visitData: Partial<Visit>) => void;
    onAddHotLeads: (places: HotLead[]) => void;
    destinationCities: string[];
    territory?: Territory[];
    isTelemarketerLeadMode?: boolean;
    hotLeads: HotLead[];
    onDeleteHotLead: (leadId: string) => void;
    onUpdateHotLeadNotes: (leadId: string, notes: string) => void;
    convertedHotLeads: Set<string>;
    onAddHotLeadAsVisit: (lead: HotLead) => void;
}

export default function FindCompanyModal({
    isOpen,
    onClose,
    onAddAsVisit,
    onAddHotLeads,
    destinationCities,
    territory,
    isTelemarketerLeadMode,
    hotLeads,
    onDeleteHotLead,
    onUpdateHotLeadNotes,
    convertedHotLeads,
    onAddHotLeadAsVisit,
}: FindCompanyModalProps) {
    const [companyName, setCompanyName] = useState('');
    const [location, setLocation] = useState('');
    const [phone, setPhone] = useState('');
    const [contactName, setContactName] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const { toast } = useToast();
    const [recordingField, setRecordingField] = useState<'company' | 'location' | 'phone' | 'contact' | null>(null);
    const recognitionRef = useRef<SpeechRecognition | null>(null);

    const handleToggleVoice = useCallback((field: 'company' | 'location' | 'phone' | 'contact') => {
        const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            toast({ variant: 'destructive', title: 'Voice Recognition Not Supported' });
            return;
        }

        if (recordingField && recognitionRef.current) {
            recognitionRef.current.stop();
            return;
        }

        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;

        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            setRecordingField(field);
            toast({ title: `Listening for ${field}...` });
        };

        recognition.onend = () => {
            setRecordingField(null);
            recognitionRef.current = null;
        };
        
        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            toast({ variant: 'destructive', title: 'Voice Error', description: event.error });
            setRecordingField(null);
            recognitionRef.current = null;
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            if (transcript) {
                if (field === 'company') setCompanyName(transcript);
                else if (field === 'location') setLocation(transcript);
                else if (field === 'phone') setPhone(transcript);
                else if (field === 'contact') setContactName(transcript);
                toast({ title: `${field.charAt(0).toUpperCase() + field.slice(1)} Updated` });
            }
        };

        try {
            recognition.start();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Could not start recording', description: e.message });
        }

    }, [recordingField, toast]);

    const handleSearch = async () => {
        if (!companyName.trim()) {
            toast({ variant: 'destructive', title: "Company name required" });
            return;
        }
        setIsSearching(true);
        
        const newLead: HotLead = {
            id: crypto.randomUUID(),
            companyName: companyName,
            address: 'N/A',
            city: location || 'N/A',
            phone: phone || 'N/A',
            notes: contactName ? `Contact: ${contactName}` : '',
            addedAt: new Date(),
        };

        onAddHotLeads([newLead]);
        toast({ title: "Lead Added", description: `${companyName} has been added to the Telemarketer list.` });

        setCompanyName('');
        setLocation('');
        setPhone('');
        setContactName('');
        setIsSearching(false);
    };
    
    const handleClose = () => {
        setCompanyName('');
        setLocation('');
        setPhone('');
        setContactName('');
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
        onClose();
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{isTelemarketerLeadMode ? "Create a Telemarketer Lead" : "Find a Company"}</DialogTitle>
                    <DialogDescription>
                        {isTelemarketerLeadMode 
                            ? "Dictate or type the company name and location to create a new lead for the Telemarketer."
                            : "Search for all branches of a company within your territory. You can optionally narrow the search to a specific city."
                        }
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[70vh] p-1">
                    <div className="space-y-4 pr-6">
                        <div className="space-y-2">
                            <Label htmlFor="company-name-search">Company Name</Label>
                            <div className="relative flex items-center">
                                <Input
                                    id="company-name-search"
                                    value={companyName}
                                    onChange={(e) => setCompanyName(e.target.value)}
                                    placeholder="e.g., Optimum Water Solutions"
                                    className="pr-10"
                                    disabled={!!recordingField}
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleToggleVoice('company')}
                                    className="absolute right-1 h-8 w-8"
                                    aria-label="Dictate company name"
                                >
                                    {recordingField === 'company' ? (
                                        <Mic className="h-4 w-4 text-red-500 animate-pulse" />
                                    ) : (
                                        <Mic className="h-4 w-4 text-foreground" />
                                    )}
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="location-search">Location</Label>
                            <div className="relative flex items-center">
                                <Input
                                    id="location-search"
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                    placeholder="Enter company location (e.g., Boston, MA)"
                                    className="pr-10"
                                    disabled={!!recordingField}
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleToggleVoice('location')}
                                    className="absolute right-1 h-8 w-8"
                                    aria-label="Dictate location"
                                >
                                    {recordingField === 'location' ? (
                                        <Mic className="h-4 w-4 text-red-500 animate-pulse" />
                                    ) : (
                                        <Mic className="h-4 w-4 text-foreground" />
                                    )}
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone-search">Phone Number</Label>
                            <div className="relative flex items-center">
                                <Input
                                    id="phone-search"
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="e.g., 555-123-4567"
                                    className="pr-10"
                                    disabled={!!recordingField}
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleToggleVoice('phone')}
                                    className="absolute right-1 h-8 w-8"
                                    aria-label="Dictate phone number"
                                >
                                    {recordingField === 'phone' ? (
                                        <Mic className="h-4 w-4 text-red-500 animate-pulse" />
                                    ) : (
                                        <Mic className="h-4 w-4 text-foreground" />
                                    )}
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="contact-search">Contact Name</Label>
                            <div className="relative flex items-center">
                                <Input
                                    id="contact-search"
                                    value={contactName}
                                    onChange={(e) => setContactName(e.target.value)}
                                    placeholder="e.g., Jane Doe, Office Manager"
                                    className="pr-10"
                                    disabled={!!recordingField}
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleToggleVoice('contact')}
                                    className="absolute right-1 h-8 w-8"
                                    aria-label="Dictate contact name"
                                >
                                    {recordingField === 'contact' ? (
                                        <Mic className="h-4 w-4 text-red-500 animate-pulse" />
                                    ) : (
                                        <Mic className="h-4 w-4 text-foreground" />
                                    )}
                                </Button>
                            </div>
                        </div>
                        <Button onClick={handleSearch} disabled={isSearching || !!recordingField} className="w-full">
                            {isSearching ? <Loader2 className="animate-spin" /> : 'Create Lead'}
                        </Button>

                        {hotLeads.length > 0 && (
                            <Accordion type="single" collapsible className="w-full mt-4" defaultValue="telemarketer-list">
                                <AccordionItem value="telemarketer-list">
                                    <AccordionTrigger>Telemarketer List ({hotLeads.length})</AccordionTrigger>
                                    <AccordionContent>
                                        <Accordion type="multiple" className="space-y-3">
                                            {hotLeads.map((lead) => {
                                                const isConverted = convertedHotLeads.has(lead.id);
                                                return (
                                                    <AccordionItem value={lead.id} key={lead.id} className="p-3 rounded-md border border-orange-500/50 bg-background/50 data-[state=open]:bg-muted/50">
                                                        <AccordionTrigger className="p-0 hover:no-underline [&>svg]:hidden">
                                                            <h4 className="font-semibold text-foreground flex items-center text-left"><Building className="mr-2 h-4 w-4 shrink-0" />{lead.companyName}</h4>
                                                        </AccordionTrigger>
                                                        <AccordionContent className="pt-2">
                                                            <div className="space-y-2">
                                                                <div className="bg-muted/50 p-2 rounded-md">
                                                                    <p className="text-sm text-muted-foreground flex items-center"><MapPin className="mr-2 h-4 w-4 shrink-0" />{lead.city}</p>
                                                                    {lead.phone && <p className="text-sm text-muted-foreground flex items-center"><Phone className="mr-2 h-4 w-4 shrink-0" />{lead.phone}</p>}
                                                                </div>
                                                                <div className="space-y-1 bg-black p-2 rounded-md">
                                                                    <Label htmlFor={`hot-lead-notes-modal-${lead.id}`} className="text-xs font-medium text-muted-foreground">Lead Notes</Label>
                                                                    <Textarea
                                                                        id={`hot-lead-notes-modal-${lead.id}`}
                                                                        value={lead.notes || ''}
                                                                        onChange={(e) => onUpdateHotLeadNotes(lead.id, e.target.value)}
                                                                        placeholder="e.g., Contact: John Doe, contract ends soon..."
                                                                        className="text-sm h-20 bg-black"
                                                                        rows={3}
                                                                    />
                                                                </div>
                                                                <div className="flex justify-between items-center gap-2 pt-2 border-t border-border/50">
                                                                    <Button
                                                                        variant={isConverted ? "default" : "outline"}
                                                                        size="sm"
                                                                        className="h-7 px-2 text-xs"
                                                                        onClick={() => onAddHotLeadAsVisit(lead)}
                                                                        disabled={isConverted}
                                                                    >
                                                                        {isConverted ? (
                                                                            <>
                                                                                <CheckCircle className="mr-1 h-3 w-3" /> Added to Planner
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <PlusSquare className="mr-1 h-3 w-3" /> Add Future Visit
                                                                            </>
                                                                        )}
                                                                    </Button>
                                                                    <AlertDialog>
                                                                        <AlertDialogTrigger asChild>
                                                                            <Button variant="destructive" size="icon" className="h-7 w-7">
                                                                                <Trash2 className="h-4 w-4" />
                                                                            </Button>
                                                                        </AlertDialogTrigger>
                                                                        <AlertDialogContent>
                                                                            <AlertDialogHeader>
                                                                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                                                <AlertDialogDescription>
                                                                                    This will permanently delete the lead for "{lead.companyName}".
                                                                                </AlertDialogDescription>
                                                                            </AlertDialogHeader>
                                                                            <AlertDialogFooter>
                                                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                                <AlertDialogAction onClick={() => onDeleteHotLead(lead.id)}>Delete</AlertDialogAction>
                                                                            </AlertDialogFooter>
                                                                        </AlertDialogContent>
                                                                    </AlertDialog>
                                                                </div>
                                                            </div>
                                                        </AccordionContent>
                                                    </AccordionItem>
                                                );
                                            })}
                                        </Accordion>
                                        <div className="mt-4 flex justify-start">
                                            <ExportHotLeadsPdfButton hotLeads={hotLeads} />
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        )}
                    </div>
                </ScrollArea>
                
                <DialogFooter className="mt-4 pt-4 border-t">
                    <Button variant="outline" onClick={handleClose}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
