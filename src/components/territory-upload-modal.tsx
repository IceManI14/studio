
'use client';

import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UploadCloud, FileCheck } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

interface TerritoryUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TerritoryUploadModal({ isOpen, onClose }: TerritoryUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
        toast({ title: "Invalid File Type", description: "Please select a PDF file.", variant: "destructive" });
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({ title: "No file selected", description: "Please select your territory PDF.", variant: "default" });
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('pdfFile', selectedFile);

    try {
      const response = await fetch('/api/upload-pdf', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to upload PDF');
      }

      const result = await response.json();

      // Store the URL for future use with Debbie AI
      localStorage.setItem('userTerritoryPdfUrl', result.url);
      // Set flag to not show this modal again
      localStorage.setItem('territoryPdfUploaded', 'true');
      
      toast({
        title: "Territory File Uploaded!",
        description: "Debbie now has your territory information. Thank you!",
      });

      onClose(); // Close the modal
    } catch (error: any) {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="sm:max-w-[480px] shadow-2xl bg-card/80 backdrop-blur-md border-primary/30"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center text-2xl font-headline text-primary">
            <UploadCloud className="mr-3 h-8 w-8" />
            Upload Your Territory File
          </DialogTitle>
          <DialogDescription className="text-base pt-2 text-foreground/80">
            To get started, please provide your sales territory PDF to Debbie, your AI assistant. This helps her provide personalized guidance.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <Alert>
            <FileCheck className="h-4 w-4" />
            <AlertTitle>Why is this needed?</AlertTitle>
            <AlertDescription>
              Your territory file contains the boundaries and locations you're responsible for. Providing this to Debbie allows her to give you smarter suggestions, optimize routes, and analyze your performance within your specific area.
            </AlertDescription>
          </Alert>
          <div className="space-y-2">
            <Input
              id="territory-pdf"
              type="file"
              accept="application/pdf"
              ref={fileInputRef}
              onChange={handleFileChange}
              disabled={isUploading}
            />
            {selectedFile && <p className="text-sm text-muted-foreground">Selected: {selectedFile.name}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleUpload} disabled={!selectedFile || isUploading}>
            {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
            Store this file locally for Debbie to use as data
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
