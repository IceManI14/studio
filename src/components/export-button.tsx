
'use client';

import type { Visit } from '@/lib/types';
import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ExportButtonProps {
  visits: Visit[];
  size?: ButtonProps['size'];
  className?: string;
}

const ExportButton: React.FC<ExportButtonProps> = ({ visits, size, className }) => {

  const handleExport = () => {
    if (visits.length === 0) {
      console.warn('No Data to Export: There are no visits logged to export.');
      return;
    }

    const headers = [
      'ID', 'Timestamp', 'Latitude', 'Longitude',
      'Company Name', 'Notes', 'Contact Info',
      'Contact Confidence', 'Notes Summary', 'Partnership Confidence',
      'Has Business Card', 'Business Card Image URL', 'Discussed Competitors', 'Competitor Name',
      'Cooler Type', 'Decision Maker Name', 'Decision Maker Title',
      'Decision Maker Contact', 'Visit Number', 'Interested Unit',
      'Has TDS Reading', 'TDS Value', 'Future Meeting Set',
      'Future Meeting DateTime', 'Free Trial', 'Deal Closed'
    ];

    const rows = visits.map(visit => [
      visit.id,
      new Date(visit.timestamp).toISOString(),
      visit.latitude ?? '',
      visit.longitude ?? '',
      `"${(visit.companyName ?? '').replace(/"/g, '""')}"`,
      `"${(visit.notes ?? '').replace(/"/g, '""')}"`,
      `"${(visit.contactInfo?.info ?? '').replace(/"/g, '""')}"`,
      visit.contactInfo?.confidence ?? '',
      `"${(visit.notesSummary ?? '').replace(/"/g, '""')}"`,
      visit.partnershipConfidence ?? '',
      visit.hasBusinessCard ? 'Yes' : 'No',
      `"${(visit.businessCardImageUrl ?? '').replace(/"/g, '""')}"`,
      visit.discussedCompetitors ? 'Yes' : 'No',
      `"${(visit.competitorName ?? '').replace(/"/g, '""')}"`,
      `"${(visit.coolerType ?? '').replace(/"/g, '""')}"`,
      `"${(visit.decisionMakerName ?? '').replace(/"/g, '""')}"`,
      `"${(visit.decisionMakerTitle ?? '').replace(/"/g, '""')}"`,
      `"${(visit.decisionMakerContact ?? '').replace(/"/g, '""')}"`,
      visit.visitNumber ?? '',
      `"${(visit.interestedUnit ?? '').replace(/"/g, '""')}"`,
      visit.hasTDSReading ? 'Yes' : 'No',
      visit.tdsValue ?? '',
      visit.futureMeetingSet ? 'Yes' : 'No',
      visit.futureMeetingDateTime ? new Date(visit.futureMeetingDateTime).toISOString() : '',
      visit.freeTrial ? 'Yes' : 'No',
      visit.dealClosed ? 'Yes' : 'No',
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
        console.log('Export Successful: Visits data downloaded as CSV.');
      } else {
        throw new Error("Download feature not supported in this browser.");
      }
    } catch (error) {
        console.error("Export failed:", error);
    }
  };

  return (
    <Button onClick={handleExport} variant="default" disabled={visits.length === 0} size={size} className={cn(className)}>
      Export CSV
    </Button>
  );
};

export default ExportButton;
