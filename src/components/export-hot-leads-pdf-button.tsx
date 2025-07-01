
'use client';

import type { HotLead } from '@/lib/types';
import { Button, type ButtonProps } from '@/components/ui/button';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatInTimeZone } from 'date-fns-tz';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Download } from 'lucide-react';

interface ExportHotLeadsPdfButtonProps {
  hotLeads: HotLead[];
  size?: ButtonProps['size'];
  className?: string;
}

const ExportHotLeadsPdfButton: React.FC<ExportHotLeadsPdfButtonProps> = ({ hotLeads, size, className }) => {
  const { toast } = useToast();
  const timeZone = 'America/New_York';

  const handleExportPdf = () => {
    if (hotLeads.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Data to Export',
        description: 'There are no hot leads to export as a PDF.',
      });
      return;
    }

    try {
      const doc = new jsPDF();
      
      doc.setFontSize(18);
      doc.text('Optimum Trailblazer - Hot Leads List', 14, 22);
      doc.setFontSize(11);
      doc.setTextColor(100);
      const exportDate = formatInTimeZone(new Date(), timeZone, 'MMM d, yyyy, h:mm a');
      doc.text(`Exported on: ${exportDate}`, 14, 30);

      const tableColumn = [
        "Company Name",
        "Address",
        "City",
        "Phone",
        "Added At",
        "Notes",
      ];

      const tableRows = hotLeads.map(lead => {
        const addedDate = lead.addedAt ? formatInTimeZone(new Date(lead.addedAt), timeZone, 'MM/dd/yy, h:mm a') : 'N/A';
        return [
          lead.companyName || 'N/A',
          lead.address || 'N/A',
          lead.city || 'N/A',
          lead.phone || 'N/A',
          addedDate,
          lead.notes || 'N/A',
        ];
      });

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 35,
        theme: 'striped',
        headStyles: { fillColor: [36, 104, 180] },
        styles: { fontSize: 8, cellPadding: 1.5, overflow: 'linebreak' },
        columnStyles: {
            5: { cellWidth: 50 }, // Notes column width
        },
        didDrawPage: function (data) {
          let str = "Page " + doc.internal.getNumberOfPages();
          doc.setFontSize(10);
          let pageSize = doc.internal.pageSize;
          let pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
          doc.text(str, data.settings.margin.left, pageHeight - 10);
        }
      });
      
      const pdfFilename = `optimum_trailblazer_hot_leads_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(pdfFilename);

      toast({
        title: 'PDF Export Successful',
        description: `${pdfFilename} has been downloaded.`,
      });

    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'PDF Export Failed',
        description: 'Could not generate or download the PDF file.',
      });
    }
  };

  return (
    <Button onClick={handleExportPdf} variant="default" disabled={hotLeads.length === 0} size={size} className={cn(className)}>
      <Download className="mr-2 h-4 w-4" />
      Export PDF
    </Button>
  );
};

export default ExportHotLeadsPdfButton;
