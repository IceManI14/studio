
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
import { Loader2, Star, UserCircle, Mic, MicOff, Upload, Image as ImageIcon, Trash2, PlusSquare, PackageCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from "@/components/ui/checkbox"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { formatInTimeZone } from 'date-fns-tz';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Image from 'next/image';


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
  businessCardImageUrl: z.string().url().optional().nullable(),
  discussedCompetitors: z.boolean().optional(),
  competitorName: z.string().optional(),
  coolerType: z.string().optional(),
  decisionMakerName: z.string().optional(),
  decisionMakerTitle: z.string().optional(),
  decisionMakerContact: z.string().optional(),
  interestedUnit: z.string().optional(),
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
  const timeZone = 'America/New_York';

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [businessCardPreviewUrl, setBusinessCardPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentCoolerOptions, setCurrentCoolerOptions] = useState<string[]>(DEFAULT_COOLER_TYPES_LIST);
  const [customCoolerNameInput, setCustomCoolerNameInput] = useState('');


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
      discussedCompetitors: false,
      competitorName: undefined,
      coolerType: undefined,
      decisionMakerName: '',
      decisionMakerTitle: '',
      decisionMakerContact: '',
      interestedUnit: undefined,
    },
  });

  const discussedCompetitorsValue = form.watch('discussedCompetitors');
  const hasBusinessCardValue = form.watch('hasBusinessCard');
  const watchedCompetitorName = form.watch('competitorName');
  const watchedCoolerType = form.watch('coolerType');
  const partnershipConfidenceValue = form.watch('partnershipConfidence');

  useEffect(() => {
    if (initialData) {
      form.reset({
        companyName: initialData.companyName,
        notes: initialData.notes || '',
        latitude: initialData.latitude,
        longitude: initialData.longitude,
        partnershipConfidence: initialData.partnershipConfidence,
        hasBusinessCard: initialData.hasBusinessCard || false,
        businessCardImageUrl: initialData.businessCardImageUrl || null,
        discussedCompetitors: initialData.discussedCompetitors || false,
        competitorName: initialData.competitorName || undefined,
        coolerType: initialData.coolerType || undefined,
        decisionMakerName: initialData.decisionMakerName || '',
        decisionMakerTitle: initialData.decisionMakerTitle || '',
        decisionMakerContact: initialData.decisionMakerContact || '',
        interestedUnit: initialData.interestedUnit || undefined,
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
        discussedCompetitors: false,
        competitorName: undefined,
        coolerType: undefined,
        decisionMakerName: '',
        decisionMakerTitle: '',
        decisionMakerContact: '',
        interestedUnit: undefined,
      });
      setCurrentLatitude(undefined);
      setCurrentLongitude(undefined);
      setBusinessCardPreviewUrl(null);
    }
    setSelectedFile(null); 
    setCustomCoolerNameInput('');
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
    const stopAudioRecording = () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (mediaRecorderRef.current?.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
      audioChunksRef.current = [];
      setIsRecordingNotes(false);
    };
  
    if (!isOpen) { 
      stopAudioRecording();
      setSelectedFile(null);
      setBusinessCardPreviewUrl(null);
      setCustomCoolerNameInput('');
    }
  
    return () => { 
      stopAudioRecording();
    };
  }, [isOpen]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setBusinessCardPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
      form.setValue('businessCardImageUrl', undefined); 
    }
  };

  const handleRemoveImage = () => {
    setSelectedFile(null);
    setBusinessCardPreviewUrl(null);
    form.setValue('businessCardImageUrl', undefined); 
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; 
    }
  };


  const handleSuggestCompany = async () => {
    if (currentLatitude === undefined || currentLongitude === undefined) {
      toast({ title: "Location needed", description: "Please log location to suggest company.", variant: "default" });
      return;
    }
    setIsSuggestingCompany(true);
    const result = await getCompanyNameFromCoordsAction({ latitude: currentLatitude, longitude: currentLongitude });
    setIsSuggestingCompany(false);

    if (result.error) {
      toast({ title: "Error", description: result.error, variant: "destructive" });
    } else if (result.suggestedCompanyName && result.suggestedCompanyName.trim() !== '') {
      form.setValue('companyName', result.suggestedCompanyName);
      toast({ 
        title: "Company Suggested", 
        description: `Found: ${result.suggestedCompanyName} (Confidence: ${(result.confidenceScore ?? 0) * 100}%)`
      });
    } else {
      toast({ title: "No Company Found", description: "Could not identify a company at this location.", variant: "default" });
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
            updatedOptions = [...currentCoolerOptions, newName, 'Other']; // Fallback
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

    if (!initialData || !initialData.id) {
        const currentTime = new Date();
        const endTimeString = `Meeting ended at ${formatInTimeZone(currentTime, timeZone, 'h:mm a')}.`;
        
        const currentNotes = finalNotes.trim();
        if (currentNotes) { 
             finalNotes = `${currentNotes}\n${endTimeString}`;
        }
         else { 
            finalNotes = endTimeString;
        }
    }
    
    let finalBusinessCardImageUrl = initialData?.businessCardImageUrl;

    if (data.hasBusinessCard) {
      if (selectedFile) {
        setIsUploading(true);
        const formData = new FormData();
        formData.append('image', selectedFile);
        try {
          const response = await fetch('/api/upload-image', {
            method: 'POST',
            body: formData,
          });
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to upload image');
          }
          const uploadResult = await response.json();
          finalBusinessCardImageUrl = uploadResult.url;
          toast({ title: 'Business Card Uploaded', description: 'Image saved successfully.' });
        } catch (error: any) {
          toast({ title: 'Upload Failed', description: error.message, variant: 'destructive' });
          setIsSaving(false);
          setIsUploading(false);
          return; 
        } finally {
          setIsUploading(false);
        }
      } else if (form.getValues('businessCardImageUrl') === undefined && initialData?.businessCardImageUrl) {
        
        if (!businessCardPreviewUrl) finalBusinessCardImageUrl = undefined;

      } else {
         
        finalBusinessCardImageUrl = businessCardPreviewUrl || initialData?.businessCardImageUrl;
      }
    } else {
      finalBusinessCardImageUrl = undefined;
    }

    const payload: SaveVisitPayload = {
      id: initialData?.id,
      companyName: data.companyName,
      notes: finalNotes,
      latitude: currentLatitude,
      longitude: currentLongitude,
      partnershipConfidence: data.partnershipConfidence,
      hasBusinessCard: data.hasBusinessCard,
      businessCardImageUrl: finalBusinessCardImageUrl,
      discussedCompetitors: data.discussedCompetitors,
      competitorName: data.discussedCompetitors ? data.competitorName : undefined,
      coolerType: data.discussedCompetitors ? data.coolerType : undefined,
      decisionMakerName: data.decisionMakerName,
      decisionMakerTitle: data.decisionMakerTitle,
      decisionMakerContact: data.decisionMakerContact,
      interestedUnit: (data.partnershipConfidence && data.partnershipConfidence >= 4) ? data.interestedUnit : undefined,
      originalCompanyName: initialData?.companyName,
      originalNotes: initialData?.notes,
      existingContactInfo: initialData?.contactInfo,
      existingNotesSummary: initialData?.notesSummary,
      originalBusinessCardImageUrl: initialData?.businessCardImageUrl,
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
  
  const handleLogCurrentLocation = () => {
    const randomLat = parseFloat((Math.random() * (49 - 25) + 25).toFixed(6)); 
    const randomLng = parseFloat((Math.random() * (-66 - -125) + -125).toFixed(6)); 
    
    form.setValue('latitude', randomLat);
    form.setValue('longitude', randomLng);
    setCurrentLatitude(randomLat);
    setCurrentLongitude(randomLng);

    toast({ title: 'Location Logged (Mock)', description: `Lat: ${randomLat}, Lng: ${randomLng}` });
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
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="font-headline">
            {initialData?.id ? 'Edit Potential Partner' : 'New Potential Partner'}
          </DialogTitle>
          <DialogDescription>
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
                    <Input placeholder="e.g., Acme Corp or suggest from location" {...field} />
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
              <FormField
                control={form.control}
                name="interestedUnit"
                render={({ field }) => (
                  <FormItem className="space-y-2 rounded-md border p-3 shadow-sm bg-secondary/30">
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
              <FormItem className="space-y-2 rounded-md border p-3 shadow-sm bg-secondary/30">
                <FormLabel htmlFor="businessCardImage">Business Card Image</FormLabel>
                {(businessCardPreviewUrl || (initialData?.businessCardImageUrl && !selectedFile)) && (
                  <div className="mt-2 relative w-full aspect-[1.6/1] max-w-xs mx-auto group">
                    <Image
                      src={businessCardPreviewUrl || initialData!.businessCardImageUrl!}
                      alt="Business card preview"
                      layout="fill"
                      objectFit="contain"
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
                <FormControl>
                  <div className="flex items-center gap-2 mt-2">
                    <Input
                      id="businessCardImage"
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="flex-grow"
                      ref={fileInputRef}
                      disabled={isUploading}
                    />
                    {isUploading && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                  </div>
                </FormControl>
                <FormDescription>
                  Upload an image of the business card. Max 5MB.
                </FormDescription>
                <FormMessage>{form.formState.errors.businessCardImageUrl?.message}</FormMessage>
              </FormItem>
            )}


            <FormField
              control={form.control}
              name="discussedCompetitors"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 shadow-sm">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(checked) => {
                        field.onChange(checked);
                        if (!checked) {
                          form.setValue('competitorName', undefined);
                          form.setValue('coolerType', undefined);
                        }
                      }}
                      id="discussedCompetitors"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel htmlFor="discussedCompetitors" className="cursor-pointer font-normal">
                      Competitor Present?
                    </FormLabel>
                  </div>
                </FormItem>
              )}
            />
            
            {discussedCompetitorsValue && (
              <div className="space-y-3 p-3 border rounded-md bg-secondary/30">
                <FormField
                  control={form.control}
                  name="competitorName"
                  render={({ field }) => (
                    <FormItem>
                       <FormLabel>Competitor Name</FormLabel>
                      <Select 
                        onValueChange={(value) => {
                          field.onChange(value);
                        }} 
                        defaultValue={field.value}
                        value={field.value || ''}
                       >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a competitor" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
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
                <FormField
                  control={form.control}
                  name="coolerType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cooler Type Observed</FormLabel>
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
              </div>
            )}

            <div className="space-y-3 pt-2 p-3 border rounded-md bg-secondary/30">
              <Label className="font-medium text-base">Decision Maker Info (Optional)</Label>
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
                      onFocus={(e) => {
                        field.onFocus(e); 
                        handleNotesFocus();
                      }}
                      onBlur={(e) => {
                        field.onBlur(e); 
                        handleNotesBlur();
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSaving || isSuggestingCompany || isUploading}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving || isSuggestingCompany || isRecordingNotes || isUploading}>
                {(isSaving || isSuggestingCompany || isUploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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

