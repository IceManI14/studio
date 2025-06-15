
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
import { useEffect, useState } from 'react';
import { Loader2, MapPin, Sparkles, Star, CheckSquare, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from "@/components/ui/checkbox"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { format } from 'date-fns';


const visitFormSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  notes: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  partnershipConfidence: z.number().min(1).max(5).optional(),
  hasBusinessCard: z.boolean().optional(),
  discussedCompetitors: z.boolean().optional(),
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


  const form = useForm<VisitFormData>({
    resolver: zodResolver(visitFormSchema),
    defaultValues: {
      companyName: '',
      notes: '',
      latitude: undefined,
      longitude: undefined,
      partnershipConfidence: undefined,
      hasBusinessCard: false,
      discussedCompetitors: false,
    },
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        companyName: initialData.companyName,
        notes: initialData.notes || '',
        latitude: initialData.latitude,
        longitude: initialData.longitude,
        partnershipConfidence: initialData.partnershipConfidence,
        hasBusinessCard: initialData.hasBusinessCard || false,
        discussedCompetitors: initialData.discussedCompetitors || false,
      });
      setCurrentLatitude(initialData.latitude);
      setCurrentLongitude(initialData.longitude);
    } else {
      form.reset({
        companyName: '',
        notes: initialData?.notes || '',
        latitude: undefined,
        longitude: undefined,
        partnershipConfidence: undefined,
        hasBusinessCard: false,
        discussedCompetitors: false,
      });
      setCurrentLatitude(undefined);
      setCurrentLongitude(undefined);
    }
  }, [initialData, form, isOpen]);

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

  const handleFormSubmit = async (data: VisitFormData) => {
    setIsSaving(true);
    let finalNotes = data.notes || '';

    if (!initialData || !initialData.id) {
        const currentTime = new Date();
        const endTimeString = `Meeting ended at ${format(currentTime, 'HH:mm')}.`;
        
        const currentNotes = finalNotes.trim();
        if (currentNotes) {
            finalNotes = `${currentNotes}\n${endTimeString}`;
        } else {
            finalNotes = endTimeString;
        }
    }
    
    const payload: SaveVisitPayload = {
      id: initialData?.id,
      companyName: data.companyName,
      notes: finalNotes,
      latitude: currentLatitude,
      longitude: currentLongitude,
      partnershipConfidence: data.partnershipConfidence,
      hasBusinessCard: data.hasBusinessCard,
      discussedCompetitors: data.discussedCompetitors,
      originalCompanyName: initialData?.companyName,
      originalNotes: initialData?.notes,
      existingContactInfo: initialData?.contactInfo,
      existingNotesSummary: initialData?.notesSummary,
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
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6 py-2">
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

            <FormField
              control={form.control}
              name="hasBusinessCard"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-2 shadow-sm">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      id="hasBusinessCard"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel htmlFor="hasBusinessCard" className="cursor-pointer">
                      Business Card Collected?
                    </FormLabel>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="discussedCompetitors"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-2 shadow-sm">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      id="discussedCompetitors"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel htmlFor="discussedCompetitors" className="cursor-pointer">
                      Competitor Present?
                    </FormLabel>
                  </div>
                </FormItem>
              )}
            />
            
            {/*
            <div className="space-y-2">
              <Label className="font-medium">Location (Optional)</Label>
              <div className="flex items-center gap-2">
                  <Input 
                      type="number" 
                      step="any" 
                      placeholder="Latitude" 
                      value={currentLatitude ?? ""}
                      onChange={(e) => {
                          const val = e.target.value;
                          setCurrentLatitude(val === "" ? undefined : parseFloat(val));
                          form.setValue('latitude', val === "" ? undefined : parseFloat(val));
                      }}
                      className="w-1/2"
                  />
                  <Input 
                      type="number" 
                      step="any" 
                      placeholder="Longitude" 
                      value={currentLongitude ?? ""}
                       onChange={(e) => {
                          const val = e.target.value;
                          setCurrentLongitude(val === "" ? undefined : parseFloat(val));
                          form.setValue('longitude', val === "" ? undefined : parseFloat(val));
                      }}
                      className="w-1/2"
                  />
              </div>
              <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant="outline" onClick={handleLogCurrentLocation} className="w-full">
                    <MapPin className="mr-2 h-4 w-4" /> Log Current (Mock)
                  </Button>
                  <Button 
                      type="button" 
                      variant="outline" 
                      onClick={handleSuggestCompany} 
                      disabled={isSuggestingCompany || currentLatitude === undefined || currentLongitude === undefined}
                      className="w-full"
                  >
                    {isSuggestingCompany ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    Suggest Company
                  </Button>
              </div>
              { (form.formState.errors.latitude || form.formState.errors.longitude) && (
                  <p className="text-sm text-destructive mt-1">Please enter valid coordinates.</p>
              )}
            </div>
            */}

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Visit Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Details about the visit, key discussion points, etc."
                      className="mt-1 min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={isSaving || isSuggestingCompany}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving || isSuggestingCompany}>
                {(isSaving || isSuggestingCompany) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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

