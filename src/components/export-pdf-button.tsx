
'use client';

import type { Visit } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ExportPdfButtonProps {
  visits: Visit[];
}

const ExportPdfButton: React.FC<ExportPdfButtonProps> = ({ visits }) => {
  const { toast } = useToast();

  const handleExportPdf = () => {
    if (visits.length === 0) {
      toast({
        title: 'No Data to Export',
        description: 'There are no visits logged to export as PDF.',
        variant: 'default',
      });
      return;
    }

    // Placeholder for PDF export functionality
    toast({
      title: 'Export PDF (Not Implemented)',
      description: 'PDF export functionality is not yet available.',
      variant: 'default',
    });
  };

  return (
    <Button onClick={handleExportPdf} variant="outline" disabled={visits.length === 0}>
      <Printer className="mr-2 h-4 w-4" />
      Export PDF
    </Button>
  );
};

export default ExportPdfButton;
