
'use client';

import type { HotLead } from '@/lib/types';
import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Download } from 'lucide-react';

interface ExportHotLeadsCsvButtonProps {
  hotLeads: HotLead[];
  size?: ButtonProps['size'];
  className?: string;
}

const ExportHotLeadsCsvButton: React.FC<ExportHotLeadsCsvButtonProps> = ({ hotLeads, size, className }) => {
  const { toast } = useToast();

  const handleExport = () => {
    if (hotLeads.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Data to Export',
        description: 'There are no hot leads to export.',
      });
      return;
    }

    const headers = [
      'ID', 'Company Name', 'Address', 'City', 'Phone', 'Latitude', 'Longitude', 'Added At', 'Notes'
    ];

    const rows = hotLeads.map(lead => [
      lead.id,
      `"${(lead.companyName ?? '').replace(/"/g, '""')}"`,
      `"${(lead.address ?? '').replace(/"/g, '""')}"`,
      `"${(lead.city ?? '').replace(/"/g, '""')}"`,
      `"${(lead.phone ?? '').replace(/"/g, '""')}"`,
      lead.latitude ?? '',
      lead.longitude ?? '',
      new Date(lead.addedAt).toISOString(),
      `"${(lead.notes ?? '').replace(/"/g, '""')}"`,
    ].join(','));

    const csvContent = [headers.join(','), ...rows].join('\n');
    
    try {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `optimum_trailblazer_hot_leads_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast({
          title: 'Export Successful',
          description: 'Hot leads data has been downloaded as a CSV file.',
        });
      } else {
        throw new Error("Download feature not supported in this browser.");
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Export Failed',
        description: 'Could not download the CSV file.',
      });
    }
  };

  return (
    <Button onClick={handleExport} variant="default" disabled={hotLeads.length === 0} size={size} className={cn(className)}>
      <Download className="mr-2 h-4 w-4" />
      Export CSV
    </Button>
  );
};

export default ExportHotLeadsCsvButton;
