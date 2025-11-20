'use client';

import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/hooks/use-toast';
import { firebaseConfigured } from '@/lib/firebase';
import React, { useEffect } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();

  useEffect(() => {
    if (!firebaseConfigured) {
      toast({
        variant: 'destructive',
        title: 'Firebase Not Configured',
        description: 'Syncing and real-time updates are disabled. Check .env file.',
        duration: 10000,
      });
    }
  }, [toast]);

  return (
    <>
      <div className="relative z-10">
        {children}
      </div>
      <Toaster />
    </>
  );
}
