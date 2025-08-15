
'use client';

import type { Visit, Salesperson } from '@/lib/types';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getCompanyNameFromCoordsAction, type SaveVisitPayload, extractVisitDetailsAction } from '@/app/actions';
import { useEffect, useState, useRef, useCallback } from 'react';
import { Loader2, Star, UserCircle, Mic, Trash2, PlusSquare, PackageCheck, Droplets, CalendarCheck, Camera as CameraIcon, Calendar as CalendarIcon, ScanLine, MapPin, DollarSign, Clock, CheckCircle2, Save, X, Edit, Navigation, CalendarX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from "@/components/ui/checkbox"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, addDays } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Image from 'next/image';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from '@/hooks/use-toast';
import { Badge } from './ui/badge';


const COMPETITORS_LIST = [
  "Aramark",
  "Atlantic Pure",
  "Blue Drop",
  "Boston Bean",
  "Cintas",
  "Cleartide",
  "Crown Coffee",
  "Crystal Rock",
  "Culligan-Quench",
  "ELKAY Wall Unit",
  "Monadnock",
  "Ready Refresh/Primo",
  "WB Mason",
  "Other",
];

const DEFAULT_COOLER_TYPES_LIST = [
  "Standard Bottle Cooler",
  "Bottle-Free Cooler (POU)",
  "Countertop Cooler",
  "Under-Sink Chiller",
  "Specialty Cooler (e.g., sparkling)",
  "None Observed",
  "Other",
];

const CULLIGAN_QUENCH_COOLERS = [
  "Wellsys 9000",
  "Wellsys 11000",
  "W9",
  "Wellsys 12000",
  "I14",
  "I15",
  "I16",
  "Quench Brand Cooler",
  "Waterlogic Cooler",
  "Ion Series Cooler (Legacy)",
  "None Observed",
  "Other"
];

const COMPETITOR_SPECIFIC_COOLER_OPTIONS: Record<string, string[]> = {
  "Culligan-Quench": CULLIGAN_QUENCH_COOLERS,
  "Ready Refresh/Primo": ["Oasis - filter cooler", "Bottles", "None Observed", "Other"],
  "Blue Drop": ["Brio", "None Observed", "Other"],
  "WB Mason": ["Oasis - filter cooler", "Bottles", "None Observed", "Other"],
  "Atlantic Pure": ["W9", "i14", "i15", "i16", "None Observed", "Other"],
  "Cleartide": ["W9", "i14", "i15", "i16", "None Observed", "Other"],
  "Boston Bean": ["Ion 200", "Ion 400", "Alpine", "None Observed", "Other"],
  "Crown Coffee": ["Ion 200", "Ion 400", "None Observed", "Other"],
  "Aramark": ["Alpine", "None Observed", "Other"],
  "Cintas": ["Waterlogic", "Oasis", "None Observed", "Other"],
  "Crystal Rock": ["Bottles", "None Observed", "Other"],
  "ELKAY Wall Unit": ["Wall Unit", "None Observed", "Other"],
};

const OUR_COOLERS_LIST = [
  "PW50",
  "PW70",
  "PW90CT",
  "PW90",
  "XL1",
  "E6",
  "I14",
  "I15",
  "I16",
  "3i",
];

const COOLER_PRICING_MAP: Record<string, number> = {
  "PW50": 39.99,
  "PW70": 49.99,
  "PW90CT": 59.99,
  "PW90": 59.99,
  "XL1": 69.99,
  "E6": 79.99,
  "I14": 99.99,
  "I15": 119.99,
  "I16": 129.99,
  "3i": 129.99,
};


const visitFormSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  city: z.string().optional(),
  notes: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  partnershipConfidence: z.number().min(1).max(5).optional(),
  hasBusinessCard: z.boolean().optional(),
  businessCardImageFrontUrl: z.string().url("Must be a valid URL.").optional().nullable(),
  businessCardImageBackUrl: z.string().url("Must be a valid URL.").optional().nullable(),
  competitorName: z.string().optional(),
  coolerType: z.string().optional(),
  decisionMakerName: z.string().optional(),
  decisionMakerTitle: z.string().optional(),
  decisionMakerContact: z.string().optional(),
  interestedUnits: z.array(z.string()).optional(),
  hasTDSReading: z.boolean().optional(),
  tdsValue: z.coerce.number().min(0, "TDS value must be 0 or greater.").max(1500, "TDS value must be 1500 or less.").optional(),
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

export type VisitFormData = z.infer<typeof visitFormSchema>;

interface VisitFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: SaveVisitPayload, options?: { andClose?: boolean; expandOnClose?: boolean; }) => Promise<Visit>;
  initialData?: Visit;
  salesperson: Salesperson | null;
  startDictationOnOpen?: boolean;
  isFutureVisit?: boolean;
}

const buildVisitPayload = (data: VisitFormData, visitState: Visit | undefined, currentLatitude?: number, currentLongitude?: number): SaveVisitPayload => {
  let notesSummaryToSave = visitState?.notesSummary;
  // If notes have changed, the summary is no longer valid and should be regenerated.
  if (visitState?.notes !== data.notes) {
    notesSummaryToSave = undefined;
  }

  return {
    id: visitState?.id,
    timestamp: visitState?.timestamp,
    companyName: data.companyName,
    city: data.city,
    notes: data.notes,
    latitude: currentLatitude,
    longitude: currentLongitude,
    partnershipConfidence: data.partnershipConfidence,
    hasBusinessCard: data.hasBusinessCard,
    businessCardImageFrontUrl: data.hasBusinessCard ? data.businessCardImageFrontUrl : null,
    businessCardImageBackUrl: data.hasBusinessCard ? data.businessCardImageBackUrl : null,
    discussedCompetitors: !!data.competitorName,
    competitorName: data.competitorName,
    coolerType: data.competitorName ? data.coolerType : undefined,
    decisionMakerName: data.decisionMakerName,
    decisionMakerTitle: data.decisionMakerTitle,
    decisionMakerContact: data.decisionMakerContact,
    interestedUnits: (data.partnershipConfidence && data.partnershipConfidence >= 4) ? data.interestedUnits : [],
    hasTDSReading: data.hasTDSReading,
    tdsValue: data.hasTDSReading ? data.tdsValue : undefined,
    futureMeetingSet: data.futureMeetingSet,
    futureMeetingDateTime: data.futureMeetingSet ? data.futureMeetingDateTime : undefined,
    freeTrial: data.freeTrial,
    freeTrialStartDate: data.freeTrial ? data.freeTrialStartDate : undefined,
    dealClosed: visitState?.dealClosed,
    pricingDiscussed: data.pricingDiscussed,
    priceQuoted: data.pricingDiscussed ? data.priceQuoted : undefined,
    leaseTerm: data.pricingDiscussed ? data.leaseTerm : undefined,
    installationFee: data.pricingDiscussed ? data.installationFee : undefined,
    creditApproved: data.creditApproved,
    manualCommission: data.manualCommission,
    visitNumber: visitState?.visitNumber,
    contactInfo: visitState?.contactInfo,
    notesSummary: notesSummaryToSave,
  };
};

