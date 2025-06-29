
'use client';

import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, UploadCloud, FileCheck } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { fileToDataUri } from '@/lib/utils';

interface TerritoryUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TerritoryUploadModal({ isOpen, onClose }: TerritoryUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
        console.error("Invalid File Type", "Please select a PDF file.");
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      console.warn("No file selected", "Please select your territory PDF.");
      return;
    }

    setIsUploading(true);
    
    try {
      const dataUri = await fileToDataUri(selectedFile);

      // Store the Data URI for future use with Debbie AI
      localStorage.setItem('userTerritoryPdfUrl', dataUri);
      // Set flag to not show this modal again
      localStorage.setItem('territoryPdfUploaded', 'true');
      
      console.log("Territory File Stored!", "Debbie now has your territory information.");

      onClose(); // Close the modal
    } catch (error: any) {
      console.error("File Processing Failed", error.message || "Could not read the PDF file.");
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
            Upload to Debbie
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
