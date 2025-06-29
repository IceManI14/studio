'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, File, Trash2 } from 'lucide-react';
import type { ManagedFile } from '@/lib/types';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';

interface ManageFilesModalProps {
    isOpen: boolean;
    onClose: () => void;
    managedFiles: ManagedFile[];
    onFilesChange: (files: ManagedFile[]) => void;
}

export default function ManageFilesModal({ isOpen, onClose, managedFiles, onFilesChange }: ManageFilesModalProps) {
    const [isUploading, setIsUploading] = useState(false);
    const { toast } = useToast();

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const allowedTypes = ["application/pdf", "text/csv"];
        if (!allowedTypes.includes(file.type)) {
            toast({ title: "Invalid File Type", description: "Please select a PDF or CSV file.", variant: "destructive" });
            return;
        }

        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/upload-file', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.details || 'Upload failed');
            }

            const result = await response.json();
            const newFile: ManagedFile = {
                name: result.name,
                url: result.url,
                type: result.type,
                uploadedAt: new Date().toISOString(),
            };

            onFilesChange([...managedFiles, newFile]);

            toast({
                title: 'File Uploaded',
                description: `${newFile.name} is now available for Debbie to use.`,
            });
        } catch (error: any) {
            toast({
                title: "Upload Failed",
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setIsUploading(false);
            // Reset file input
            if (event.target) {
              event.target.value = '';
            }
        }
    };
    
    const handleDeleteFile = (urlToDelete: string) => {
        const updatedFiles = managedFiles.filter(f => f.url !== urlToDelete);
        onFilesChange(updatedFiles);
        toast({
            title: "File Removed",
            description: "The file will no longer be used as context by the AI.",
        });
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Manage AI Context Files</DialogTitle>
                    <DialogDescription>
                        Upload and manage files for Debbie to use as long-term context in your conversations.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                         <label htmlFor="context-file-upload" className="sr-only">Upload file</label>
                         <Input
                            id="context-file-upload"
                            type="file"
                            accept="application/pdf,text/csv"
                            onChange={handleFileChange}
                            disabled={isUploading}
                         />
                         {isUploading && <p className="text-sm text-muted-foreground flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading...</p>}
                    </div>

                    <Separator />
                    
                    <div className="space-y-2">
                        <h3 className="text-sm font-medium text-foreground">Available Files</h3>
                        {managedFiles.length > 0 ? (
                             <ScrollArea className="h-48 rounded-md border p-2">
                                <ul className="space-y-2">
                                {managedFiles.map((file) => (
                                    <li key={file.url} className="flex items-center justify-between p-2 rounded-md bg-secondary/50">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <File className="h-4 w-4 shrink-0 text-primary" />
                                            <span className="truncate text-sm" title={file.name}>{file.name}</span>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => handleDeleteFile(file.url)}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                            <span className="sr-only">Delete {file.name}</span>
                                        </Button>
                                    </li>
                                ))}
                                </ul>
                            </ScrollArea>
                        ) : (
                            <div className="text-center text-sm text-muted-foreground p-4 rounded-md border border-dashed">
                                No files uploaded yet.
                            </div>
                        )}
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