const AddressModal = ({ isOpen, onClose, onSaveAddress }: {
  isOpen: boolean;
  onClose: () => void;
  onSaveAddress: (address: { street: string; city: string; state: string; zip: string; }) => void;
}) => {
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');

  const handleSubmit = () => {
    onSaveAddress({ street, city, state, zip });
    onClose();
  };
  
  const handleClose = () => {
    // Reset fields on close
    setStreet('');
    setCity('');
    setState('');
    setZip('');
    onClose();
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enter Address Manually</DialogTitle>
          <DialogDescription>
            Input the address details below. This will be added to the visit notes.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="street-address" className="text-right">
              Street
            </Label>
            <Input id="street-address" value={street} onChange={(e) => setStreet(e.target.value)} className="col-span-3" placeholder="e.g., 123 Main St" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="city" className="text-right">
              City
            </Label>
            <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} className="col-span-3" placeholder="e.g., Boston" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="state" className="text-right">
              State
            </Label>
            <Input id="state" value={state} onChange={(e) => setState(e.target.value)} className="col-span-3" placeholder="e.g., MA" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="zip" className="text-right">
              Zip Code
            </Label>
            <Input id="zip" value={zip} onChange={(e) => setZip(e.target.value)} className="col-span-3" placeholder="e.g., 02108" />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
          <Button type="button" onClick={handleSubmit}>Save Address</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const VisitForm: React.FC<VisitFormProps> = ({ isOpen, onClose, onSave, initialData, salesperson, startDictationOnOpen, isFutureVisit }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [isSuggestingCompany, setIsSuggestingCompany] = useState(false);
  const [isEditingCompanyName, setIsEditingCompanyName] = useState(true);

  const [currentLatitude, setCurrentLatitude] = useState<number | undefined>(initialData?.latitude);
  const [currentLongitude, setCurrentLongitude] = useState<number | undefined>(initialData?.longitude);
  const [hoveredStars, setHoveredStars] = useState<number | undefined>(undefined);
  const confidenceStarsRef = useRef<HTMLDivElement>(null);

  const [isRecordingNotes, setIsRecordingNotes] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [isAnalyzingNotes, setIsAnalyzingNotes] = useState(false);

  const [isRecordingCompanyName, setIsRecordingCompanyName] = useState(false);
  const companyNameRecognitionRef = useRef<SpeechRecognition | null>(null);

  const [businessCardFrontPreviewUrl, setBusinessCardFrontPreviewUrl] = useState<string | null>(null);
  const [businessCardBackPreviewUrl, setBusinessCardBackPreviewUrl] = useState<string | null>(null);
  const [isCapturingBack, setIsCapturingBack] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentCoolerOptions, setCurrentCoolerOptions] = useState<string[]>(DEFAULT_COOLER_TYPES_LIST);
  const [customCoolerNameInput, setCustomCoolerNameInput] = useState('');
  const [openAccordion, setOpenAccordion] = useState<string[]>([]);
  const [isCoolerSelectOpen, setIsCoolerSelectOpen] = useState(false);

  const [isUploadingCard, setIsUploadingCard] = useState(false);
  const [isCameraViewVisible, setIsCameraViewVisible] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentCity, setCurrentCity] = useState<string | null>(null);
  const [isFetchingCity, setIsFetchingCity] = useState(false);
  const { toast } = useToast();
  const [lastAnalyzedNotes, setLastAnalyzedNotes] = useState<string | undefined>(undefined);
  const [formInitialData, setFormInitialData] = useState<Visit | undefined>(initialData);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);


  const form = useForm<VisitFormData>({
    resolver: zodResolver(visitFormSchema),
    defaultValues: {
      companyName: '',
      city: '',
      notes: '',
      latitude: undefined,
      longitude: undefined,
      partnershipConfidence: undefined,
      hasBusinessCard: false,
      businessCardImageFrontUrl: null,
      businessCardImageBackUrl: null,
      competitorName: undefined,
      coolerType: undefined,
      decisionMakerName: '',
      decisionMakerTitle: '',
      decisionMakerContact: '',
      interestedUnits: [],
      hasTDSReading: false,
      tdsValue: undefined,
      futureMeetingSet: false,
      futureMeetingDateTime: undefined,
      freeTrial: false,
      freeTrialStartDate: undefined,
      pricingDiscussed: false,
      priceQuoted: undefined,
      leaseTerm: undefined,
      installationFee: undefined,
      creditApproved: false,
      manualCommission: undefined,
    },
  });

  const handleFormSubmit = async (data: VisitFormData) => {
    setIsSaving(true);
    const payload = buildVisitPayload(data, formInitialData, currentLatitude, currentLongitude);
    try {
      await onSave(payload, { andClose: true });
    } catch (error) {
      toast({ variant: "destructive", title: "Error Saving", description: "An unexpected error occurred during the save operation." });
    } finally {
        setIsSaving(false);
    }
  };

  const saveProgress = useCallback(async (): Promise<Visit | undefined> => {
    const isValid = await form.trigger("companyName");
    if (!isValid) {
        toast({ variant: 'destructive', title: 'Company Name Required', description: 'Please enter a company name to save progress.' });
        return undefined;
    }

    setIsSaving(true);
    const data = form.getValues();
    const payload = buildVisitPayload(data, formInitialData, currentLatitude, currentLongitude);
    
    try {
        const savedVisit = await onSave(payload, { andClose: false });
        setFormInitialData(savedVisit);
        toast({ title: "Progress Saved", description: "Your changes have been saved to the device." });
        return savedVisit;
    } catch (error) {
        toast({ variant: "destructive", title: "Error Saving Progress", description: "Could not save changes." });
        return undefined;
    } finally {
        setIsSaving(false);
    }
  }, [form, toast, formInitialData, currentLatitude, currentLongitude, onSave]);

  const handleSaveAndView = useCallback(async (): Promise<void> => {
    const isValid = await form.trigger("companyName");
    if (!isValid) {
      toast({ variant: 'destructive', title: 'Company Name Required', description: 'Please enter a company name before saving.' });
      return;
    }
    
    setIsSaving(true);
    const data = form.getValues();
    const payload = buildVisitPayload(data, formInitialData, currentLatitude, currentLongitude);

    try {
      await onSave(payload, { andClose: true, expandOnClose: true });
    } catch (error) {
      toast({ variant: "destructive", title: "Error Saving", description: "An unexpected error occurred during the save." });
    } finally {
      setIsSaving(false);
    }
  }, [form, toast, formInitialData, currentLatitude, currentLongitude, onSave]);

  const interestedUnitsValue = form.watch('interestedUnits');

  useEffect(() => {
    const pricingDiscussedValue = form.watch('pricingDiscussed');
    if (pricingDiscussedValue) {
      const units = interestedUnitsValue || [];
      const totalPrice = units.reduce((sum, unitName) => {
        return sum + (COOLER_PRICING_MAP[unitName] || 0);
      }, 0);

      if (totalPrice > 0) {
        form.setValue('priceQuoted', totalPrice, { shouldDirty: true });
      } else {
        // If no units are selected, don't force a price of 0
        const currentPrice = form.getValues('priceQuoted');
        if (currentPrice === 0) {
           form.setValue('priceQuoted', undefined, { shouldDirty: true });
        }
      }
    }
  }, [interestedUnitsValue, form.watch('pricingDiscussed'), form]);


  const handleRemoveImage = useCallback((side: 'front' | 'back') => {
    if (side === 'front') {
        setBusinessCardFrontPreviewUrl(null);
        form.setValue('businessCardImageFrontUrl', null, { shouldValidate: true });
    } else {
        setBusinessCardBackPreviewUrl(null);
        form.setValue('businessCardImageBackUrl', null, { shouldValidate: true });
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setIsCameraViewVisible(false);
  }, [form]);
  
  const uploadImage = useCallback(async (file: File, side: 'front' | 'back') => {
    setIsUploadingCard(true);
    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = `Upload failed with status ${response.status}.`;
        try {
            const errorData = await response.json();
            errorMessage = errorData.details || errorData.message || errorMessage;
        } catch (e) {
             errorMessage = `Upload failed: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      if (side === 'front') {
        form.setValue('businessCardImageFrontUrl', result.url, { shouldValidate: true });
        setBusinessCardFrontPreviewUrl(result.url);
      } else {
        form.setValue('businessCardImageBackUrl', result.url, { shouldValidate: true });
        setBusinessCardBackPreviewUrl(result.url);
      }
      toast({ title: "Image Uploaded", description: `Business card ${side} is ready to be saved with the visit.` });
    } catch (error: any) {
      toast({ variant: 'destructive', title: "Upload Failed", description: error.message });
      handleRemoveImage(side);
    } finally {
      setIsUploadingCard(false);
    }
  }, [form, toast, handleRemoveImage]);


  const handleSuggestCompany = useCallback(async (lat: number, lon: number) => {
    setIsSuggestingCompany(true);
    try {
        const result = await getCompanyNameFromCoordsAction({ latitude: lat, longitude: lon });
        
        if (result.error) {
            throw new Error(result.error);
        }
        
        if (result.suggestedCompanyName && result.suggestedCompanyName.trim() !== '') {
            form.setValue('companyName', result.suggestedCompanyName, { shouldValidate: true });
            setIsEditingCompanyName(false);
        } else {
            toast({ variant: "destructive", title: "No Company Found", description: "Could not identify a company at this location." });
        }
        if (result.phone) form.setValue('decisionMakerContact', result.phone, { shouldValidate: true });
        if (result.city) form.setValue('city', result.city, { shouldValidate: true });
        if (result.address) {
            const currentNotes = form.getValues('notes') || '';
            const addressNote = `Company Address: ${result.address}`;
            if (!currentNotes.includes(addressNote)) {
              const newNotes = `${addressNote}\n\n${currentNotes}`;
              form.setValue('notes', newNotes.trim().replace(/\\n/g, '\n'), { shouldValidate: true });
            }
        }
        if (result.city) setCurrentCity(result.city);

    } catch (error: any) {
        toast({ variant: "destructive", title: "Could Not Find Company", description: error.message || "An unexpected error occurred." });
    } finally {
        setIsSuggestingCompany(false);
    }
  }, [form, setCurrentCity, toast]);
  
  const handleFindButtonClick = useCallback(() => {
    if (!navigator.geolocation) {
      toast({ variant: "destructive", title: "Geolocation Not Supported", description: "Your browser does not support this feature." });
      return;
    }
    
    setIsSuggestingCompany(true);
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        
        setCurrentLatitude(lat);
        setCurrentLongitude(lon);
        form.setValue('latitude', lat, { shouldValidate: true });
        form.setValue('longitude', lon, { shouldValidate: true });
        
        handleSuggestCompany(lat, lon);
      },
      (error) => {
        setIsSuggestingCompany(false);
        let errorMessage = "Could not retrieve location.";
        if (error.code === error.PERMISSION_DENIED) {
          errorMessage = "Location access denied. Please enable it in your browser settings.";
        }
        toast({ variant: "destructive", title: "Location Error", description: errorMessage });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [handleSuggestCompany, toast, form]);

  const stopCameraStream = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  }, []);
  
  useEffect(() => {
    if (isOpen) {
      setFormInitialData(initialData);
      form.reset({
        companyName: initialData?.companyName || '',
        city: initialData?.city || '',
        notes: initialData?.notes || '',
        latitude: initialData?.latitude ?? undefined,
        longitude: initialData?.longitude ?? undefined,
        partnershipConfidence: initialData?.partnershipConfidence ?? undefined,
        hasBusinessCard: initialData?.hasBusinessCard || false,
        businessCardImageFrontUrl: initialData?.businessCardImageFrontUrl || null,
        businessCardImageBackUrl: initialData?.businessCardImageBackUrl || null,
        competitorName: initialData?.competitorName || undefined,
        coolerType: initialData?.coolerType || undefined,
        decisionMakerName: initialData?.decisionMakerName || '',
        decisionMakerTitle: initialData?.decisionMakerTitle || '',
        decisionMakerContact: initialData?.decisionMakerContact || '',
        interestedUnits: initialData?.interestedUnits || [],
        hasTDSReading: initialData?.hasTDSReading || false,
        tdsValue: initialData?.tdsValue ?? undefined,
        futureMeetingSet: initialData?.futureMeetingSet || false,
        futureMeetingDateTime: initialData?.futureMeetingDateTime ? new Date(initialData.futureMeetingDateTime) : undefined,
        freeTrial: initialData?.freeTrial || false,
        freeTrialStartDate: initialData?.freeTrialStartDate ? new Date(initialData.freeTrialStartDate) : undefined,
        pricingDiscussed: initialData?.pricingDiscussed || false,
        priceQuoted: initialData?.priceQuoted ?? undefined,
        leaseTerm: initialData?.leaseTerm ?? undefined,
        installationFee: initialData?.installationFee ?? undefined,
        creditApproved: initialData?.creditApproved || false,
        manualCommission: initialData?.manualCommission ?? undefined,
      });

      setLastAnalyzedNotes(initialData?.notes);
      setIsEditingCompanyName(!initialData?.id || !initialData.companyName);
      
      setCurrentLatitude(initialData?.latitude ?? undefined);
      setCurrentLongitude(initialData?.longitude ?? undefined);
      setBusinessCardFrontPreviewUrl(initialData?.businessCardImageFrontUrl || null);
      setBusinessCardBackPreviewUrl(initialData?.businessCardImageBackUrl || null);
      setCustomCoolerNameInput('');
      setIsCameraViewVisible(false);
      setHasCameraPermission(null);
      setCurrentCity(null);
    }
  }, [initialData, isOpen, form]);

  useEffect(() => {
    const watchedCompetitorName = form.watch('competitorName');
    let baseOptions = watchedCompetitorName && COMPETITOR_SPECIFIC_COOLER_OPTIONS[watchedCompetitorName]
      ? [...COMPETITOR_SPECIFIC_COOLER_OPTIONS[watchedCompetitorName]]
      : [...DEFAULT_COOLER_TYPES_LIST];

    if (!baseOptions.includes('Other')) {
        baseOptions.push('Other');
    }

    if (initialData?.coolerType && !baseOptions.includes(initialData.coolerType)) {
        const otherIndex = baseOptions.indexOf('Other');
        if (otherIndex !== -1) {
            baseOptions.splice(otherIndex, 0, initialData.coolerType);
        } else {
            baseOptions.push(initialData.coolerType);
        }
    }
    setCurrentCoolerOptions(baseOptions);
  }, [form.watch('competitorName'), initialData, isOpen]);

  const analyzeNotesAndPopulateForm = useCallback(async (notes: string, upToDateVisit: Visit) => {
    if (!notes.trim()) return;

    setLastAnalyzedNotes(notes);
    setIsAnalyzingNotes(true);
    const analysisToast = toast({
      title: "Debbie is analyzing your notes...",
      description: "Please wait while I extract the details.",
    });

    try {
        const result = await extractVisitDetailsAction({ notes, currentDate: new Date().toISOString().split('T')[0] });
        if (result.error) throw new Error(result.error);
        if (!result.details) {
            toast({ title: "AI Analysis Complete", description: "No new details found in notes." });
            setIsAnalyzingNotes(false);
            analysisToast.dismiss();
            return;
        }

        const { details } = result;
        const currentFormValues = form.getValues();
        const updatedData: VisitFormData = { ...currentFormValues };
        let fieldsUpdatedCount = 0;
        let meetingScheduled = false;

        const updateField = <T extends keyof VisitFormData>(field: T, value: VisitFormData[T] | undefined) => {
            if (value === undefined || value === null) return;
            const currentValue = updatedData[field];
            if (JSON.stringify(currentValue) !== JSON.stringify(value)) {
                 // @ts-ignore
                updatedData[field] = value;
                form.setValue(field, value as any, { shouldValidate: true });
                fieldsUpdatedCount++;
            }
        };
        
        // This logic was changed to be more careful with updates
        if (details.futureMeetingDateTime) {
            const meetingDate = new Date(details.futureMeetingDateTime);
            if (meetingDate.toString() !== 'Invalid Date') {
                updateField('futureMeetingSet', true);
                updateField('futureMeetingDateTime', meetingDate);
                meetingScheduled = true;
            }
        } else if (details.futureMeetingSet) {
             if (updatedData.futureMeetingSet !== true) {
               updateField('futureMeetingSet', true);
             }
        }

        updateField('hasBusinessCard', details.hasBusinessCard);
        updateField('competitorName', details.competitorName);
        updateField('decisionMakerName', details.decisionMakerName);
        updateField('decisionMakerTitle', details.decisionMakerTitle);
        if (details.interestedUnits && details.interestedUnits.length > 0) {
            updateField('interestedUnits', details.interestedUnits);
        }
        updateField('freeTrial', details.freeTrial);

        if (fieldsUpdatedCount > 0) {
            const payload = buildVisitPayload(updatedData, upToDateVisit, currentLatitude, currentLongitude);
            const savedVisit = await onSave(payload, { andClose: meetingScheduled });

            if (meetingScheduled) {
                onClose();
                toast({
                    title: "Meeting Auto-Scheduled!",
                    description: `I've scheduled the meeting for ${updatedData.companyName}. Your data has been saved.`,
                    duration: 7000,
                });
            } else {
                setFormInitialData(savedVisit); // Update form state for next save
                toast({
                    title: "AI Analysis Complete",
                    description: `I've updated ${fieldsUpdatedCount} field(s) from your notes and saved progress.`,
                });
            }
        } else {
            toast({ title: "AI Analysis Complete", description: "No new details to update from your notes." });
        }
    } catch (e: any) {
        toast({
            variant: "destructive",
            title: "AI Analysis Failed",
            description: e.message || "Could not extract details from notes.",
        });
    } finally {
        setIsAnalyzingNotes(false);
        analysisToast.dismiss();
    }
  }, [form, toast, onSave, onClose, currentLatitude, currentLongitude]);

  const handleToggleVoiceCompanyName = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({ variant: 'destructive', title: 'Voice Recognition Not Supported', description: 'Your browser does not support this feature. This can sometimes be caused by browser extensions or specific browser settings (e.g., in Firefox).' });
      return;
    }

    if (isRecordingCompanyName && companyNameRecognitionRef.current) {
      companyNameRecognitionRef.current.stop();
      return;
    }

    const recognition = new SpeechRecognition();
    companyNameRecognitionRef.current = recognition;
    
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsRecordingCompanyName(true);
      toast({ title: 'Listening for Company Name...' });
    };

    recognition.onend = () => {
      setIsRecordingCompanyName(false);
      companyNameRecognitionRef.current = null;
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      let errorMessage = `An unknown error occurred (code: ${event.error}).`;
      switch (event.error) {
        case 'no-speech':
          errorMessage = "No speech was detected. Please make sure your microphone is working and try again.";
          break;
        case 'not-allowed':
        case 'service-not-allowed':
          errorMessage = "Microphone access denied. Please check your browser's site permissions and ensure no other application is using the microphone.";
          break;
        case 'audio-capture':
          errorMessage = "Could not capture audio. Please check your microphone connection and system settings.";
          break;
        case 'network':
          errorMessage = "A network error occurred. Speech recognition may require an internet connection.";
          break;
        case 'aborted':
          console.log("Speech recognition aborted.");
          setIsRecordingCompanyName(false);
          companyNameRecognitionRef.current = null;
          return;
        case 'language-not-supported':
          errorMessage = "The language for dictation is not supported by your browser.";
          break;
        case 'bad-grammar':
           errorMessage = "There was a grammar recognition error. This is usually an issue with the recognition service.";
           break;
      }
      
      toast({ variant: 'destructive', title: 'Voice Recognition Error', description: errorMessage, duration: 9000 });
      setIsRecordingCompanyName(false);
      companyNameRecognitionRef.current = null;
    };

    recognition.onresult = (event) => {
      if (event.results && event.results.length > 0 && event.results[0].length > 0) {
          const transcript = event.results[0][0].transcript;
          if (transcript) {
            form.setValue('companyName', transcript, { shouldValidate: true });
            toast({ title: 'Company Name Updated' });
            saveProgress();
          }
      } else {
        console.warn("Speech recognition returned a result with no transcript.");
      }
    };
    
    try {
        recognition.start();
    } catch(e: any) {
        toast({ variant: 'destructive', title: 'Could not start recording', description: `Please ensure microphone access is granted. Error: ${e.message}` });
    }
  }, [form, isRecordingCompanyName, toast, saveProgress]);

  const handleToggleVoiceNotes = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({ variant: 'destructive', title: 'Voice Recognition Not Supported', description: 'Your browser does not support this feature. This can sometimes be caused by browser extensions or specific browser settings (e.g., in Firefox).' });
      return;
    }

    if (isRecordingNotes && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }
    
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsRecordingNotes(true);
      toast({ title: 'Listening...', description: 'Click the microphone again to stop.' });
    };

    recognition.onend = () => {
      setIsRecordingNotes(false);
      recognitionRef.current = null;
      
      setTimeout(() => {
        saveProgress().then((savedVisit) => {
          if (savedVisit) {
            const finalNotes = form.getValues('notes');
            if (finalNotes && finalNotes.trim() && finalNotes !== lastAnalyzedNotes) {
                analyzeNotesAndPopulateForm(finalNotes, savedVisit);
            }
          }
        });
      }, 500);
    };

    recognition.onresult = (event) => {
      let newTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          newTranscript += event.results[i][0].transcript + ' ';
        }
      }
    
      if (newTranscript) {
        const currentNotes = form.getValues('notes') || '';
        const newNotes = currentNotes.trim() ? `${currentNotes}\n${newTranscript.trim()}` : `\n${newTranscript.trim()}`;
        form.setValue('notes', newNotes, { shouldValidate: true });
        toast({ title: 'Notes Updated' });
      }
    };
    
    try {
        recognition.start();
    } catch(e: any) {
        toast({ variant: 'destructive', title: 'Could not start recording', description: `Please ensure microphone access is granted. Error: ${e.message}` });
    }
  }, [form, isRecordingNotes, toast, analyzeNotesAndPopulateForm, lastAnalyzedNotes, saveProgress]);


  useEffect(() => {
    if (isOpen && startDictationOnOpen) {
      const timer = setTimeout(() => {
        handleToggleVoiceNotes();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isOpen, startDictationOnOpen, handleToggleVoiceNotes]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    const enableCamera = async () => {
      if (isCameraViewVisible && videoRef.current) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
          setHasCameraPermission(true);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(playError => console.error("Error playing video:", playError));
          }
        } catch (error) {
          console.error('Error accessing camera:', error);
          setHasCameraPermission(false);
          setIsCameraViewVisible(false);
        }
      }
    };

    enableCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [isCameraViewVisible]);

  const handleTakeLater = () => {
    const currentNotes = form.getValues('notes') || '';
    const reminderText = "\n\n[REMINDER: Take photo of front and back of business card.]";

    if (!currentNotes.includes(reminderText.trim())) {
        form.setValue('notes', (currentNotes + reminderText).trim(), { shouldValidate: true });
        toast({ title: "Reminder Added", description: "A note was added to photograph the card later." });
    } else {
        toast({ title: "Reminder Already Exists", description: "The business card reminder is already in your notes." });
    }
    form.setValue('hasBusinessCard', false);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, side: 'front' | 'back') => {
    const file = event.target.files?.[0];
    if (file) {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        toast({ variant: "destructive", title: "Invalid File Type", description: "Please select a valid image file (JPG, PNG, GIF, WEBP)." });
        return;
      }
      if (file.size > 10 * 1024 * 1024) { // 10MB client-side limit
        toast({ variant: "destructive", title: "File Too Large", description: "Please select an image smaller than 10MB." });
        return;
      }
      uploadImage(file, side);
      setIsCameraViewVisible(false);
      stopCameraStream();
    }
  };

  const handleToggleCameraView = (side: 'front' | 'back') => {
    if (isCameraViewVisible) {
      stopCameraStream();
      setIsCameraViewVisible(false);
    } else {
      if (side === 'front') {
        setBusinessCardFrontPreviewUrl(null);
        form.setValue('businessCardImageFrontUrl', null, {shouldValidate: true});
      } else {
        setBusinessCardBackPreviewUrl(null);
        form.setValue('businessCardImageBackUrl', null, {shouldValidate: true});
      }
      if (fileInputRef.current) {
         fileInputRef.current.value = '';
      }
      setIsCapturingBack(side === 'back');
      setIsCameraViewVisible(true);
    }
  };

  const handleCaptureImage = useCallback(() => {
    if (videoRef.current && canvasRef.current && hasCameraPermission) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUri = canvas.toDataURL('image/jpeg', 0.9);
        
        fetch(dataUri)
          .then(res => res.blob())
          .then(blob => {
            const side = isCapturingBack ? 'back' : 'front';
            const imageFile = new File([blob], `business-card-${side}.jpg`, { type: "image/jpeg" });
            uploadImage(imageFile, side);
            toast({ title: "Image Captured", description: `Business card ${side} captured from camera.` });
          })
          .catch(err => {
              toast({ variant: "destructive", title: "Capture Failed", description: "Could not process captured image for upload." });
          });
      }
      setIsCameraViewVisible(false);
      stopCameraStream();
    } else {
        toast({ variant: "destructive", title: "Capture Error", description: "Camera not ready or permission denied." });
    }
  }, [hasCameraPermission, uploadImage, toast, isCapturingBack, stopCameraStream]);


  const handleAddCustomCooler = () => {
    const newName = customCoolerNameInput.trim();
    if (newName && !currentCoolerOptions.includes(newName)) {
        const otherIndex = currentCoolerOptions.indexOf('Other');
        let updatedOptions;
        if (otherIndex !== -1) {
            updatedOptions = [
                ...currentCoolerOptions.slice(0, otherIndex),
                newName,
                ...currentCoolerOptions.slice(otherIndex)
            ];
        } else {
            updatedOptions = [...currentCoolerOptions, newName, 'Other'];
        }
        setCurrentCoolerOptions(updatedOptions);
        form.setValue('coolerType', newName, { shouldValidate: true });
        setCustomCoolerNameInput('');
        toast({ title: "Custom Cooler Added", description: `${newName} added to options and selected.` });
    } else if (newName && currentCoolerOptions.includes(newName)) {
        form.setValue('coolerType', newName, { shouldValidate: true });
        setCustomCoolerNameInput('');
        toast({ title: "Cooler Selected", description: `${newName} selected.` });
    } else {
        toast({ variant: "destructive", title: "Invalid Name", description: "Please enter a cooler name." });
    }
  };
  
  useEffect(() => {
    const stopAudioAndCamera = () => {
        if (recognitionRef.current) recognitionRef.current.stop();
        if (companyNameRecognitionRef.current) companyNameRecognitionRef.current.stop();
        stopCameraStream();
    };

    if (!isOpen) {
        stopAudioAndCamera();
        setBusinessCardFrontPreviewUrl(null);
        setBusinessCardBackPreviewUrl(null);
        setCustomCoolerNameInput('');
        setIsCameraViewVisible(false);
    }

    return () => stopAudioAndCamera();
  }, [isOpen, stopCameraStream]);
  
  const handleSaveManualAddress = (address: { street: string; city: string; state: string; zip: string; }) => {
    const formattedAddress = `${address.street}, ${address.city}, ${address.state} ${address.zip}`;
    const addressNote = `Company Address: ${formattedAddress}`;
    
    const currentNotes = form.getValues('notes') || '';
    const newNotes = `${addressNote}\n\n${currentNotes}`;
    form.setValue('notes', newNotes.trim(), { shouldValidate: true });

    if (address.city && address.state) {
      const cityState = `${address.city}, ${address.state}`;
      form.setValue('city', cityState, { shouldValidate: true });
    }

    toast({ title: "Address Added", description: "The address has been saved to the visit notes." });
  };
  
  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="sm:max-w-[480px] bg-card/80 backdrop-blur-md border-primary/30">
          <DialogHeader>
            <DialogTitle className="font-headline text-primary">
              {initialData?.id && !isFutureVisit ? 'Edit Potential Partner' : 'New Potential Partner'}
            </DialogTitle>
            <DialogDescription className="text-foreground/80">
              {initialData?.id && !isFutureVisit ? 'Update the details of this potential partner.' : 'Mention the free trial!'}
            </DialogDescription>
          </DialogHeader>
          
          {isFetchingCity && (
              <div className="flex items-center text-sm text-muted-foreground p-2 -my-2">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Determining current city...
              </div>
          )}
          {currentCity && !isFetchingCity && (
              <div className="font-semibold text-lg text-primary flex items-center p-2 -my-2">
                  <MapPin className="mr-2 h-5 w-5" />
                  {currentCity}
              </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-2">
              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name</FormLabel>
                    <FormControl>
                      {isEditingCompanyName ? (
                        <div className="flex items-center gap-2">
                          <div className="relative flex-grow">
                            <Input
                              placeholder="e.g., Acme Corp"
                              {...field}
                              className={cn(field.value && 'pr-9')}
                            />
                            {field.value && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  form.setValue('companyName', '', { shouldValidate: true });
                                  form.setFocus('companyName');
                                }}
                                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                                aria-label="Clear company name"
                              >
                                <X className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={handleToggleVoiceCompanyName}
                            className="h-9 w-9"
                            aria-label="Dictate company name"
                          >
                            {isRecordingCompanyName ? (
                              <Mic className="h-4 w-4 text-red-500 animate-pulse" />
                            ) : (
                              <Mic className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                          <Button
                              type="button"
                              onClick={handleFindButtonClick}
                              variant="outline"
                              size="sm"
                              disabled={isSuggestingCompany || isSaving}
                          >
                            {isSuggestingCompany ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Find'}
                          </Button>
                        </div>
                      ) : (
                        <div 
                          className="flex items-center justify-between gap-2 min-h-[40px] rounded-md border border-input bg-background px-3 py-2 cursor-pointer group"
                          onClick={() => setIsEditingCompanyName(true)}
                        >
                          <p className="font-bold text-base text-foreground">{field.value}</p>
                          <Edit className="h-4 w-4 text-muted-foreground opacity-50 group-hover:opacity-100 transition-opacity" />
                        </div>
                      )}
                    </FormControl>
                    
                    <div className="flex flex-col gap-2 pt-1">
                      <Button
                          type="button"
                          variant="secondary"
                          className="w-full"
                          onClick={handleSaveAndView}
                          disabled={isSaving || isSuggestingCompany || !form.watch('companyName')}
                      >
                          <Save className="mr-2 h-4 w-4" />
                          Save & View
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => setIsAddressModalOpen(true)}
                      >
                        <MapPin className="mr-2 h-4 w-4" />
                        Enter Address Manually
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="partnershipConfidence"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Partnership Confidence</FormLabel>
                    <FormControl>
                      <div ref={confidenceStarsRef} tabIndex={-1} className="flex items-center gap-1 mt-1 outline-none" onMouseLeave={() => setHoveredStars(undefined)}>
                        {[1, 2, 3, 4, 5].map((starValue) => {
                          const isFilled = starValue <= (hoveredStars ?? field.value ?? 0);
                          return (
                            <Star
                              key={starValue}
                              className={cn(
                                "h-6 w-6 cursor-pointer transition-colors",
                                isFilled ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground hover:text-yellow-300"
                              )}
                              onClick={() => {
                                field.onChange(starValue)
                                if (starValue < 4) {
                                  form.setValue('interestedUnits', []);
                                }
                              }}
                              onMouseEnter={() => setHoveredStars(starValue)}
                            />
                          );
                        })}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {form.watch('partnershipConfidence') && form.watch('partnershipConfidence')! >= 4 && (
                <FormField
                  control={form.control}
                  name="interestedUnits"
                  render={({ field }) => (
                    <FormItem className="space-y-2 rounded-md border border-accent p-3 shadow-sm bg-background/10">
                      <FormLabel className="flex items-center">
                        <PackageCheck className="mr-2 h-5 w-5 text-primary" /> Potential Units of Interest
                      </FormLabel>
                      <div className="flex flex-wrap gap-2">
                          {field.value?.map((unit, index) => (
                              <Badge key={index} variant="secondary" className="text-sm">
                                  {unit}
                                  <button type="button" onClick={() => field.onChange(field.value?.filter(u => u !== unit))} className="ml-2 rounded-full p-0.5 hover:bg-destructive/20"><X className="h-3 w-3"/></button>
                              </Badge>
                          ))}
                      </div>
                      <Select
                        onValueChange={(value) => {
                          if (value && !field.value?.includes(value)) {
                              field.onChange([...(field.value || []), value]);
                          }
                        }}
                        value={''}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Add a cooler..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {OUR_COOLERS_LIST.filter(c => !field.value?.includes(c)).map((cooler) => (
                            <SelectItem key={cooler} value={cooler}>
                              {cooler}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}


              <FormField
                control={form.control}
                name="hasBusinessCard"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border border-accent p-3 shadow-sm">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(checked) => {
                          queueMicrotask(() => {
                            field.onChange(checked);
                            if (!checked) {
                                handleRemoveImage('front');
                                handleRemoveImage('back');
                            }
                          });
                        }}
                        id="hasBusinessCard"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel htmlFor="hasBusinessCard" className="cursor-pointer font-normal">
                        Business Card Collected?
                      </FormLabel>
                    </div>
                  </FormItem>
                )}
              />

              {form.watch('hasBusinessCard') && (
                <FormItem className="space-y-2 rounded-md border border-accent p-3 shadow-sm bg-background/10">
                  <FormLabel htmlFor="businessCardImage">Business Card Image</FormLabel>
                  
                  {isUploadingCard && (
                      <div className="flex items-center justify-center gap-2 text-muted-foreground p-4">
                          <Loader2 className="h-6 w-6 animate-spin" />
                          <span>Uploading image...</span>
                      </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Card Front */}
                    <div className="space-y-2">
                      <FormLabel className="text-xs">Front</FormLabel>
                      {(businessCardFrontPreviewUrl && !isUploadingCard) && (
                        <div className="relative w-full aspect-[1.6/1] group">
                          <Image
                            src={businessCardFrontPreviewUrl}
                            alt="Business card front preview"
                            data-ai-hint="business card professional"
                            fill
                            style={{ objectFit: 'contain' }}
                            className="rounded-md border"
                          />
                          <Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => handleRemoveImage('front')}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      )}
                      {!businessCardFrontPreviewUrl && (
                        <div className="flex items-center gap-2">
                          <Input id="businessCardImageFront" type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'front')} className="flex-grow" ref={fileInputRef} disabled={isCameraViewVisible || isUploadingCard} />
                          <Button type="button" onClick={() => handleToggleCameraView('front')} variant="outline" size="icon" className="bg-accent hover:bg-accent/90 shrink-0" disabled={isUploadingCard}><CameraIcon className="h-4 w-4 text-black" /></Button>
                        </div>
                      )}
                    </div>
                     {/* Card Back */}
                     <div className="space-y-2">
                       <FormLabel className="text-xs">Back</FormLabel>
                       {(businessCardBackPreviewUrl && !isUploadingCard) && (
                        <div className="relative w-full aspect-[1.6/1] group">
                          <Image
                            src={businessCardBackPreviewUrl}
                            alt="Business card back preview"
                            data-ai-hint="business card professional"
                            fill
                            style={{ objectFit: 'contain' }}
                            className="rounded-md border"
                          />
                          <Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => handleRemoveImage('back')}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      )}
                       {!businessCardBackPreviewUrl && (
                        <div className="flex items-center gap-2">
                           <Input id="businessCardImageBack" type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'back')} className="flex-grow" disabled={isCameraViewVisible || isUploadingCard} />
                           <Button type="button" onClick={() => handleToggleCameraView('back')} variant="outline" size="icon" className="bg-accent hover:bg-accent/90 shrink-0" disabled={isUploadingCard}><CameraIcon className="h-4 w-4 text-black" /></Button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-2 flex items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleTakeLater}
                      disabled={isUploadingCard}
                    >
                      <ScanLine className="mr-2 h-4 w-4" />
                      Genius Scan
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleTakeLater}
                      disabled={isUploadingCard}
                    >
                      <Clock className="mr-2 h-4 w-4" />
                      Take Later
                    </Button>
                  </div>

                  {isCameraViewVisible && (
                    <div className="mt-2 space-y-2">
                      {hasCameraPermission === false && (
                         <Alert variant="destructive">
                            <AlertTitle>Camera Access Denied</AlertTitle>
                            <AlertDescription>
                              Please allow camera access in your browser settings to use this feature. You might need to refresh the page after granting permission.
                            </AlertDescription>
                          </Alert>
                      )}
                      <video
                          ref={videoRef}
                          className={cn("w-full aspect-video rounded-md bg-muted border", { 'hidden': hasCameraPermission === false })}
                          muted
                          playsInline
                      />
                      {hasCameraPermission && (
                          <Button type="button" onClick={handleCaptureImage} className="w-full">
                              <CameraIcon className="mr-2 h-4 w-4" /> Capture {isCapturingBack ? 'Back' : 'Front'}
                          </Button>
                      )}
                    </div>
                  )}
                  <canvas ref={canvasRef} className="hidden"></canvas>

                  <FormDescription>
                    Upload an image of the business card. The file will be stored securely.
                  </FormDescription>
                  <FormMessage>{form.formState.errors.businessCardImageFrontUrl?.message}</FormMessage>
                </FormItem>
              )}

              <FormField
                control={form.control}
                name="hasTDSReading"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border border-accent p-3 shadow-sm">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        id="hasTDSReading"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel htmlFor="hasTDSReading" className="cursor-pointer font-normal">
                        TDS Reading Taken?
                      </FormLabel>
                    </div>
                  </FormItem>
                )}
              />

              {form.watch('hasTDSReading') && (
                <FormField
                  control={form.control}
                  name="tdsValue"
                  render={({ field }) => (
                    <FormItem className="space-y-2 rounded-md border border-accent p-3 shadow-sm bg-background/10">
                      <FormLabel htmlFor="tdsValue" className="flex items-center">
                        <Droplets className="mr-2 h-5 w-5 text-primary" /> TDS Value (0-1500)
                      </FormLabel>
                      <FormControl>
                        <Input
                          id="tdsValue"
                          type="number"
                          placeholder="Enter TDS value"
                          {...field}
                          ref={field.ref}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === "" ? undefined : e.target.value
                            )
                          }
                          value={field.value === undefined ? "" : field.value}
                        />
                      </FormControl>
                      <FormDescription>
                        Enter the Total Dissolved Solids reading.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              
              <FormField
                control={form.control}
                name="freeTrial"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border border-accent p-3 shadow-sm">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(checked) => {
                           queueMicrotask(() => {
                            field.onChange(checked);
                            if (checked === true) {
                                const startDate = form.getValues('freeTrialStartDate') || new Date();
                                const followUpDate = addDays(startDate, 7);
                                followUpDate.setHours(10, 0, 0, 0);
                                form.setValue('freeTrialStartDate', startDate, { shouldDirty: true });
                                form.setValue('futureMeetingSet', true, { shouldDirty: true });
                                form.setValue('futureMeetingDateTime', followUpDate, { shouldDirty: true });
                            }
                          });
                        }}
                        id="freeTrial"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel htmlFor="freeTrial" className="cursor-pointer font-normal flex items-center">
                        <PackageCheck className="mr-2 h-4 w-4 text-primary" /> Free Trial?
                      </FormLabel>
                    </div>
                  </FormItem>
                )}
              />

              {form.watch('freeTrial') && (
                 <FormField
                  control={form.control}
                  name="freeTrialStartDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col space-y-2 rounded-md border border-accent p-3 shadow-sm bg-background/10">
                      <FormLabel>Free Trial Start Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(new Date(field.value), "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value ? new Date(field.value) : undefined}
                            onSelect={field.onChange}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormDescription>A notification will be created to follow up one week after this date.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              
              <div className="space-y-3 pt-2 p-3 border border-accent rounded-md bg-background/10">
                  <Label className="font-medium text-base">Pricing</Label>
                  <FormField
                      control={form.control}
                      name="pricingDiscussed"
                      render={({ field }) => (
                          <FormItem className="space-y-3 rounded-md border border-accent p-3 shadow-inner">
                              <div className="flex flex-row items-center space-x-3 space-y-0">
                                  <FormControl>
                                       <Checkbox
                                          checked={field.value}
                                          onCheckedChange={(checked) => {
                                              queueMicrotask(() => {
                                                  field.onChange(checked);
                                                  if (checked) {
                                                      form.setValue('leaseTerm', 60, { shouldDirty: true });
                                                      form.setValue('installationFee', 149, { shouldDirty: true });

                                                      const units = form.getValues('interestedUnits') || [];
                                                      const totalPrice = units.reduce((sum, unitName) => sum + (COOLER_PRICING_MAP[unitName] || 0), 0);
                                                      if (totalPrice > 0) {
                                                          form.setValue('priceQuoted', totalPrice, { shouldDirty: true });
                                                      }

                                                  } else {
                                                      form.setValue('priceQuoted', undefined, { shouldDirty: true });
                                                      form.setValue('leaseTerm', undefined, { shouldDirty: true });
                                                      form.setValue('installationFee', undefined, { shouldDirty: true });
                                                      form.setValue('creditApproved', false, { shouldDirty: true });
                                                      form.setValue('manualCommission', undefined, { shouldDirty: true });
                                                  }
                                              });
                                          }}
                                          id="pricingDiscussed"
                                      />
                                  </FormControl>
                                  <FormLabel htmlFor="pricingDiscussed" className="cursor-pointer font-normal flex items-center">
                                      <DollarSign className="mr-2 h-4 w-4 text-primary" /> Pricing
                                  </FormLabel>
                              </div>
                              {form.watch('pricingDiscussed') && (
                                  <div className="pl-8 pt-3 space-y-4 animate-in fade-in-0 zoom-in-95 border-t border-border">
                                      <FormField
                                          control={form.control}
                                          name="priceQuoted"
                                          render={({ field: priceField }) => (
                                              <FormItem>
                                                  <FormLabel>Price Quoted ($/mo)</FormLabel>
                                                  <div className="relative">
                                                      <FormControl>
                                                          <Input
                                                              type="number"
                                                              placeholder="e.g., 49.99"
                                                              step="0.01"
                                                              {...priceField}
                                                              value={priceField.value ?? ''}
                                                              onChange={(e) => priceField.onChange(e.target.value === '' ? undefined : e.target.value)}
                                                              className={cn(priceField.value !== undefined && 'pr-9')}
                                                          />
                                                      </FormControl>
                                                      {priceField.value !== undefined && (
                                                          <Button type="button" variant="ghost" size="icon" onClick={() => priceField.onChange(undefined)} className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"><X className="h-4 w-4 text-muted-foreground" /></Button>
                                                      )}
                                                  </div>
                                                  <FormMessage />
                                              </FormItem>
                                          )}
                                      />
                                      <FormField
                                          control={form.control}
                                          name="leaseTerm"
                                          render={({ field: leaseField }) => (
                                              <FormItem>
                                                  <FormLabel>Lease Term (months)</FormLabel>
                                                  <Select
                                                      onValueChange={(value) => leaseField.onChange(Number(value))}
                                                      value={leaseField.value ? String(leaseField.value) : undefined}
                                                  >
                                                      <FormControl>
                                                          <SelectTrigger>
                                                              <SelectValue placeholder="Select a lease term" />
                                                          </SelectTrigger>
                                                      </FormControl>
                                                      <SelectContent>
                                                          <SelectItem value="36">36 Months</SelectItem>
                                                          <SelectItem value="48">48 Months</SelectItem>
                                                          <SelectItem value="60">60 Months</SelectItem>
                                                      </SelectContent>
                                                  </Select>
                                                  <FormMessage />
                                              </FormItem>
                                          )}
                                      />
                                      <FormField
                                          control={form.control}
                                          name="installationFee"
                                          render={({ field: feeField }) => (
                                              <FormItem>
                                                  <FormLabel>Installation Fee ($)</FormLabel>
                                                  <div className="relative">
                                                      <FormControl>
                                                          <Input
                                                              type="number"
                                                              placeholder="e.g., 199"
                                                              step="1"
                                                              {...feeField}
                                                              value={feeField.value ?? ''}
                                                              onChange={(e) => feeField.onChange(e.target.value === '' ? undefined : e.target.value)}
                                                              className={cn(feeField.value !== undefined && 'pr-9')}
                                                          />
                                                      </FormControl>
                                                      {feeField.value !== undefined && (
                                                          <Button type="button" variant="ghost" size="icon" onClick={() => feeField.onChange(undefined)} className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"><X className="h-4 w-4 text-muted-foreground" /></Button>
                                                      )}
                                                  </div>
                                                  <FormMessage />
                                              </FormItem>
                                          )}
                                      />
                                      <FormField
                                          control={form.control}
                                          name="manualCommission"
                                          render={({ field: commissionField }) => (
                                              <FormItem>
                                                  <FormLabel>Manual Commission Override ($)</FormLabel>
                                                  <div className="relative">
                                                      <FormControl>
                                                          <Input
                                                              type="number"
                                                              placeholder="e.g., 129"
                                                              step="1"
                                                              {...commissionField}
                                                              value={commissionField.value ?? ''}
                                                              onChange={(e) => commissionField.onChange(e.target.value === '' ? undefined : e.target.value)}
                                                              className={cn(commissionField.value !== undefined && 'pr-9')}
                                                          />
                                                      </FormControl>
                                                      {commissionField.value !== undefined && (
                                                          <Button type="button" variant="ghost" size="icon" onClick={() => commissionField.onChange(undefined)} className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"><X className="h-4 w-4 text-muted-foreground" /></Button>
                                                      )}
                                                  </div>
                                                  <FormDescription>
                                                    If a customer is not credit approved, enter one month's commission here. This will override the standard calculation.
                                                  </FormDescription>
                                                  <FormMessage />
                                              </FormItem>
                                          )}
                                      />
                                  </div>
                              )}
                          </FormItem>
                      )}
                  />
                  <FormField
                      control={form.control}
                      name="creditApproved"
                      render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border border-accent p-3 shadow-sm">
                              <FormControl>
                                  <Checkbox
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      id="creditApproved"
                                  />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                  <FormLabel htmlFor="creditApproved" className="cursor-pointer font-normal flex items-center">
                                      <CheckCircle2 className="mr-2 h-4 w-4 text-primary" /> Credit Approved?
                                  </FormLabel>
                              </div>
                          </FormItem>
                      )}
                  />
              </div>

              <FormField
                control={form.control}
                name="futureMeetingSet"
                render={({ field }) => (
                  <FormItem className="rounded-md border border-accent p-3 shadow-sm">
                    <div className="flex flex-row items-center space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          id="futureMeetingSet"
                          disabled={form.watch('freeTrial')}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel htmlFor="futureMeetingSet" className={cn("font-normal flex items-center", form.watch('freeTrial') ? "cursor-not-allowed text-muted-foreground" : "cursor-pointer")}>
                          <CalendarCheck className="mr-2 h-4 w-4 text-primary" /> Future Meeting Set?
                        </FormLabel>
                      </div>
                    </div>
                    {form.watch('freeTrial') && (
                        <FormDescription className="pt-2">
                            This is automatically scheduled based on the free trial.
                        </FormDescription>
                    )}
                  </FormItem>
                )}
              />

              {(form.watch('futureMeetingSet') || form.watch('freeTrial')) && (
                <FormField
                  control={form.control}
                  name="futureMeetingDateTime"
                  render={({ field }) => (
                    <FormItem className="flex flex-col space-y-2 rounded-md border border-accent p-3 shadow-sm bg-background/10">
                      <FormLabel>Meeting Date & Time</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                               disabled={form.watch('freeTrial')}
                            >
                              {field.value ? (
                                format(new Date(field.value), "PPP 'at' h:mm a")
                              ) : (
                                <span>Not yet scheduled</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value ? new Date(field.value) : undefined}
                            onSelect={(date) => {
                              if (!date) {
                                field.onChange(undefined);
                                return;
                              }
                              const newDateTime = new Date(date);
                              const existingTime = field.value ? new Date(field.value) : new Date();
                              
                              newDateTime.setHours(field.value ? existingTime.getHours() : 9);
                              newDateTime.setMinutes(field.value ? existingTime.getMinutes() : 0);
                              newDateTime.setSeconds(0);
                              newDateTime.setMilliseconds(0);
                              
                              field.onChange(newDateTime);
                            }}
                            disabled={(date) =>
                              date < new Date(new Date().setDate(new Date().getDate() - 1))
                            }
                            initialFocus
                          />
                          <div className="p-3 border-t border-border">
                            <div className="flex items-center gap-2">
                              <Label htmlFor="hours">Time</Label>
                              <Select
                                disabled={!field.value}
                                value={field.value ? String(new Date(field.value).getHours()) : '9'}
                                onValueChange={(value) => {
                                  if (!field.value) return;
                                  const newDate = new Date(field.value);
                                  newDate.setHours(parseInt(value));
                                  field.onChange(newDate);
                                }}
                              >
                                <SelectTrigger id="hours" className="w-[80px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: 12 }, (_, i) => i + 8).map(hour => (
                                     <SelectItem key={hour} value={String(hour)}>{String(hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour)).padStart(2, '0')} {hour < 12 || hour === 24 ? 'AM' : 'PM'}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              :
                              <Select
                                disabled={!field.value}
                                value={field.value ? String(new Date(field.value).getMinutes()).padStart(2, '0') : '00'}
                                 onValueChange={(value) => {
                                  if (!field.value) return;
                                  const newDate = new Date(field.value);
                                  newDate.setMinutes(parseInt(value));
                                  field.onChange(newDate);
                                }}
                              >
                                <SelectTrigger className="w-[80px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="00">00</SelectItem>
                                  <SelectItem value="15">15</SelectItem>
                                  <SelectItem value="30">30</SelectItem>
                                  <SelectItem value="45">45</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="p-2 border-t border-border flex justify-end">
                              <Button
                                  type="button"
                                  variant="ghost"
                                  onClick={() => field.onChange(undefined)}
                                  className="text-sm h-8"
                              >
                                  Clear Date
                              </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <div className="space-y-3 pt-2 p-3 border border-accent rounded-md bg-background/10">
                <Label className="font-medium text-base">Competitor Name (If Noted)</Label>
                <FormField
                  control={form.control}
                  name="competitorName"
                  render={({ field }) => (
                    <FormItem>
                      <Select
                        onValueChange={(value) => {
                          if (value === '_none_') {
                            field.onChange(undefined);
                            form.setValue('coolerType', undefined);
                          } else {
                            field.onChange(value);
                          }
                        }}
                        value={field.value || '_none_'}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a competitor (if any)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="_none_">None</SelectItem>
                          {COMPETITORS_LIST.map((competitor) => (
                            <SelectItem key={competitor} value={competitor}>
                              {competitor}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {form.watch('competitorName') && (
                   <Accordion type="multiple" value={openAccordion} onValueChange={setOpenAccordion} className="w-full">
                      <AccordionItem value="cooler-type" className="border-b-0">
                          <AccordionTrigger className="p-0 hover:no-underline text-sm font-medium">Cooler Type Observed</AccordionTrigger>
                          <AccordionContent className="pt-2">
                             <FormField
                                control={form.control}
                                name="coolerType"
                                render={({ field }) => (
                                  <FormItem>
                                    <Select
                                      open={isCoolerSelectOpen}
                                      onOpenChange={setIsCoolerSelectOpen}
                                      onValueChange={(value) => {
                                        field.onChange(value);
                                        setIsCoolerSelectOpen(false);
                                      }}
                                      value={field.value || ''}
                                    >
                                      <FormControl>
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select Cooler Type" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        {currentCoolerOptions.map((type) => (
                                          <SelectItem key={type} value={type}>
                                            {type}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    {field.value === 'Other' && (
                                      <div className="mt-2 space-y-2 flex items-center gap-2">
                                        <Input
                                          placeholder="Enter custom cooler name"
                                          value={customCoolerNameInput}
                                          onChange={(e) => setCustomCoolerNameInput(e.target.value)}
                                          className="h-9 flex-grow"
                                        />
                                        <Button
                                          type="button"
                                          size="sm"
                                          onClick={handleAddCustomCooler}
                                          disabled={!customCoolerNameInput.trim()}
                                          className="h-9"
                                        >
                                          <PlusSquare className="mr-1 h-4 w-4" /> Add
                                        </Button>
                                      </div>
                                    )}
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                          </AccordionContent>
                      </AccordionItem>
                  </Accordion>
                )}
              </div>

              <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="dm-info" className="border border-accent rounded-md bg-background/10 p-3">
                      <AccordionTrigger className="p-0 hover:no-underline font-medium text-base">
                          Decision Maker Info (Optional)
                      </AccordionTrigger>
                      <AccordionContent className="pt-4">
                          <div className="space-y-3">
                             <FormField
                              control={form.control}
                              name="decisionMakerName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-sm font-normal">Name</FormLabel>
                                  <FormControl>
                                    <div className="relative">
                                      <Input 
                                        placeholder="e.g., Jane Doe" 
                                        {...field}
                                        className={cn(field.value && 'pr-9')}
                                      />
                                      {field.value && (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => field.onChange('')}
                                          className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                                          aria-label="Clear Name"
                                        >
                                          <X className="h-4 w-4 text-muted-foreground" />
                                        </Button>
                                      )}
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="decisionMakerTitle"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-sm font-normal">Title</FormLabel>
                                  <FormControl>
                                    <div className="relative">
                                      <Input 
                                        placeholder="e.g., Office Manager" 
                                        {...field}
                                        className={cn(field.value && 'pr-9')}
                                      />
                                      {field.value && (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => field.onChange('')}
                                          className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                                          aria-label="Clear Title"
                                        >
                                          <X className="h-4 w-4 text-muted-foreground" />
                                        </Button>
                                      )}
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="decisionMakerContact"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-sm font-normal">Contact (Email/Phone Ext.)</FormLabel>
                                  <FormControl>
                                    <div className="relative">
                                      <Input 
                                        placeholder="e.g., jane@example.com or x123" 
                                        {...field}
                                        className={cn(field.value && 'pr-9')}
                                      />
                                      {field.value && (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => field.onChange('')}
                                          className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                                          aria-label="Clear Contact Info"
                                        >
                                          <X className="h-4 w-4 text-muted-foreground" />
                                        </Button>
                                      )}
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                      </AccordionContent>
                  </AccordionItem>
              </Accordion>


              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center justify-between">
                      <span>Visit Notes</span>
                       <div className="flex items-center gap-1">
                          {isAnalyzingNotes && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                          <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => form.setValue('notes', '', { shouldValidate: true })}
                              className="h-7 w-7"
                              aria-label="Clear notes"
                              disabled={!field.value}
                          >
                              <X className="h-4 w-4 text-muted-foreground" />
                          </Button>
                         <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => saveProgress()}
                              className="h-7 w-7"
                              aria-label="Save and continue editing"
                          >
                              <Save className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={handleToggleVoiceNotes}
                              className="h-7 w-7"
                              aria-label={isRecordingNotes ? 'Stop dictating notes' : 'Dictate notes by voice'}
                          >
                              {isRecordingNotes ? (
                                  <Mic className="h-4 w-4 text-red-500 animate-pulse" />
                              ) : (
                                  <Mic className="h-4 w-4 text-muted-foreground" />
                              )}
                          </Button>
                       </div>
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Details about the visit, key discussion points, etc. You can also use the microphone to dictate notes."
                        className="mt-1 min-h-[100px]"
                        {...field}
                        onBlur={(e) => {
                          field.onBlur(e);
                          const currentNotes = form.getValues('notes');
                          if (currentNotes && currentNotes.trim() && currentNotes !== lastAnalyzedNotes) {
                             saveProgress().then((savedVisit) => {
                                if (savedVisit) {
                                    analyzeNotesAndPopulateForm(currentNotes, savedVisit);
                                }
                            });
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="pt-4">
                <Button type="submit" disabled={isSaving || isSuggestingCompany || isRecordingNotes || isRecordingCompanyName || isCameraViewVisible || isUploadingCard || isAnalyzingNotes} className="aurora-glow w-full">
                  {(isSaving || isSuggestingCompany || isUploadingCard || isAnalyzingNotes) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {(isRecordingNotes || isRecordingCompanyName) && <Mic className="mr-2 h-4 w-4 animate-pulse" /> }
                  {initialData?.id ? 'Save Changes & Close' : 'Log Meeting & Close'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <AddressModal isOpen={isAddressModalOpen} onClose={() => setIsAddressModalOpen(false)} onSaveAddress={handleSaveManualAddress} />
    </>
  );
};

export default VisitForm;
