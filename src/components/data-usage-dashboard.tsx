
'use client';

import { useState, useEffect, useMemo } from 'react';
import type { Visit, HotLead, ManagedFile } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Database, CloudUpload, AlertTriangle, Save, Server } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DataUsageDashboardProps {
  visits: Visit[];
  hotLeads: HotLead[];
  managedFiles: ManagedFile[];
}

// Helper to estimate object size in bytes
const getObjectSize = (obj: any): number => {
  try {
    return new TextEncoder().encode(JSON.stringify(obj)).length;
  } catch (e) {
    return 0;
  }
};

const formatBytes = (bytes: number, decimals = 2): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export default function DataUsageDashboard({ visits, hotLeads, managedFiles }: DataUsageDashboardProps) {
  const [dataThreshold, setDataThreshold] = useState<number>(500); // Default 500 MB
  const [monthlyUploads, setMonthlyUploads] = useState<number>(0); // in bytes
  const { toast } = useToast();

  useEffect(() => {
    const storedThreshold = localStorage.getItem('dataUsageThreshold');
    if (storedThreshold) {
      setDataThreshold(Number(storedThreshold));
    }

    const storedUploads = localStorage.getItem('monthlyUploads');
    if (storedUploads) {
      const { month, size } = JSON.parse(storedUploads);
      const currentMonth = new Date().getMonth();
      if (month === currentMonth) {
        setMonthlyUploads(size);
      } else {
        localStorage.removeItem('monthlyUploads');
      }
    }
  }, []);

  const localDataSize = useMemo(() => {
    const visitsSize = getObjectSize(visits);
    const hotLeadsSize = getObjectSize(hotLeads);
    const managedFilesSize = getObjectSize(managedFiles);
    // Add other local storage items if necessary
    const suggestionsSize = getObjectSize(JSON.parse(localStorage.getItem('submittedSuggestions') || '[]'));
    const newsSize = getObjectSize(JSON.parse(localStorage.getItem('companyNews') || '[]'));
    const territorySize = (localStorage.getItem('userTerritoryPdfUrl') || '').length;

    return visitsSize + hotLeadsSize + managedFilesSize + suggestionsSize + newsSize + territorySize;
  }, [visits, hotLeads, managedFiles]);

  const handleSetThreshold = () => {
    localStorage.setItem('dataUsageThreshold', String(dataThreshold));
    toast({
      title: 'Threshold Saved',
      description: `Your new data usage threshold is ${dataThreshold} MB.`,
    });
  };
  
  const estimatedMonthlyUploads = useMemo(() => {
    const dailyReportsSize = getObjectSize(visits.filter(v => new Date(v.timestamp).getMonth() === new Date().getMonth())) * 0.1; // Estimate CSV size
    const managedFilesSize = managedFiles.reduce((acc, file) => {
        // This is a rough estimation as we don't have file sizes. Assume avg 1MB for PDFs, 100KB for CSVs.
        return acc + (file.type === 'application/pdf' ? 1024 * 1024 : 100 * 1024);
    }, 0);
    const businessCardsSize = visits.reduce((acc, visit) => {
        // Rough estimation, assume 200KB per card image
        let size = 0;
        if(visit.businessCardImageFrontUrl) size += 200 * 1024;
        if(visit.businessCardImageBackUrl) size += 200 * 1024;
        return acc + size;
    }, 0);

    return dailyReportsSize + managedFilesSize + businessCardsSize + monthlyUploads;
  }, [visits, managedFiles, monthlyUploads]);


  const usagePercentage = useMemo(() => {
    const thresholdBytes = dataThreshold * 1024 * 1024;
    if (thresholdBytes === 0) return 0;
    return Math.min((estimatedMonthlyUploads / thresholdBytes) * 100, 100);
  }, [estimatedMonthlyUploads, dataThreshold]);

  const isOverThreshold = useMemo(() => {
    const thresholdBytes = dataThreshold * 1024 * 1024;
    return estimatedMonthlyUploads > thresholdBytes;
  }, [estimatedMonthlyUploads, dataThreshold]);


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><Server className="mr-3 h-5 w-5 text-primary" /> Local Device Storage</CardTitle>
          <CardDescription>
            This is the amount of data the app is currently storing on your device. This does not incur cloud costs.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-3xl font-bold text-foreground">
          {formatBytes(localDataSize)}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><CloudUpload className="mr-3 h-5 w-5 text-primary" /> Estimated Cloud Uploads</CardTitle>
          <CardDescription>
            An estimate of your data uploads to the cloud for the current month. This includes reports, images, and managed files.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-3xl font-bold text-foreground">
            {formatBytes(estimatedMonthlyUploads)}
            <span className="text-base font-normal text-muted-foreground"> / {dataThreshold} MB</span>
          </div>
          <Progress value={usagePercentage} className={isOverThreshold ? '[&>div]:bg-destructive' : ''} />
          {isOverThreshold && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Warning: Threshold Exceeded</AlertTitle>
              <AlertDescription>
                Your estimated monthly data usage has exceeded your set threshold.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><AlertTriangle className="mr-3 h-5 w-5 text-primary" /> Set Usage Threshold</CardTitle>
          <CardDescription>
            Set a monthly cloud upload threshold in Megabytes (MB) to receive a warning if usage gets too high.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Label htmlFor="threshold-input" className="sr-only">Data Threshold in MB</Label>
          <Input
            id="threshold-input"
            type="number"
            value={dataThreshold}
            onChange={(e) => setDataThreshold(Number(e.target.value))}
            className="max-w-[120px]"
            min="1"
          />
          <span className="text-muted-foreground">MB</span>
          <Button onClick={handleSetThreshold}><Save className="mr-2 h-4 w-4" /> Save Threshold</Button>
        </CardContent>
      </Card>

    </div>
  );
}
