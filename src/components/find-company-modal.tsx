'use client';

import { useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Phone, PlusSquare, Mic, Trash2, CheckCircle, UserPlus, Save, ClipboardList, X } from 'lucide-react';
import type { HotLead } from '@/lib/types';
import { ScrollArea } from './ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Textarea } from './ui/textarea';
import ExportHotLeadsPdfButton from './export-hot-leads-pdf-button';
import { cn } from '@/lib/utils';

interface FindCompanyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAddHotLeads: (places: HotLead[]) => void;
    hotLeads: HotLead[];
    onDeleteHotLead: (leadId: string) => void;
    onUpdateHotLeadNotes: (leadId: string, notes: string) => void;
    convertedHotLeads: Set<string>;
    onAddHotLeadAsVisit: (lead: HotLead) => void;
}

export default function FindCompanyModal({
    isOpen,
    onClose,
    onAddHotLeads,
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
    const [notes, setNotes] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const { toast } = useToast();
    const [recordingField, setRecordingField] = useState<'company' | 'location' | 'phone' | 'contact' | 'notes' | null>(null);
    const recognitionRef = useRef<SpeechRecognition | null>(null);

    const handleToggleVoice = useCallback((field: 'company' | 'location' | 'phone' | 'contact' | 'notes') => {
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
        recognition.continuous = field === 'notes';
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
        
        recognition.onerror = (event: any) => {
            toast({ variant: 'destructive', title: 'Voice Error', description: event.error });
            setRecordingField(null);
            recognitionRef.current = null;
        };

        recognition.onresult = (event: any) => {
            const transcript = event.results[event.results.length - 1][0].transcript;
            if (transcript) {
                if (field === 'company') setCompanyName(transcript);
                else if (field === 'location') setLocation(transcript);
                else if (field === 'phone') setPhone(transcript);
                else if (field === 'contact') setContactName(transcript);
                else if (field === 'notes') setNotes(prev => (prev ? `${prev} ${transcript.trim()}` : transcript.trim()));
            }
        };

        try {
            recognition.start();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        }
    }, [recordingField, toast]);

    const handleSearch = async () => {
        if (!companyName.trim()) {
            toast({ variant: 'destructive', title: "Company name required" });
            return;
        }
        setIsSearching(true);
        
        const combinedNotes = `${contactName ? `Contact: ${contactName}\n` : ''}${notes}`.trim();

        const newLead: HotLead = {
            id: crypto.randomUUID(),
            companyName: companyName,
            address: 'N/A',
            city: location || 'N/A',
            phone: phone || 'N/A',
            notes: combinedNotes,
            addedAt: new Date(),
        };

        onAddHotLeads([newLead]);
        toast({ title: "Lead Added", description: `${companyName} added to telemarketing list.` });

        setCompanyName('');
        setLocation('');
        setPhone('');
        setContactName('');
        setNotes('');
        setIsSearching(false);
    };
    
    const handleClose = () => {
        setCompanyName('');
        setLocation('');
        setPhone('');
        setContactName('');
        setNotes('');
        if (recognitionRef.current) recognitionRef.current.stop();
        onClose();
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="sm:max-w-xl h-[85vh] flex flex-col p-0 overflow-hidden bg-card border-2 border-primary/20 shadow-2xl">
                <DialogHeader className="p-6 pb-2 border-b bg-muted/20">
                    <DialogTitle className="text-3xl font-black aurora-text flex items-center gap-3 tracking-tighter">
                        <UserPlus className="h-8 w-8 text-primary" /> Telemarketing Hot Leads
                    </DialogTitle>
                </DialogHeader>
                
                <ScrollArea className="flex-1 p-6">
                    <div className="space-y-8 pb-10">
                        <div className="space-y-5 bg-primary/5 p-6 rounded-2xl border-2 border-primary/10 shadow-inner">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-wider text-primary">Company Name</Label>
                                    <div className="relative">
                                        <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="pr-10 bg-background font-bold h-11" placeholder="Lead Business Name" />
                                        <Button type="button" variant="ghost" size="icon" onClick={() => handleToggleVoice('company')} className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8">
                                            <Mic className={cn("h-4 w-4", recordingField === 'company' ? "text-red-500 animate-pulse" : "text-muted-foreground")} />
                                        </Button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-wider text-primary">Market/Location</Label>
                                    <div className="relative">
                                        <Input value={location} onChange={(e) => setLocation(e.target.value)} className="pr-10 bg-background font-bold h-11" placeholder="City, State" />
                                        <Button type="button" variant="ghost" size="icon" onClick={() => handleToggleVoice('location')} className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8">
                                            <Mic className={cn("h-4 w-4", recordingField === 'location' ? "text-red-500 animate-pulse" : "text-muted-foreground")} />
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-wider text-primary">Phone Number</Label>
                                    <div className="relative">
                                        <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="pr-10 bg-background font-bold h-11" placeholder="(555) 000-0000" />
                                        <Button type="button" variant="ghost" size="icon" onClick={() => handleToggleVoice('phone')} className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8">
                                            <Mic className={cn("h-4 w-4", recordingField === 'phone' ? "text-red-500 animate-pulse" : "text-muted-foreground")} />
                                        </Button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-wider text-primary">Contact Name</Label>
                                    <div className="relative">
                                        <Input value={contactName} onChange={(e) => setContactName(e.target.value)} className="pr-10 bg-background font-bold h-11" placeholder="Who are we calling?" />
                                        <Button type="button" variant="ghost" size="icon" onClick={() => handleToggleVoice('contact')} className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8">
                                            <Mic className={cn("h-4 w-4", recordingField === 'contact' ? "text-red-500 animate-pulse" : "text-muted-foreground")} />
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-wider text-primary">Lead Notes & Context</Label>
                                <div className="relative">
                                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="pr-10 min-h-[100px] bg-background text-sm leading-relaxed" placeholder="Decision maker details, pain points, or previous call context..." />
                                    <Button type="button" variant="ghost" size="icon" onClick={() => handleToggleVoice('notes')} className="absolute right-1 top-2 h-8 w-8">
                                        <Mic className={cn("h-4 w-4", recordingField === 'notes' ? "text-red-500 animate-pulse" : "text-muted-foreground")} />
                                    </Button>
                                </div>
                            </div>

                            <Button onClick={handleSearch} disabled={isSearching || !!recordingField} className="w-full h-12 rounded-full font-black text-lg bg-primary hover:bg-primary/90 shadow-xl transition-all">
                                {isSearching ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
                                Save to Telemarketing Pipeline
                            </Button>
                        </div>

                        {hotLeads.length > 0 && (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between border-b-2 border-primary/10 pb-2">
                                    <h3 className="text-xl font-black flex items-center gap-3 tracking-tight">
                                        <ClipboardList className="h-6 w-6 text-primary" /> Active Pipeline ({hotLeads.length})
                                    </h3>
                                    <ExportHotLeadsPdfButton hotLeads={hotLeads} size="sm" />
                                </div>
                                <Accordion type="multiple" className="space-y-4">
                                    {hotLeads.map((lead) => {
                                        const isConverted = convertedHotLeads.has(lead.id);
                                        return (
                                            <AccordionItem value={lead.id} key={lead.id} className="border-2 border-primary/5 rounded-2xl overflow-hidden bg-card/50 hover:border-primary/20 transition-all">
                                                <AccordionTrigger className="px-5 py-4 hover:no-underline">
                                                    <div className="flex flex-col items-start text-left">
                                                        <span className="font-black text-lg">{lead.companyName}</span>
                                                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{lead.city}</span>
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent className="px-5 pb-5 space-y-4">
                                                    <div className="grid grid-cols-1 gap-3 text-sm pt-2">
                                                        {lead.phone !== 'N/A' && <div className="flex items-center gap-2 font-bold"><Phone className="h-4 w-4 text-primary" /> {lead.phone}</div>}
                                                        <div className="bg-muted/40 p-4 rounded-xl text-xs leading-relaxed whitespace-pre-wrap border border-primary/5 italic">
                                                            {lead.notes || 'No context notes provided.'}
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2 pt-2 border-t border-primary/5">
                                                        <Button variant={isConverted ? "outline" : "default"} size="sm" className="flex-1 font-bold h-10 rounded-full" onClick={() => onAddHotLeadAsVisit(lead)} disabled={isConverted}>
                                                            {isConverted ? <CheckCircle className="mr-2 h-4 w-4" /> : <PlusSquare className="mr-2 h-4 w-4" />}
                                                            {isConverted ? 'Added to Day' : 'Add to Field Day'}
                                                        </Button>
                                                        <Button variant="destructive" size="icon" onClick={() => onDeleteHotLead(lead.id)} className="h-10 w-10 rounded-full">
                                                            <Trash2 className="h-5 w-5" />
                                                        </Button>
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        );
                                    })}
                                </Accordion>
                            </div>
                        )}
                    </div>
                </ScrollArea>
                
                <DialogFooter className="p-4 border-t bg-muted/20">
                    <Button variant="outline" onClick={handleClose} className="w-full h-11 rounded-full font-bold">Done</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}