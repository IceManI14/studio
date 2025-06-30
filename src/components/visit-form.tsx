
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
import { Loader2, Star, UserCircle, Mic, Trash2, PlusSquare, PackageCheck, Droplets, CalendarCheck, Camera as CameraIcon, Calendar as CalendarIcon, ScanLine, MapPin, DollarSign, Clock, CheckCircle2 } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';


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
  businessCardImageUrl: z.string().url("Must be a valid URL.").optional().nullable(),
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
  startDictation?: boolean;
}

const VisitForm: React.FC<VisitFormProps> = ({ isOpen, onClose, onSave, initialData, salesperson, startDictation }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [isSuggestingCompany, setIsSuggestingCompany] = useState(false);

  const [currentLatitude, setCurrentLatitude] = useState<number | undefined>(initialData?.latitude);
  const [currentLongitude, setCurrentLongitude] = useState<number | undefined>(initialData?.longitude);
  const [hoveredStars, setHoveredStars] = useState<number | undefined>(undefined);
  const confidenceStarsRef = useRef<HTMLDivElement>(null);

  const [isRecordingNotes, setIsRecordingNotes] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const [businessCardPreviewUrl, setBusinessCardPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tdsInputRef = useRef<HTMLInputElement>(null);
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
  
  const handleRemoveImage = useCallback(() => {
    setBusinessCardPreviewUrl(null);
    form.setValue('businessCardImageUrl', null, { shouldValidate: true });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setIsCameraViewVisible(false);
    // No need to call stopCameraStream here as it's handled by other flows
  }, [form]);

  const uploadImage = useCallback(async (file: File) => {
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
      form.setValue('businessCardImageUrl', result.url, { shouldValidate: true });
      setBusinessCardPreviewUrl(result.url);
      toast({ title: "Image Uploaded", description: "Business card is ready to be saved with the visit." });
    } catch (error: any) {
      toast({ variant: 'destructive', title: "Upload Failed", description: error.message });
      handleRemoveImage();
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
        } else {
            toast({ variant: "destructive", title: "No Company Found", description: "Could not identify a company at this location." });
        }
        if (result.phone) form.setValue('decisionMakerContact', result.phone, { shouldValidate: true });
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
      toast({ variant: "destructive", title: "Geolocation Not Supported", description: "Your browser does not support geolocation." });
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


  useEffect(() => {
    if (hasTDSReadingValue) {
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
      latitude: data?.latitude ?? undefined,
      longitude: data?.longitude ?? undefined,
      partnershipConfidence: data?.partnershipConfidence ?? undefined,
      hasBusinessCard: data?.hasBusinessCard || false,
      businessCardImageUrl: data?.businessCardImageUrl || null,
      competitorName: data?.competitorName || undefined,
      coolerType: data?.coolerType || undefined,
      decisionMakerName: data?.decisionMakerName || '',
      decisionMakerTitle: data?.decisionMakerTitle || '',
      decisionMakerContact: data?.decisionMakerContact || '',
      interestedUnit: data?.interestedUnit || undefined,
      hasTDSReading: data?.hasTDSReading || false,
      tdsValue: data?.tdsValue ?? undefined,
      futureMeetingSet: data?.futureMeetingSet || false,
      futureMeetingDateTime: data?.futureMeetingDateTime ? new Date(data.futureMeetingDateTime) : undefined,
      freeTrial: data?.freeTrial || false,
    };
    form.reset(defaultValues);
    setCurrentLatitude(data?.latitude ?? undefined);
    setCurrentLongitude(data?.longitude ?? undefined);
    setBusinessCardPreviewUrl(data?.businessCardImageUrl || null);
    setCustomCoolerNameInput('');
    setIsCameraViewVisible(false);
    setHasCameraPermission(null);
    setCurrentCity(null);
  }, [form]);

  useEffect(() => {
    if (isOpen) {
      resetFormAndState(initialData);
    }
  }, [initialData, isOpen, resetFormAndState]);

  useEffect(() => {
    if (isOpen && !initialData?.id && initialData?.latitude && initialData?.longitude) {
      handleSuggestCompany(initialData.latitude, initialData.longitude);
      const timer = setTimeout(() => {
        confidenceStarsRef.current?.focus({ preventScroll: true });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, initialData, handleSuggestCompany]);


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


  const handleToggleVoiceNotes = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({ variant: 'destructive', title: 'Voice Recognition Not Supported', description: 'Your browser does not support this feature.' });
      return;
    }

    if (isRecordingNotes && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    
    recognition.continuous = false; // Stops after the first pause in speech
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsRecordingNotes(true);
      toast({ title: 'Listening...', description: 'Start speaking. Recording will stop automatically after you pause.' });
    };

    recognition.onend = () => {
      setIsRecordingNotes(false);
      recognitionRef.current = null;
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
          // This can happen if the user stops it manually or navigates away.
          // It's not usually an error to show to the user.
          console.log("Speech recognition aborted.");
          setIsRecordingNotes(false);
          recognitionRef.current = null;
          return; // Don't show a toast for this common case.
        case 'language-not-supported':
          errorMessage = "The language for dictation is not supported by your browser.";
          break;
        case 'bad-grammar':
           errorMessage = "There was a grammar recognition error. This is usually an issue with the recognition service.";
           break;
      }
      
      toast({ variant: 'destructive', title: 'Voice Recognition Error', description: errorMessage, duration: 9000 });
      setIsRecordingNotes(false);
      recognitionRef.current = null;
    };

    recognition.onresult = (event) => {
      // Add more robust check for results
      if (event.results && event.results.length > 0 && event.results[0].length > 0) {
          const transcript = event.results[0][0].transcript;
          if (transcript) {
            const currentNotes = form.getValues('notes') || '';
            const newNotes = currentNotes ? `${currentNotes}\n${transcript}` : transcript;
            form.setValue('notes', newNotes, { shouldValidate: true });
            toast({ title: 'Notes Added Via Voice' });
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
  }, [form, isRecordingNotes, toast]);


  useEffect(() => {
    if (isOpen && startDictation) {
      // Small delay to ensure the component is ready and the user notices the modal opening first.
      const timer = setTimeout(() => {
        handleToggleVoiceNotes();
      }, 500);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, startDictation]);

  useEffect(() => {
    const stopAudioAndCamera = () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
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
        toast({ title: "Reminder Added", description: "A note was added to photograph the card later." });
    } else {
        toast({ title: "Reminder Already Exists", description: "The business card reminder is already in your notes." });
    }
    form.setValue('hasBusinessCard', false);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
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
      uploadImage(file);
      setIsCameraViewVisible(false);
      stopCameraStream();
    }
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
            const imageFile = new File([blob], "business-card-capture.jpg", { type: "image/jpeg" });
            uploadImage(imageFile);
            toast({ title: "Image Captured", description: "Business card image captured from camera." });
          })
          .catch(err => {
              toast({ variant: "destructive", title: "Capture Failed", description: "Could not process captured image for upload." });
          });
      }
      handleToggleCameraView();
    } else {
        toast({ variant: "destructive", title: "Capture Error", description: "Camera not ready or permission denied." });
    }
  }, [hasCameraPermission, uploadImage, toast, handleToggleCameraView]);


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

  const handleFormSubmit = async (data: VisitFormData) => {
    setIsSaving(true);
    
    // This logic ensures that if the notes have changed, the old summary is cleared.
    let notesSummaryToSave = initialData?.notesSummary;
    if (initialData?.notes !== data.notes) {
      notesSummaryToSave = undefined;
    }

    const payload: SaveVisitPayload = {
      id: initialData?.id,
      timestamp: initialData?.timestamp,
      companyName: data.companyName,
      notes: data.notes,
      latitude: currentLatitude,
      longitude: currentLongitude,
      partnershipConfidence: data.partnershipConfidence,
      hasBusinessCard: data.hasBusinessCard,
      businessCardImageUrl: data.hasBusinessCard ? data.businessCardImageUrl : null,
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
      visitNumber: initialData?.visitNumber,
      contactInfo: initialData?.contactInfo,
      notesSummary: notesSummaryToSave,
    };

    try {
      await onSave(payload);
      onClose();
    } catch (error) {
      toast({ variant: "destructive", title: "Error Saving", description: "An unexpected error occurred during the save operation." });
    } finally {
        setIsSaving(false);
    }
  };

  const handleQuickSave = async () => {
    const isValid = await form.trigger("companyName");
    if (!isValid) {
      return;
    }
    const companyName = form.getValues('companyName');

    setIsSaving(true);

    const payload: SaveVisitPayload = {
      companyName: companyName.trim(),
      latitude: currentLatitude,
      longitude: currentLongitude,
      timestamp: initialData?.timestamp || new Date(),
      visitNumber: initialData?.visitNumber,
    };

    try {
      await onSave(payload);
      onClose();
    } catch (error) {
      toast({ variant: "destructive", title: "Error Saving", description: "An unexpected error occurred during the quick save." });
    } finally {
      setIsSaving(false);
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
                            onClick={handleFindButtonClick}
                            variant="outline"
                            size="sm"
                            disabled={isSuggestingCompany || isSaving}
                        >
                          {isSuggestingCompany ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Find'}
                        </Button>
                    </div>
                  </FormControl>
                  {!initialData?.id && (
                    <Button
                        type="button"
                        variant="secondary"
                        className="w-full mt-2"
                        onClick={handleQuickSave}
                        disabled={isSaving || isSuggestingCompany || !form.watch('companyName')}
                    >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Quick Save Company & Continue Later
                    </Button>
                  )}
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
                
                {isUploadingCard && (
                    <div className="flex items-center justify-center gap-2 text-muted-foreground p-4">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <span>Uploading image...</span>
                    </div>
                )}

                {(businessCardPreviewUrl && !isUploadingCard) && (
                  <div className="mt-2 relative w-full aspect-[1.6/1] max-w-xs mx-auto group">
                    <Image
                      src={businessCardPreviewUrl}
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
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={handleFileChange}
                      className="flex-grow"
                      ref={fileInputRef}
                      disabled={isCameraViewVisible || isUploadingCard}
                    />
                    <Button
                        type="button"
                        onClick={handleToggleCameraView}
                        variant="outline"
                        size="icon"
                        aria-label={isCameraViewVisible ? "Close Camera" : "Take Photo"}
                        className="bg-accent hover:bg-accent/90"
                        disabled={isUploadingCard}
                    >
                        <CameraIcon className="h-4 w-4 text-black" />
                    </Button>
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
                    variant="ghost"
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
                            <CameraIcon className="mr-2 h-4 w-4" /> Capture
                        </Button>
                    )}
                  </div>
                )}
                <canvas ref={canvasRef} className="hidden"></canvas>

                <FormDescription>
                  Upload an image of the business card. The file will be stored securely.
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
                  <FormLabel className="flex items-center justify-between">
                    <span>Visit Notes</span>
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
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Details about the visit, key discussion points, etc. You can also use the microphone to dictate notes."
                      className="mt-1 min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSaving || isSuggestingCompany || isCameraViewVisible || isUploadingCard}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving || isSuggestingCompany || isRecordingNotes || isCameraViewVisible || isUploadingCard} className="aurora-glow">
                {(isSaving || isSuggestingCompany || isUploadingCard) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
