'use client';

import type { Visit, Salesperson } from '@/lib/types';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { type SaveVisitPayload } from '@/app/actions';
import { useEffect, useState, useRef } from 'react';
import { Loader2, Star, Mic, Save, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';
import { Badge } from './ui/badge';
import { OUR_COOLERS_LIST } from '@/lib/cooler-pricing';

const visitFormSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  city: z.string().optional(),
  notes: z.string().optional(),
  partnershipConfidence: z.number().min(1).max(5).optional(),
  hasBusinessCard: z.boolean().optional(),
  competitorName: z.string().optional(),
  coolerType: z.string().optional(),
  decisionMakerName: z.string().optional(),
  decisionMakerTitle: z.string().optional(),
  decisionMakerContact: z.string().optional(),
  interestedUnits: z.array(z.string()).optional(),
  hasTDSReading: z.boolean().optional(),
  tdsValue: z.coerce.number().optional(),
  futureMeetingSet: z.boolean().optional(),
  futureMeetingDateTime: z.coerce.date().optional(),
  freeTrial: z.boolean().optional(),
  freeTrialStartDate: z.coerce.date().optional(),
  pricingDiscussed: z.boolean().optional(),
  priceQuoted: z.coerce.number().optional(),
  leaseTerm: z.coerce.number().optional(),
  installationFee: z.coerce.number().optional(),
  creditApproved: z.boolean().optional(),
  manualCommission: z.coerce.number().optional().nullable(),
});

type VisitFormData = z.infer<typeof visitFormSchema>;

interface VisitFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: SaveVisitPayload) => Promise<Visit>;
  initialData?: Visit;
  salesperson: Salesperson | null;
}

