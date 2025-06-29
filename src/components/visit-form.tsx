
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
import { getCompanyNameFromCoordsAction, type SaveVisitPayload } from '@/app/actions';
import { useEffect, useState, useRef, useCallback } from 'react';
import { Loader2, Star, UserCircle, Mic, MicOff, Trash2, PlusSquare, PackageCheck, Droplets, CalendarCheck, Camera as CameraIcon, Calendar as CalendarIcon, ScanLine, MapPin, DollarSign, Clock, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from "@/components/ui/checkbox"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Image from 'next/image';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";


const COMPETITORS_LIST = [
  "Aramark",
  "Atlantic Pure",
  "Blue Drop",
  "Boston Bean",
  "Cintas",
  "Cleartide",
  "Crown Coffee",
  "Culligan-Quench",
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
};

const OUR_COOLERS_LIST = [
  "Optimum Standard POU",
  "Optimum Enhanced POU (RO/UV)",
  "Optimum Countertop POU",
  "Optimum Floorstanding Ice & Water",
  "Optimum Countertop Ice & Water",
  "BEVI Smart Cooler (via Optimum)",
  "Sparkling Water Add-on",
  "Other (Specify in notes)",
];


const visitFormSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  notes: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  partnershipConfidence: z.number().min(1).max(5).optional(),
  hasBusinessCard: z.boolean().optional(),
  businessCardImageUrl: z.string().optional().nullable(), // Will store Data URI
  competitorName: z.string().optional(),
  coolerType: z.string().optional(),
  decisionMakerName: z.string().optional(),
  decisionMakerTitle: z.string().optional(),
  decisionMakerContact: z.string().optional(),
  interestedUnit: z.string().optional(),
  hasTDSReading: z.boolean().optional(),
  tdsValue: z.coerce.number().min(0, "TDS value must be 0 or greater.").max(1500, "TDS value must be 1500 or less.").optional(),
  futureMeetingSet: z.boolean().optional(),
  futureMeetingDateTime: z.coerce.date().optional(),
  freeTrial: z.boolean().optional(),
}).refine(data => {
  if (data.hasTDSReading && (data.tdsValue === undefined || data.tdsValue === null || isNaN(data.tdsValue))) {
    return false;
  }
  return true;
}, {
  message: "TDS value (0-1500) is required when TDS Reading is checked.",
  path: ["tdsValue"],
});

export type VisitFormData = z.infer<typeof visitFormSchema>;

interface VisitFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: SaveVisitPayload) => Promise<void>;
  initialData?: Visit;
  salesperson: Salesperson | null;
}

