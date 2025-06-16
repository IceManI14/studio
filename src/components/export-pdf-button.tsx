
'use client';

import type { Visit } from '@/lib/types';
import { Button, type ButtonProps } from '@/components/ui/button';
import { ArrowDown } from 'lucide-react'; // Changed from Printer to ArrowDown
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatInTimeZone } from 'date-fns-tz';
import { cn } from '@/lib/utils';

interface ExportPdfButtonProps {
  visits: Visit[];
  size?: ButtonProps['size'];
  className?: string;
}

const ExportPdfButton: React.FC<ExportPdfButtonProps> = ({ visits, size, className }) => {
  const { toast } = useToast();
  const timeZone = 'America/New_York';

  const handleExportPdf = () => {
    if (visits.length === 0) {
      toast({
        title: 'No Data to Export',
        description: 'There are no visits logged to export as PDF.',
        variant: 'default',
      });
      return;
    }

    try {
      const doc = new jsPDF();
      
      doc.setFontSize(18);
      doc.text('Optimum Trailblazer - Company Visits', 14, 22);
      doc.setFontSize(11);
      doc.setTextColor(100); // Grey for subtitle
      const exportDate = formatInTimeZone(new Date(), timeZone, 'MMM d, yyyy, h:mm a');
      doc.text(`Exported on: ${exportDate}`, 14, 30);

      const tableColumn = [
        "Date",
        "Company",
        "Visit #",
        "Confidence",
        "Summary",
        "Contact Info",
        "DM Name",
        "DM Title",
        "DM Contact",
        "Competitor",
        "Cooler",
      ];

      const tableRows = visits.map(visit => {
        const visitDate = visit.timestamp ? formatInTimeZone(new Date(visit.timestamp), timeZone, 'MM/dd/yy, h:mm a') : 'N/A';
        return [
          visitDate,
          visit.companyName || 'N/A',
          visit.visitNumber?.toString() ?? 'N/A',
          visit.partnershipConfidence ? `${visit.partnershipConfidence} star(s)` : 'N/A',
          visit.notesSummary || 'N/A',
          visit.contactInfo?.info || 'N/A',
          visit.decisionMakerName || 'N/A',
          visit.decisionMakerTitle || 'N/A',
          visit.decisionMakerContact || 'N/A',
          visit.competitorName || (visit.discussedCompetitors ? 'Yes (Unspecified)' : 'No'),
          visit.coolerType || (visit.discussedCompetitors ? 'N/A' : 'N/A'),
        ];
      });

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 35,
        theme: 'striped',
        headStyles: { fillColor: [36, 104, 180] }, // A blue shade for header (approx. HSL primary)
        styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak' },
        columnStyles: {
          0: { cellWidth: 25 }, // Date
          1: { cellWidth: 25 }, // Company
          2: { cellWidth: 12 }, // Visit #
          3: { cellWidth: 18 }, // Confidence
          // Remaining columns will auto-adjust or can be specified
        },
        didDrawPage: function (data) {
          // Footer with page number
          let str = "Page " + doc.internal.getNumberOfPages();
          doc.setFontSize(10);
          // jsPDF 1.4+ uses getWidth, <1.4 uses .width
          let pageSize = doc.internal.pageSize;
          let pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
          doc.text(str, data.settings.margin.left, pageHeight - 10);
        }
      });
      
      const pdfFilename = `optimum_trailblazer_visits_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(pdfFilename);

      toast({
        title: 'PDF Export Successful',
        description: `${pdfFilename} has been downloaded.`,
      });

    } catch (error) {
      console.error("PDF Export failed:", error);
      toast({
        title: 'PDF Export Failed',
        description: 'An error occurred while generating the PDF.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Button onClick={handleExportPdf} variant="default" disabled={visits.length === 0} size={size} className={cn(className)}>
      <ArrowDown className="mr-2 h-4 w-4" /> {/* Changed from Printer to ArrowDown */}
      Export PDF
    </Button>
  );
};

export default ExportPdfButton;
