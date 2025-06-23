
'use client';

import type { Visit } from '@/lib/types';
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
import { useToast } from '@/hooks/use-toast';
import { saveVisitAction, getCompanyNameFromCoordsAction, type SaveVisitPayload } from '@/app/actions';
import { useEffect, useState, useRef } from 'react';
import { Loader2, Star, UserCircle, Mic, MicOff, Trash2, PlusSquare, PackageCheck, Droplets, CalendarCheck, Camera as CameraIcon, Calendar as CalendarIcon, ScanLine } from 'lucide-react';
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
  tdsValue: z.number().min(0, "TDS value must be 0 or greater.").max(1500, "TDS value must be 1500 or less.").optional(),
  futureMeetingSet: z.boolean().optional(),
  futureMeetingDateTime: z.date().optional(),
}).refine(data => {
  if (data.hasTDSReading && (data.tdsValue === undefined || data.tdsValue === null || isNaN(data.tdsValue))) {
    return false;
  }
  return true;
}, {
  message: "TDS value (0-1500) is required when TDS Reading is checked.",
  path: ["tdsValue"],
});

type VisitFormData = z.infer<typeof visitFormSchema>;

interface VisitFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (visit: Visit) => void;
  initialData?: Visit;
}

const VisitForm: React.FC<VisitFormProps> = ({ isOpen, onClose, onSave, initialData }) => {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isSuggestingCompany, setIsSuggestingCompany] = useState(false);

  const [currentLatitude, setCurrentLatitude] = useState<number | undefined>(initialData?.latitude);
  const [currentLongitude, setCurrentLongitude] = useState<number | undefined>(initialData?.longitude);
  const [hoveredStars, setHoveredStars] = useState<number | undefined>(undefined);

  const [isRecordingNotes, setIsRecordingNotes] = useState(false);
  const [hasMicPermission, setHasMicPermission] = useState<boolean | undefined>(undefined);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const [businessCardPreviewUrl, setBusinessCardPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentCoolerOptions, setCurrentCoolerOptions] = useState<string[]>(DEFAULT_COOLER_TYPES_LIST);
  const [customCoolerNameInput, setCustomCoolerNameInput] = useState('');
  const [openAccordion, setOpenAccordion] = useState<string[]>([]);

  const [isCameraViewVisible, setIsCameraViewVisible] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | undefined>(undefined);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);


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
    },
  });

  const hasBusinessCardValue = form.watch('hasBusinessCard');
  const watchedCompetitorName = form.watch('competitorName');
  const partnershipConfidenceValue = form.watch('partnershipConfidence');
  const hasTDSReadingValue = form.watch('hasTDSReading');
  const futureMeetingSetValue = form.watch('futureMeetingSet');

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
    } else {
      setOpenAccordion([]);
    }
  }, [watchedCompetitorName]);

  useEffect(() => {
    if (initialData) {
      form.reset({
        companyName: initialData.companyName,
        notes: initialData.notes || '',
        latitude: initialData.latitude,
        longitude: initialData.longitude,
        partnershipConfidence: initialData.partnershipConfidence,
        hasBusinessCard: initialData.hasBusinessCard || false,
        businessCardImageUrl: initialData.businessCardImageUrl || null, // Will be Data URI if exists
        competitorName: initialData.competitorName || undefined,
        coolerType: initialData.coolerType || undefined,
        decisionMakerName: initialData.decisionMakerName || '',
        decisionMakerTitle: initialData.decisionMakerTitle || '',
        decisionMakerContact: initialData.decisionMakerContact || '',
        interestedUnit: initialData.interestedUnit || undefined,
        hasTDSReading: initialData.hasTDSReading || false,
        tdsValue: initialData.tdsValue,
        futureMeetingSet: initialData.futureMeetingSet || false,
        futureMeetingDateTime: initialData.futureMeetingDateTime ? new Date(initialData.futureMeetingDateTime) : undefined,
      });
      setCurrentLatitude(initialData.latitude);
      setCurrentLongitude(initialData.longitude);
      setBusinessCardPreviewUrl(initialData.businessCardImageUrl || null);
    } else {
      form.reset({
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
      });
      setCurrentLatitude(undefined);
      setCurrentLongitude(undefined);
      setBusinessCardPreviewUrl(null);
    }
    setCustomCoolerNameInput('');
    setIsCameraViewVisible(false);
    setHasCameraPermission(undefined);
  }, [initialData, form, isOpen]);

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
          toast({
            variant: 'destructive',
            title: 'Camera Access Denied',
            description: 'Please enable camera permissions in your browser settings to use this feature.',
          });
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
  }, [isCameraViewVisible, toast]);


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
        toast({ title: "Image Captured", description: "Business card image captured from camera." });
      }
      handleToggleCameraView();
    } else {
        toast({ title: "Capture Error", description: "Camera not ready or permission denied.", variant: "destructive"});
    }
  };


  const handleSuggestCompany = async () => {
    setIsSuggestingCompany(true);

    if (!navigator.geolocation) {
      setIsSuggestingCompany(false);
      toast({
        title: "Geolocation Not Supported",
        description: "Your browser does not support this feature.",
        variant: "destructive",
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        
        setCurrentLatitude(lat);
        setCurrentLongitude(lon);
        form.setValue('latitude', lat, { shouldValidate: true });
        form.setValue('longitude', lon, { shouldValidate: true });

        const result = await getCompanyNameFromCoordsAction({ latitude: lat, longitude: lon });

        setIsSuggestingCompany(false);

        if (result.error) {
          toast({ title: "Error", description: result.error, variant: "destructive" });
        } else {
            if (result.suggestedCompanyName && result.suggestedCompanyName.trim() !== '') {
                form.setValue('companyName', result.suggestedCompanyName, { shouldValidate: true });
                toast({
                    title: "Company Suggested",
                    description: `Found: ${result.suggestedCompanyName} (Confidence: ${Math.round((result.confidenceScore ?? 0) * 100)}%)`
                });
            } else {
                toast({ title: "No Company Found", description: "Could not identify a company at this location.", variant: "default" });
            }

            if (result.phone) {
                form.setValue('decisionMakerContact', result.phone, { shouldValidate: true });
            }

            if (result.address) {
                const currentNotes = form.getValues('notes') || '';
                const newNotes = `Suggested Address: ${result.address}\\n\\n${currentNotes}`;
                form.setValue('notes', newNotes, { shouldValidate: true });
            }
        }
      },
      (error) => {
        setIsSuggestingCompany(false);
        let errorMessage = "Could not retrieve location.";
        if (error.code === error.PERMISSION_DENIED) {
          errorMessage = "Location access denied. Please enable it in your browser settings.";
        }
        toast({ title: "Location Error", description: errorMessage, variant: "destructive" });
      }
    );
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
        toast({ title: "Custom Cooler Added", description: `${newName} added to options and selected.`});
    } else if (newName && currentCoolerOptions.includes(newName)) {
        form.setValue('coolerType', newName, { shouldValidate: true });
        setCustomCoolerNameInput('');
        toast({ title: "Cooler Selected", description: `${newName} selected.`});
    } else {
        toast({ title: "Invalid Name", description: "Please enter a cooler name.", variant: "default" });
    }
  };

  const handleFormSubmit = async (data: VisitFormData) => {
    setIsSaving(true);
    let finalNotes = data.notes || '';

    if ((!initialData || !initialData.id) && initialData?.timestamp) {
        const startTime = initialData.timestamp;
        const endTime = new Date();
        const durationMs = endTime.getTime() - startTime.getTime();

        const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;

        const durationString = `Meeting duration was ${minutes} minute${minutes !== 1 ? 's' : ''} and ${seconds} second${seconds !== 1 ? 's' : ''}.`;

        const currentNotes = finalNotes.trim();
        if (currentNotes) {
             finalNotes = `${currentNotes}\\n${durationString}`;
        } else {
            finalNotes = durationString;
        }
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
      originalCompanyName: initialData?.companyName,
      originalNotes: initialData?.notes,
      existingContactInfo: initialData?.contactInfo,
      existingNotesSummary: initialData?.notesSummary,
      originalBusinessCardImageUrl: initialData?.businessCardImageUrl, // This will be a Data URI if it existed
      visitNumber: initialData?.visitNumber,
    };

    const result = await saveVisitAction(payload);

    if (result.error) {
      toast({
        title: 'Error saving visit',
        description: result.error,
        variant: 'destructive',
      });
    } else if (result.visit) {
      toast({
        title: initialData?.id ? 'Potential Partner Updated' : 'Potential Partner Logged',
        description: `${result.visit.companyName} details saved successfully.`,
      });
      onSave(result.visit);
      onClose();
    }
    setIsSaving(false);
  };


  const handleNotesFocus = async () => {
    if (isRecordingNotes) return;
    if (hasMicPermission === false) {
      toast({ title: "Microphone Access Denied", description: "Please enable microphone permissions to record audio notes.", variant: "destructive" });
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
          toast({ title: "Audio Notes Recorded", description: `Captured ${Math.round(audioBlob.size / 1024)} KB of audio. (Not saved with visit yet)` });
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
      toast({
        variant: 'destructive',
        title: 'Microphone Access Denied',
        description: 'Please enable microphone permissions in your browser settings.',
      });
    }
  };

  const handleNotesBlur = () => {
    if (isRecordingNotes && mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
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
                            onClick={handleSuggestCompany}
                            variant="outline"
                            size="sm"
                            disabled={isSuggestingCompany}
                        >
                          {isSuggestingCompany ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Suggest'}
                        </Button>
                    </div>
                  </FormControl>
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
                    <div className="flex items-center gap-1 mt-1" onMouseLeave={() => setHoveredStars(undefined)}>
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
                      <FormDescription>
                        Select the type of cooler the company showed interest in.
                      </FormDescription>
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
                
                <div className="mt-2">
                  <Button 
                    type="button" 
                    variant="secondary"
                    className="w-full"
                    onClick={() => {
                        if (typeof window !== 'undefined') {
                            window.open('geniusscan://', '_blank');
                            toast({ title: 'Opening Genius Scan', description: 'After scanning, come back and upload the image from your photos.' });
                        }
                    }}
                  >
                      <ScanLine className="mr-2 h-4 w-4" />
                      Activate Genius Scan
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
                        onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}
                        value={field.value === undefined ? '' : field.value}
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
                        if (!boolValue) {
                           form.setValue('futureMeetingDateTime', undefined);
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
                              format(field.value, "PPP 'at' h:mm a")
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
                          selected={field.value}
                          onSelect={(date) => {
                            const current = field.value || new Date();
                            const newDate = date || current;
                            newDate.setHours(current.getHours());
                            newDate.setMinutes(current.getMinutes());
                            field.onChange(newDate);
                          }}
                          disabled={(date) =>
                            date < new Date(new Date().setDate(new Date().getDate() - 1))
                          }
                          initialFocus
                        />
                        <div className="p-3 border-t border-border">
                          <div className="flex items-center gap-2">
                             <Label>Time</Label>
                            <Select
                              value={field.value ? String(field.value.getHours()) : '9'}
                              onValueChange={(value) => {
                                const newDate = field.value ? new Date(field.value) : new Date();
                                newDate.setHours(parseInt(value));
                                field.onChange(newDate);
                              }}
                            >
                              <SelectTrigger className="w-[80px]">
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
                              value={field.value ? String(field.value.getMinutes()).padStart(2, '0') : '00'}
                               onValueChange={(value) => {
                                const newDate = field.value ? new Date(field.value) : new Date();
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
                    <FormDescription>
                      Select date/time for the follow-up meeting.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

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
                                  <Select onValueChange={field.onChange} value={field.value || ''}>
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
                      onFocus={handleNotesFocus}
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
