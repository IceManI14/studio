
'use client';

import type { Visit } from '@/lib/types';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
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
import { Loader2, MapPin, Sparkles } from 'lucide-react';

const visitFormSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  notes: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
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


  const form = useForm<VisitFormData>({
    resolver: zodResolver(visitFormSchema),
    defaultValues: {
      companyName: '',
      notes: '',
      latitude: undefined,
      longitude: undefined,
    },
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        companyName: initialData.companyName,
        notes: initialData.notes || '',
        latitude: initialData.latitude,
        longitude: initialData.longitude,
      });
      setCurrentLatitude(initialData.latitude);
      setCurrentLongitude(initialData.longitude);
    } else {
      form.reset({
        companyName: '',
        notes: '',
        latitude: undefined,
        longitude: undefined,
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
    const payload: SaveVisitPayload = {
      id: initialData?.id,
      companyName: data.companyName,
      notes: data.notes,
      latitude: currentLatitude,
      longitude: currentLongitude,
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
        title: initialData ? 'Visit Updated' : 'Visit Logged',
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
            {initialData ? 'Edit Visit' : 'Log New Visit'}
          </DialogTitle>
          <DialogDescription>
            {initialData ? 'Update the details of your company visit.' : 'Add a new company visit to your log.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6 py-2">
          <div>
            <Label htmlFor="companyName" className="font-medium">Company Name</Label>
            <Input
              id="companyName"
              {...form.register('companyName')}
              className="mt-1"
              placeholder="e.g., Acme Corp or suggest from location"
            />
            {form.formState.errors.companyName && (
              <p className="text-sm text-destructive mt-1">{form.formState.errors.companyName.message}</p>
            )}
          </div>
          
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

          <div>
            <Label htmlFor="notes" className="font-medium">Visit Notes</Label>
            <Textarea
              id="notes"
              {...form.register('notes')}
              className="mt-1 min-h-[100px]"
              placeholder="Details about the visit, key discussion points, etc."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving || isSuggestingCompany}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || isSuggestingCompany}>
              {(isSaving || isSuggestingCompany) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {initialData ? 'Save Changes' : 'Log Visit'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default VisitForm;