const VisitForm: React.FC<VisitFormProps> = ({ isOpen, onClose, onSave, initialData, salesperson }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [isSuggestingCompany, setIsSuggestingCompany] = useState(false);

  const [currentLatitude, setCurrentLatitude] = useState<number | undefined>(initialData?.latitude);
  const [currentLongitude, setCurrentLongitude] = useState<number | undefined>(initialData?.longitude);
  const [hoveredStars, setHoveredStars] = useState<number | undefined>(undefined);
  const confidenceStarsRef = useRef<HTMLDivElement>(null);

  const [isRecordingNotes, setIsRecordingNotes] = useState(false);
  const [hasMicPermission, setHasMicPermission] = useState<boolean | undefined>(undefined);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const [businessCardPreviewUrl, setBusinessCardPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tdsInputRef = useRef<HTMLInputElement>(null);
  const [currentCoolerOptions, setCurrentCoolerOptions] = useState<string[]>(DEFAULT_COOLER_TYPES_LIST);
  const [customCoolerNameInput, setCustomCoolerNameInput] = useState('');
  const [openAccordion, setOpenAccordion] = useState<string[]>([]);
  const [isCoolerSelectOpen, setIsCoolerSelectOpen] = useState(false);

  const [isCameraViewVisible, setIsCameraViewVisible] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | undefined>(undefined);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentCity, setCurrentCity] = useState<string | null>(null);
  const [isFetchingCity, setIsFetchingCity] = useState(false);


  const form = useForm<VisitFormData>({
    resolver: zodResolver(visitFormSchema),
    defaultValues: {
      companyName: '',
      notes: '',
      latitude: undefined,
      longitude: undefined,
      partnershipConfidence: undefined,
      hasBusinessCard: false,
      businessCardImageUrl: null,
      competitorName: undefined,
      coolerType: undefined,
      decisionMakerName: '',
      decisionMakerTitle: '',
      decisionMakerContact: '',
      interestedUnit: undefined,
      hasTDSReading: false,
      tdsValue: undefined,
      futureMeetingSet: false,
      futureMeetingDateTime: undefined,
      freeTrial: false,
    },
  });

  const hasBusinessCardValue = form.watch('hasBusinessCard');
  const watchedCompetitorName = form.watch('competitorName');
  const partnershipConfidenceValue = form.watch('partnershipConfidence');
  const hasTDSReadingValue = form.watch('hasTDSReading');
  const futureMeetingSetValue = form.watch('futureMeetingSet');

  const handleSuggestCompany = useCallback(async () => {
    setIsSuggestingCompany(true);

    const getFreshCoordinates = (): Promise<{ lat: number; lon: number }> => {
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("Geolocation is not supported."));
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (position) => resolve({ lat: position.coords.latitude, lon: position.coords.longitude }),
          (error) => {
            let message = "Could not retrieve location.";
            if (error.code === error.PERMISSION_DENIED) message = "Location access denied.";
            if (error.code === error.POSITION_UNAVAILABLE) message = "Location information is unavailable.";
            if (error.code === error.TIMEOUT) message = "Location request timed out.";
            reject(new Error(message));
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      });
    };

    try {
        const { lat, lon } = await getFreshCoordinates();

        // Update state and form with coordinates
        setCurrentLatitude(lat);
        setCurrentLongitude(lon);
        form.setValue('latitude', lat);
        form.setValue('longitude', lon);

        // Now, perform the company lookup
        const result = await getCompanyNameFromCoordsAction({ latitude: lat, longitude: lon });
        
        if (result.error) {
            throw new Error(result.error);
        }
        
        if (result.suggestedCompanyName && result.suggestedCompanyName.trim() !== '') {
            form.setValue('companyName', result.suggestedCompanyName, { shouldValidate: true });
        } else {
            console.warn("No Company Found", "Could not identify a company at this location.");
        }
        if (result.phone) form.setValue('decisionMakerContact', result.phone, { shouldValidate: true });
        if (result.address) {
            const currentNotes = form.getValues('notes') || '';
            const addressNote = `Suggested Address: ${result.address}`;
            if (!currentNotes.includes(addressNote)) {
              const newNotes = `${addressNote}\n\n${currentNotes}`;
              form.setValue('notes', newNotes.trim().replace(/\\n/g, '\n'), { shouldValidate: true });
            }
        }
        if (result.city) setCurrentCity(result.city);

    } catch (error: any) {
        console.error("Could Not Find Company", error.message || "An unexpected error occurred.");
    } finally {
        setIsSuggestingCompany(false);
    }
  }, [form, setCurrentCity]);


  useEffect(() => {
    if (hasTDSReadingValue) {
      // A small delay ensures the element is rendered and can be focused.
      const timer = setTimeout(() => {
        tdsInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [hasTDSReadingValue]);

  const stopCameraStream = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    if (watchedCompetitorName) {
      setOpenAccordion(['cooler-type']);
      // A small delay to allow the accordion to animate open before opening the select
      const timer = setTimeout(() => setIsCoolerSelectOpen(true), 250);
      return () => clearTimeout(timer);
    } else {
      setOpenAccordion([]);
      setIsCoolerSelectOpen(false);
    }
  }, [watchedCompetitorName]);

  const resetFormAndState = useCallback((data?: Visit) => {
    const defaultValues = {
      companyName: data?.companyName || '',
      notes: data?.notes || '',
      latitude: data?.latitude,
      longitude: data?.longitude,
      partnershipConfidence: data?.partnershipConfidence,
      hasBusinessCard: data?.hasBusinessCard || false,
      businessCardImageUrl: data?.businessCardImageUrl || null,
      competitorName: data?.competitorName || undefined,
      coolerType: data?.coolerType || undefined,
      decisionMakerName: data?.decisionMakerName || '',
      decisionMakerTitle: data?.decisionMakerTitle || '',
      decisionMakerContact: data?.decisionMakerContact || '',
      interestedUnit: data?.interestedUnit || undefined,
      hasTDSReading: data?.hasTDSReading || false,
      tdsValue: data?.tdsValue,
      futureMeetingSet: data?.futureMeetingSet || false,
      futureMeetingDateTime: data?.futureMeetingDateTime ? new Date(data.futureMeetingDateTime) : undefined,
      freeTrial: data?.freeTrial || false,
    };
    form.reset(defaultValues);
    setCurrentLatitude(data?.latitude);
    setCurrentLongitude(data?.longitude);
    setBusinessCardPreviewUrl(data?.businessCardImageUrl || null);
    setCustomCoolerNameInput('');
    setIsCameraViewVisible(false);
    setHasCameraPermission(undefined);
    setCurrentCity(null);
  }, [form]);

  useEffect(() => {
    if (isOpen) {
      resetFormAndState(initialData);

      // Auto-suggest company for a new visit initiated via Quicklog
      if (!initialData?.id && initialData?.latitude && initialData?.longitude) {
        handleSuggestCompany();
      }
    }
  }, [initialData, isOpen, resetFormAndState, handleSuggestCompany]);

  useEffect(() => {
    // When the form opens for a new Quicklog, focus the confidence stars
    // to prevent the keyboard from opening on mobile for the company name input.
    if (isOpen && !initialData?.id && initialData?.latitude && initialData?.longitude) {
      const timer = setTimeout(() => {
        confidenceStarsRef.current?.focus({ preventScroll: true });
      }, 100); // A small delay to ensure the element is focusable
      return () => clearTimeout(timer);
    }
  }, [isOpen, initialData]);

  useEffect(() => {
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
  }, [watchedCompetitorName, initialData, isOpen]);

  useEffect(() => {
    if (partnershipConfidenceValue && partnershipConfidenceValue < 4) {
      form.setValue('interestedUnit', undefined);
    }
  }, [partnershipConfidenceValue, form]);


  useEffect(() => {
    const stopAudioAndCamera = () => {
      // Stop audio recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (mediaRecorderRef.current?.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
      audioChunksRef.current = [];
      setIsRecordingNotes(false);

      // Stop camera stream
      stopCameraStream();
    };

    if (!isOpen) {
      stopAudioAndCamera();
      setBusinessCardPreviewUrl(null);
      setCustomCoolerNameInput('');
      setIsCameraViewVisible(false);
    }

    return () => {
      stopAudioAndCamera();
    };
  }, [isOpen]);

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
        console.log("Reminder Added", "A note was added to photograph the card later.");
    } else {
        console.log("Reminder Already Exists", "The business card reminder is already in your notes.");
    }
    // Uncheck the box to allow the user to "pass" this section
    form.setValue('hasBusinessCard', false);
  };


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUri = reader.result as string;
        setBusinessCardPreviewUrl(dataUri);
        form.setValue('businessCardImageUrl', dataUri, { shouldValidate: true });
      };
      reader.readAsDataURL(file);
      setIsCameraViewVisible(false);
      stopCameraStream();
    }
  };

  const handleRemoveImage = () => {
    setBusinessCardPreviewUrl(null);
    form.setValue('businessCardImageUrl', null, {shouldValidate: true});
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setIsCameraViewVisible(false);
    stopCameraStream();
  };

  const handleToggleCameraView = () => {
    if (isCameraViewVisible) {
      stopCameraStream();
      setIsCameraViewVisible(false);
    } else {
      setBusinessCardPreviewUrl(null);
      form.setValue('businessCardImageUrl', null, {shouldValidate: true});
      if (fileInputRef.current) {
         fileInputRef.current.value = '';
      }
      setIsCameraViewVisible(true);
    }
  };

  const handleCaptureImage = () => {
    if (videoRef.current && canvasRef.current && hasCameraPermission) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUri = canvas.toDataURL('image/jpeg', 0.9);
        setBusinessCardPreviewUrl(dataUri);
        form.setValue('businessCardImageUrl', dataUri, { shouldValidate: true });
        console.log("Image Captured", "Business card image captured from camera.");
      }
      handleToggleCameraView();
    } else {
        console.error("Capture Error", "Camera not ready or permission denied.");
    }
  };

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
        console.log("Custom Cooler Added", `${newName} added to options and selected.`);
    } else if (newName && currentCoolerOptions.includes(newName)) {
        form.setValue('coolerType', newName, { shouldValidate: true });
        setCustomCoolerNameInput('');
        console.log("Cooler Selected", `${newName} selected.`);
    } else {
        console.warn("Invalid Name", "Please enter a cooler name.");
    }
  };

  const handleFormSubmit = async (data: VisitFormData) => {
    setIsSaving(true);
    let finalNotes = data.notes || '';

    if (initialData?.timestamp && !initialData?.id) {
        const startTime = initialData.timestamp;
        const endTime = new Date();
        const durationMs = endTime.getTime() - startTime.getTime();
        const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const durationString = `Meeting duration: ${minutes} minute${minutes !== 1 ? 's' : ''}, ${seconds} second${seconds !== 1 ? 's' : ''}.`;
        
        const currentNotes = finalNotes.trim();
        finalNotes = currentNotes ? `${durationString}\n\n${currentNotes}` : durationString;
    }

    const finalBusinessCardImageUrl = data.hasBusinessCard ? data.businessCardImageUrl : undefined;

    const payload: SaveVisitPayload = {
      id: initialData?.id,
      companyName: data.companyName,
      notes: finalNotes,
      latitude: currentLatitude,
      longitude: currentLongitude,
      partnershipConfidence: data.partnershipConfidence,
      hasBusinessCard: data.hasBusinessCard,
      businessCardImageUrl: finalBusinessCardImageUrl,
      discussedCompetitors: !!data.competitorName,
      competitorName: data.competitorName,
      coolerType: data.competitorName ? data.coolerType : undefined,
      decisionMakerName: data.decisionMakerName,
      decisionMakerTitle: data.decisionMakerTitle,
      decisionMakerContact: data.decisionMakerContact,
      interestedUnit: (data.partnershipConfidence && data.partnershipConfidence >= 4) ? data.interestedUnit : undefined,
      hasTDSReading: data.hasTDSReading,
      tdsValue: data.hasTDSReading ? data.tdsValue : undefined,
      futureMeetingSet: data.futureMeetingSet,
      futureMeetingDateTime: data.futureMeetingSet ? data.futureMeetingDateTime : undefined,
      freeTrial: data.freeTrial,
      dealClosed: initialData?.dealClosed,
      originalCompanyName: initialData?.companyName,
      originalNotes: initialData?.notes,
      existingContactInfo: initialData?.contactInfo,
      existingNotesSummary: initialData?.notesSummary,
      originalBusinessCardImageUrl: initialData?.businessCardImageUrl,
      visitNumber: initialData?.visitNumber,
    };

    try {
      await onSave(payload);
      onClose();
    } catch (error) {
      console.error("Error during save operation:", error);
    } finally {
        setIsSaving(false);
    }
  };


  const handleNotesFocus = async () => {
    if (isRecordingNotes) return;
    if (hasMicPermission === false) {
      console.error("Microphone Access Denied: Please enable microphone permissions to record audio notes.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setHasMicPermission(true);
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorderRef.current?.mimeType || 'audio/webm' });
          console.log(`Audio Notes Recorded: Captured ${Math.round(audioBlob.size / 1024)} KB of audio. (Not saved with visit yet)`);
          audioChunksRef.current = [];
        }
        if (mediaRecorderRef.current?.stream) {
             mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
        setIsRecordingNotes(false);
      };

      mediaRecorderRef.current.start();
      setIsRecordingNotes(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setHasMicPermission(false);
    }
  };

  const handleNotesBlur = () => {
    if (isRecordingNotes && mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  };

  const handleGeniusScanClick = () => {
    if (typeof window !== 'undefined') {
      const isAndroid = /android/i.test(navigator.userAgent);
      
      console.log('Opening Genius Scan. After scanning, return here to upload the saved image from your photos.');

      if (isAndroid) {
        // This intent URL will try to open the app. If it fails, it will redirect to the Play Store.
        const geniusScanPackage = 'com.thegrizzlylabs.geniusscan.free';
        const playStoreUrl = `https://play.google.com/store/apps/details?id=${geniusScanPackage}`;
        const intentUrl = `intent://#Intent;package=${geniusScanPackage};S.browser_fallback_url=${encodeURIComponent(playStoreUrl)};end`;
        window.location.href = intentUrl;
      } else {
        // For iOS and others, the custom URL scheme is the standard way.
        window.open('geniusscan://', '_blank');
      }
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[480px] bg-card/80 backdrop-blur-md border-primary/30">
        <DialogHeader>
          <DialogTitle className="font-headline text-primary">
            {initialData?.id ? 'Edit Potential Partner' : 'New Potential Partner'}
          </DialogTitle>
          <DialogDescription className="text-foreground/80">
            {initialData?.id ? 'Update the details of this potential partner.' : 'Mention the free trial!'}
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
                    <div className="flex items-center gap-2">
                        <Input placeholder="e.g., Acme Corp" {...field} />
                        <Button
                            type="button"
                            onClick={() => handleSuggestCompany()}
                            variant="outline"
                            size="sm"
                            disabled={isSuggestingCompany}
                        >
                          {isSuggestingCompany ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Find'}
                        </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Button 
                type="button" 
                onClick={() => form.handleSubmit(handleFormSubmit)()}
                disabled={isSaving || isSuggestingCompany}
                className="w-full"
                size="sm"
            >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Quick Save
            </Button>


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
                            onClick={() => field.onChange(starValue)}
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

            {partnershipConfidenceValue && partnershipConfidenceValue >= 4 && (
              <div className="space-y-2">
                <Label>Data Gathered:</Label>
                <FormField
                  control={form.control}
                  name="interestedUnit"
                  render={({ field }) => (
                    <FormItem className="space-y-2 rounded-md border p-3 shadow-sm bg-background/10">
                      <FormLabel className="flex items-center">
                        <PackageCheck className="mr-2 h-5 w-5 text-primary" /> Potential Unit of Interest
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || ''}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a cooler they are interested in" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {OUR_COOLERS_LIST.map((cooler) => (
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
              </div>
            )}


            <FormField
              control={form.control}
              name="hasBusinessCard"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 shadow-sm">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(checked) => {
                        field.onChange(checked);
                        if (!checked) {
                           handleRemoveImage();
                        }
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

            {hasBusinessCardValue && (
              <FormItem className="space-y-2 rounded-md border p-3 shadow-sm bg-background/10">
                <FormLabel htmlFor="businessCardImage">Business Card Image</FormLabel>
                {(businessCardPreviewUrl || (initialData?.businessCardImageUrl && !form.getValues('businessCardImageUrl'))) && !isCameraViewVisible && (
                  <div className="mt-2 relative w-full aspect-[1.6/1] max-w-xs mx-auto group">
                    <Image
                      src={businessCardPreviewUrl || initialData!.businessCardImageUrl!}
                      alt="Business card preview"
                      data-ai-hint="business card professional"
                      fill
                      style={{ objectFit: 'contain' }}
                      className="rounded-md border"
                    />
                     <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={handleRemoveImage}
                        aria-label="Remove image"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                  </div>
                )}

                <div className="flex items-center gap-2 mt-2">
                    <Input
                      id="businessCardImage"
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="flex-grow"
                      ref={fileInputRef}
                      disabled={isCameraViewVisible}
                    />
                    <Button
                        type="button"
                        onClick={handleToggleCameraView}
                        variant="outline"
                        size="icon"
                        aria-label={isCameraViewVisible ? "Close Camera" : "Take Photo"}
                        className="bg-accent hover:bg-accent/90"
                    >
                        <CameraIcon className="h-4 w-4 text-black" />
                    </Button>
                </div>
                
                <div className="mt-2 flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleGeniusScanClick}
                  >
                    <ScanLine className="mr-2 h-4 w-4" />
                    Genius Scan
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleTakeLater}
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
                            <CameraIcon className="mr-2 h-4 w-4" /> Capture
                        </Button>
                    )}
                  </div>
                )}
                <canvas ref={canvasRef} className="hidden"></canvas>

                <FormDescription>
                  Upload an image or take a photo of the business card. Max 5MB (approx for Data URI).
                </FormDescription>
                <FormMessage>{form.formState.errors.businessCardImageUrl?.message}</FormMessage>
              </FormItem>
            )}

            <FormField
              control={form.control}
              name="hasTDSReading"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 shadow-sm">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(checked) => {
                        const booleanChecked = Boolean(checked);
                        field.onChange(booleanChecked);
                        if (!booleanChecked) {
                          form.setValue('tdsValue', undefined, { shouldValidate: true });
                        }
                      }}
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

            {hasTDSReadingValue && (
              <FormField
                control={form.control}
                name="tdsValue"
                render={({ field }) => (
                  <FormItem className="space-y-2 rounded-md border p-3 shadow-sm bg-background/10">
                    <FormLabel htmlFor="tdsValue" className="flex items-center">
                      <Droplets className="mr-2 h-5 w-5 text-primary" /> TDS Value (0-1500)
                    </FormLabel>
                    <FormControl>
                      <Input
                        id="tdsValue"
                        type="number"
                        placeholder="Enter TDS value"
                        {...field}
                        ref={(e) => {
                          field.ref(e);
                          tdsInputRef.current = e;
                        }}
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
              name="futureMeetingSet"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 shadow-sm">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(checked) => {
                        const boolValue = !!checked;
                        field.onChange(boolValue);
                        if (boolValue) {
                          // Default to today at 9:00 AM if no date is set yet
                          if (!form.getValues('futureMeetingDateTime')) {
                            const newDateTime = new Date();
                            newDateTime.setHours(9);
                            newDateTime.setMinutes(0);
                            newDateTime.setSeconds(0);
                            newDateTime.setMilliseconds(0);
                            form.setValue('futureMeetingDateTime', newDateTime, { shouldValidate: true });
                          }
                        } else {
                           form.setValue('futureMeetingDateTime', undefined, { shouldValidate: true });
                        }
                      }}
                      id="futureMeetingSet"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel htmlFor="futureMeetingSet" className="cursor-pointer font-normal flex items-center">
                      <CalendarCheck className="mr-2 h-4 w-4 text-primary" /> Future Meeting Set?
                    </FormLabel>
                  </div>
                </FormItem>
              )}
            />

            {futureMeetingSetValue && (
              <FormField
                control={form.control}
                name="futureMeetingDateTime"
                render={({ field }) => (
                  <FormItem className="flex flex-col space-y-2 rounded-md border p-3 shadow-sm bg-background/10">
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
                          >
                            {field.value ? (
                              format(new Date(field.value), "PPP 'at' h:mm a")
                            ) : (
                              <span>Pick a date and time</span>
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
                            
                            // Preserve existing time, or default to 9 AM if no time was set
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
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="freeTrial"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 shadow-sm">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
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

            <div className="space-y-3 pt-2 p-3 border rounded-md bg-background/10">
              <Label className="font-medium text-base">Competitor Info (Optional)</Label>
              <FormField
                control={form.control}
                name="competitorName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Competitor Name</FormLabel>
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
              {watchedCompetitorName && (
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
                <AccordionItem value="dm-info" className="border rounded-md bg-background/10 p-3">
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
                                  <Input placeholder="e.g., Jane Doe" {...field} />
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
                                  <Input placeholder="e.g., Office Manager" {...field} />
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
                                  <Input placeholder="e.g., jane@example.com or x123" {...field} />
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
                  <FormLabel className="flex items-center">
                    Visit Notes
                    {isRecordingNotes && <Mic className="ml-2 h-4 w-4 text-red-500 animate-pulse" />}
                    {!isRecordingNotes && hasMicPermission === true && <Mic className="ml-2 h-4 w-4 text-green-500" />}
                    {!isRecordingNotes && hasMicPermission === false && <MicOff className="ml-2 h-4 w-4 text-muted-foreground" />}
                    {!isRecordingNotes && hasMicPermission === undefined && <Mic className="ml-2 h-4 w-4 text-muted-foreground" />}
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Details about the visit, key discussion points, etc."
                      className="mt-1 min-h-[100px]"
                      {...field}
                      onBlur={() => {
                        field.onBlur();
                        handleNotesBlur();
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSaving || isSuggestingCompany || isCameraViewVisible}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving || isSuggestingCompany || isRecordingNotes || isCameraViewVisible} className="aurora-glow">
                {(isSaving || isSuggestingCompany) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isRecordingNotes && <Mic className="mr-2 h-4 w-4 animate-pulse" /> }
                {initialData?.id ? 'Save Changes' : 'Log Meeting'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default VisitForm;
