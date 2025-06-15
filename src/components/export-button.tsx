'use client';

import type { Visit } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ExportButtonProps {
  visits: Visit[];
}

const ExportButton: React.FC<ExportButtonProps> = ({ visits }) => {
  const { toast } = useToast();

  const handleExport = () => {
    if (visits.length === 0) {
      toast({
        title: 'No Data to Export',
        description: 'There are no visits logged to export.',
        variant: 'default',
      });
      return;
    }

    const headers = [
      'ID', 'Timestamp', 'Latitude', 'Longitude',
      'Company Name', 'Notes', 'Contact Info',
      'Contact Confidence', 'Notes Summary'
    ];

    const rows = visits.map(visit => [
      visit.id,
      new Date(visit.timestamp).toISOString(),
      visit.latitude ?? '',
      visit.longitude ?? '',
      `"${visit.companyName.replace(/"/g, '""')}"`, // Escape double quotes
      `"${(visit.notes ?? '').replace(/"/g, '""')}"`,
      `"${(visit.contactInfo?.info ?? '').replace(/"/g, '""')}"`,
      visit.contactInfo?.confidence ?? '',
      `"${(visit.notesSummary ?? '').replace(/"/g, '""')}"`
    ].join(','));

    const csvContent = [headers.join(','), ...rows].join('\n');
    
    try {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      if (link.download !== undefined) { // Feature detection
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `optimum_trailblazer_visits_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast({ title: 'Export Successful', description: 'Visits data downloaded as CSV.' });
      } else {
        throw new Error("Download feature not supported in this browser.");
      }
    } catch (error) {
        console.error("Export failed:", error);
        toast({ title: 'Export Failed', description: 'Could not download CSV file.', variant: 'destructive'});
    }
  };

  return (
    <Button onClick={handleExport} variant="outline" disabled={visits.length === 0}>
      <Download className="mr-2 h-4 w-4" />
      Export CSV
    </Button>
  );
};

export default ExportButton;
