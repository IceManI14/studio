
'use client';

import type { Visit } from '@/lib/types';
import { Button, type ButtonProps } from '@/components/ui/button';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatInTimeZone } from 'date-fns-tz';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { FileDown } from 'lucide-react';

interface ExportPdfButtonProps {
  visits: Visit[];
  size?: ButtonProps['size'];
  className?: string;
  label?: string;
}

const ExportPdfButton: React.FC<ExportPdfButtonProps> = ({ visits, size, className, label = "Export All Visits to PDF" }) => {
  const { toast } = useToast();
  const timeZone = 'America/New_York';

  const handleExportPdf = () => {
    if (visits.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Data to Export',
        description: 'There are no visits to export as a PDF.',
      });
      return;
    }

    try {
      const doc = new jsPDF({
        orientation: 'landscape',
      });
      
      doc.setFontSize(18);
      doc.text('Optimum Trailblazer - Company Visits', 14, 22);
      doc.setFontSize(11);
      doc.setTextColor(100); // Grey for subtitle
      const exportDate = formatInTimeZone(new Date(), timeZone, 'MMM d, yyyy, h:mm a');
      doc.text(`Exported on: ${exportDate}`, 14, 30);

      const tableColumn = [
        "Date",
        "Company",
        "City",
        "Confidence",
        "Summary",
        "Units",
        "DM Contact",
        "Competitor",
        "Trial",
        "Deal Closed",
        "Price",
      ];

      const tableRows = visits.map(visit => {
        const visitDate = visit.timestamp ? formatInTimeZone(new Date(visit.timestamp), timeZone, 'MM/dd/yy') : 'N/A';
        const safeToString = (val: any): string => {
            if (val === null || val === undefined) return 'N/A';
            return val.toString();
        };

        return [
          visitDate,
          visit.companyName || 'N/A',
          visit.city || 'N/A',
          visit.partnershipConfidence ? `${visit.partnershipConfidence}/5` : 'N/A',
          visit.notesSummary || 'N/A',
          (visit.interestedUnits && visit.interestedUnits.length > 0) ? visit.interestedUnits.join(', ') : 'N/A',
          visit.decisionMakerContact || 'N/A',
          visit.competitorName || (visit.discussedCompetitors ? 'Yes' : 'No'),
          visit.freeTrial ? 'Yes' : 'No',
          visit.dealClosed ? 'Yes' : 'No',
          visit.priceQuoted ? `$${Number(visit.priceQuoted).toFixed(2)}` : 'N/A',
        ];
      });

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 35,
        theme: 'striped',
        headStyles: { fillColor: [36, 93, 154] }, // Nautical dark blue
        styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
        columnStyles: {
          0: { cellWidth: 18 }, // Date
          1: { cellWidth: 40 }, // Company
          2: { cellWidth: 25 }, // City
          3: { cellWidth: 15 }, // Confidence
          4: { cellWidth: 'auto' }, // Summary
          5: { cellWidth: 20 }, // Units
          6: { cellWidth: 25 }, // DM Contact
          7: { cellWidth: 25 }, // Competitor
          8: { cellWidth: 12 }, // Trial
          9: { cellWidth: 15 }, // Deal Closed
          10: { cellWidth: 15 }, // Price
        },
        didDrawPage: function (data) {
          let str = "Page " + doc.internal.getNumberOfPages();
          doc.setFontSize(10);
          let pageSize = doc.internal.pageSize;
          let pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
          doc.text(str, data.settings.margin.left, pageHeight - 10);
        }
      });
      
      const pdfFilename = `optimum_trailblazer_visits_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(pdfFilename);

      toast({
        title: 'PDF Export Started',
        description: `Your file '${pdfFilename}' is downloading. Please check your browser's downloads.`,
        duration: 7000,
      });

    } catch (error: any) {
      console.error("PDF Export Error:", error);
      toast({
        variant: 'destructive',
        title: 'PDF Export Failed',
        description: `Could not generate the PDF. Error: ${error.message}`,
      });
    }
  };

  return (
    <Button onClick={handleExportPdf} variant="outline" disabled={visits.length === 0} size={size} className={cn("w-full", className)}>
       <FileDown className="mr-2 h-4 w-4" />
      {label}
    </Button>
  );
};

export default ExportPdfButton;

    