export default function VisitForm({ isOpen, onClose, onSave, initialData }: VisitFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isRecordingNotes, setIsRecordingNotes] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const { toast } = useToast();

  const form = useForm<VisitFormData>({
    resolver: zodResolver(visitFormSchema),
    defaultValues: {
      companyName: '',
      city: '',
      notes: '',
      partnershipConfidence: undefined,
      hasBusinessCard: false,
      interestedUnits: [],
    },
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({
        companyName: initialData?.companyName || '',
        city: initialData?.city || '',
        notes: initialData?.notes || '',
        partnershipConfidence: initialData?.partnershipConfidence ?? undefined,
        hasBusinessCard: initialData?.hasBusinessCard || false,
        competitorName: initialData?.competitorName || undefined,
        interestedUnits: initialData?.interestedUnits || [],
        hasTDSReading: initialData?.hasTDSReading || false,
        tdsValue: initialData?.tdsValue ?? undefined,
        futureMeetingSet: initialData?.futureMeetingSet || false,
        freeTrial: initialData?.freeTrial || false,
        pricingDiscussed: initialData?.pricingDiscussed || false,
        priceQuoted: initialData?.priceQuoted || undefined,
        installationFee: initialData?.installationFee || undefined,
      });
    }
  }, [initialData, isOpen, form]);

  const handleFormSubmit = async (data: VisitFormData) => {
    setIsSaving(true);
    try {
      await onSave({ ...data, id: initialData?.id, timestamp: initialData?.timestamp || new Date() } as any);
      onClose();
    } catch (e) {
      // toast handled in action
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleVoiceNotes = () => {
    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (isRecordingNotes) {
        recognitionRef.current?.stop();
        return;
    }

    const rec = new SpeechRecognition();
    recognitionRef.current = rec;
    rec.continuous = true;
    rec.onstart = () => setIsRecordingNotes(true);
    rec.onend = () => setIsRecordingNotes(false);
    rec.onresult = (e) => {
        const t = e.results[e.results.length - 1][0].transcript;
        form.setValue('notes', (form.getValues('notes') || '') + ' ' + t);
    };
    rec.start();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-hidden flex flex-col p-0 bg-card border-2 border-primary/20 shadow-2xl">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-3xl font-black aurora-text tracking-tighter">
            {initialData?.id && !initialData.id.startsWith('temp_') ? 'Update Visit Record' : 'Log Sales Interaction'}
          </DialogTitle>
          <DialogDescription className="font-medium">Capture the details of your latest business interaction.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
            <FormField control={form.control} name="companyName" render={({ field }) => (
                <FormItem><FormLabel className="font-bold uppercase tracking-wider text-[10px] text-primary">Company Name</FormLabel><FormControl><Input placeholder="Who did you visit?" className="h-12 bg-muted/30 border-primary/10 font-bold focus:border-primary/50" {...field} /></FormControl><FormMessage /></FormItem>
            )} />

            <FormField control={form.control} name="partnershipConfidence" render={({ field }) => (
                <FormItem><FormLabel className="font-bold uppercase tracking-wider text-[10px] text-primary">Deal Confidence</FormLabel>
                    <FormControl>
                        <div className="flex gap-2 pt-1">
                            {[1,2,3,4,5].map(s => (
                                <Star key={s} className={cn("h-10 w-10 cursor-pointer transition-all hover:scale-110", s <= (field.value || 0) ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/20")} onClick={() => field.onChange(s)} />
                            ))}
                        </div>
                    </FormControl>
                </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="city" render={({ field }) => (
                    <FormItem><FormLabel className="font-bold uppercase tracking-wider text-[10px] text-primary">City/Market</FormLabel><FormControl><Input placeholder="Portsmouth, NH" className="bg-muted/30" {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="hasTDSReading" render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-2 space-y-0 pt-8"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} className="h-5 w-5 border-primary/30" /></FormControl><FormLabel className="text-xs font-black uppercase">TDS Taken?</FormLabel></FormItem>
                )} />
            </div>

            {form.watch('hasTDSReading') && (
                <FormField control={form.control} name="tdsValue" render={({ field }) => (
                    <FormItem><FormLabel className="font-bold uppercase tracking-wider text-[10px] text-primary">TDS PPM Value</FormLabel><FormControl><Input type="number" placeholder="0" className="bg-muted/30" {...field} /></FormControl></FormItem>
                )} />
            )}

            <FormField control={form.control} name="interestedUnits" render={({ field }) => (
                <FormItem><FormLabel className="font-bold uppercase tracking-wider text-[10px] text-primary">Interested Units (Deals)</FormLabel>
                    <div className="flex flex-wrap gap-2 mb-3">
                        {field.value?.map(u => <Badge key={u} variant="secondary" className="gap-1 px-3 py-1 font-bold bg-primary/10 text-primary border-primary/20">{u} <X className="h-3 w-3 cursor-pointer hover:text-red-500" onClick={() => field.onChange(field.value?.filter(x => x !== u))} /></Badge>)}
                    </div>
                    <Select onValueChange={(v) => { if (!field.value?.includes(v)) field.onChange([...(field.value || []), v]); }}>
                        <FormControl><SelectTrigger className="h-10 bg-muted/30"><SelectValue placeholder="Add unit to deal..." /></SelectTrigger></FormControl>
                        <SelectContent className="bg-card border-2 border-primary/10">{OUR_COOLERS_LIST.map(c => <SelectItem key={c} value={c} className="font-bold">{c}</SelectItem>)}</SelectContent>
                    </Select>
                </FormItem>
            )} />

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between"><FormLabel className="font-bold uppercase tracking-wider text-[10px] text-primary">Visit Notes</FormLabel><Button type="button" variant="ghost" size="icon" onClick={handleToggleVoiceNotes} className={cn("transition-colors", isRecordingNotes ? "text-red-500 animate-pulse" : "text-muted-foreground")}><Mic className="h-4 w-4" /></Button></div>
                <FormControl><Textarea placeholder="Capture the vibe, needs, and obstacles..." className="min-h-[120px] rounded-xl bg-muted/30 border-primary/10 focus:border-primary/50 text-sm leading-relaxed" {...field} /></FormControl>
              </FormItem>
            )} />
            
            <div className="space-y-4 p-5 bg-primary/5 rounded-2xl border-2 border-primary/10">
                <Label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">Pricing & Terms</Label>
                <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="priceQuoted" render={({ field }) => <FormItem><FormLabel className="text-[9px] font-bold uppercase">Price/Mo</FormLabel><FormControl><Input type="number" className="bg-background font-bold" {...field} /></FormControl></FormItem>} />
                    <FormField control={form.control} name="installationFee" render={({ field }) => <FormItem><FormLabel className="text-[9px] font-bold uppercase">Install Fee</FormLabel><FormControl><Input type="number" className="bg-background font-bold" {...field} /></FormControl></FormItem>} />
                </div>
            </div>
          </form>
        </Form>

        <DialogFooter className="p-6 border-t bg-card">
          <Button type="button" onClick={form.handleSubmit(handleFormSubmit)} disabled={isSaving} className="w-full h-14 rounded-full font-black text-xl aurora-glow shadow-2xl transition-all hover:scale-[1.02]">
            {isSaving ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Save className="mr-2 h-6 w-6" />}
            {initialData?.id && !initialData.id.startsWith('temp_') ? 'Update Record' : 'Save Visit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}