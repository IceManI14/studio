
'use client';

import type { Visit } from '@/lib/types';
import { Button, type ButtonProps } from '@/components/ui/button';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatInTimeZone } from 'date-fns-tz';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { FileDown, Star, CalendarDays, FileText, Sparkles, Contact, FileType, CalendarClock, Swords, PackageCheck, Droplets, DollarSign } from 'lucide-react';
import { calculateCommission } from '@/app/page';

interface ExportDetailedPdfButtonProps {
  visits: Visit[];
  size?: ButtonProps['size'];
  className?: string;
  label?: string;
  salespersonName?: string;
  reportTitle?: string;
  variant?: ButtonProps['variant'];
}

const ExportDetailedPdfButton: React.FC<ExportDetailedPdfButtonProps> = ({
  visits,
  size,
  className,
  label = "Export Detailed PDF",
  salespersonName,
  reportTitle = "Company Visits - Detailed Report",
  variant = "default",
}) => {
  const { toast } = useToast();
  const timeZone = 'America/New_York';

  const handleExportPdf = () => {
    if (visits.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Data to Export',
        description: 'There are no visits to export as a detailed PDF.',
      });
      return;
    }

    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: 'a4',
      });
      
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      let yPos = 0;

      const drawHeader = (pageNumber: number) => {
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        const title = salespersonName ? `Optimum Trailblazer - ${salespersonName}` : 'Optimum Trailblazer';
        doc.text(title, margin, 30);
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(50, 50, 50);
        doc.text(reportTitle, margin, 45);
        
        doc.setFontSize(9);
        doc.setTextColor(100);
        const exportDate = formatInTimeZone(new Date(), timeZone, 'MMM d, yyyy, h:mm a');
        doc.text(`Exported on: ${exportDate}`, pageWidth - margin, 30, { align: 'right' });
        
        if (pageNumber > 1) {
             doc.text(`Page ${pageNumber}`, pageWidth - margin, 45, { align: 'right' });
        }
        yPos = 65;
      };

      visits.forEach((visit, index) => {
        if (index > 0) {
            doc.addPage();
        }
        drawHeader(index + 1);

        doc.setLineWidth(1.5);
        doc.setDrawColor(36, 93, 154); // Nautical dark blue
        doc.rect(margin, yPos - 10, pageWidth - (margin * 2), 260, 'S');
        yPos += 5;

        // Company Name & City
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(visit.companyName, pageWidth / 2, yPos, { align: 'center' });
        yPos += 15;
        if(visit.city) {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100);
            doc.text(visit.city, pageWidth / 2, yPos, { align: 'center' });
            yPos += 10;
        }

        doc.setLineWidth(0.5);
        doc.setDrawColor(200);
        doc.line(margin + 5, yPos, pageWidth - margin - 5, yPos);
        yPos += 15;
        
        const columnGap = 200;
        const leftColX = margin + 10;
        const rightColX = leftColX + columnGap;
        let leftY = yPos;
        let rightY = yPos;

        const addText = (text: string, x: number, y: number, options?: any) => {
            const lines = doc.splitTextToSize(text, (pageWidth - margin * 2 - 20) / 2);
            doc.text(lines, x, y, options);
            return y + (lines.length * 10);
        };

        const addSection = (title: string, content: (string | null | undefined)[], icon?: any) => {
            const validContent = content.filter(c => c);
            if (validContent.length === 0) return { leftY, rightY };

            if (leftY <= rightY) {
                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.text(title, leftColX, leftY);
                leftY += 12;
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                validContent.forEach(line => {
                    leftY = addText(line!, leftColX + 5, leftY);
                });
                leftY += 10;
            } else {
                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.text(title, rightColX, rightY);
                rightY += 12;
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                validContent.forEach(line => {
                    rightY = addText(line!, rightColX + 5, rightY);
                });
                rightY += 10;
            }
            return { leftY, rightY };
        };
        
        addSection("Timestamp", [formatInTimeZone(new Date(visit.timestamp), timeZone, 'PPPp')]);

        if(visit.notesSummary) addSection("AI Summary", [visit.notesSummary]);
        if(visit.notes) addSection("Visit Notes", [visit.notes]);
        addSection("Decision Maker", [visit.decisionMakerName, visit.decisionMakerTitle, visit.decisionMakerContact]);
        
        const commission = calculateCommission(visit);
        if(commission) addSection("Potential Commission", [`$${commission.value.toFixed(2)} (${commission.reason})`]);

        if(visit.interestedUnits && visit.interestedUnits.length > 0) addSection("Interested Units", visit.interestedUnits);
        
        if(visit.discussedCompetitors) addSection("Competitor", [visit.competitorName, visit.coolerType]);

        if (visit.futureMeetingSet) addSection("Future Meeting", [visit.futureMeetingDateTime ? formatInTimeZone(new Date(visit.futureMeetingDateTime), timeZone, 'PPPp') : 'To be scheduled']);

        if(visit.freeTrial) addSection("Free Trial", [`Starts: ${visit.freeTrialStartDate ? formatInTimeZone(new Date(visit.freeTrialStartDate), timeZone, 'PPP') : 'N/A'}`]);
        
        if (visit.pricingDiscussed) addSection("Pricing", [
            `Quoted: $${visit.priceQuoted?.toFixed(2) || 'N/A'}`,
            `Lease: ${visit.leaseTerm || 'N/A'} months`,
            `Install: $${visit.installationFee?.toFixed(2) || 'N/A'}`
        ]);
        
        yPos = Math.max(leftY, rightY) + 20;

      });

      const pdfFilename = `optimum_trailblazer_detailed_report_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(pdfFilename);

      toast({
        title: 'PDF Export Started',
        description: `Your file '${pdfFilename}' is downloading.`,
        duration: 7000,
      });

    } catch (error: any) {
      console.error("Detailed PDF Export Error:", error);
      toast({
        variant: 'destructive',
        title: 'PDF Export Failed',
        description: `Could not generate the detailed PDF. Error: ${error.message}`,
      });
    }
  };

  return (
    <Button onClick={handleExportPdf} variant={variant} disabled={visits.length === 0} size={size} className={cn(className)}>
       <FileDown className="mr-2 h-4 w-4" />
      {label}
    </Button>
  );
};

export default ExportDetailedPdfButton;

    