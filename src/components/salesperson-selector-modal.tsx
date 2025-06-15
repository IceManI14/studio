
'use client';

import type { Salesperson } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { UserCheck } from 'lucide-react';

interface SalespersonSelectorModalProps {
  salespeople: Salesperson[];
  onSelectSalesperson: (salesperson: Salesperson) => void;
}

const SalespersonSelectorModal: React.FC<SalespersonSelectorModalProps> = ({ salespeople, onSelectSalesperson }) => {
  return (
    <Dialog open={true} onOpenChange={() => { /* Controlled by parent rendering */ }}>
      <DialogContent 
        className="sm:max-w-[425px] shadow-2xl" 
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="pt-2">
          <DialogTitle className="flex items-center text-2xl font-headline text-primary">
            <UserCheck className="mr-3 h-8 w-8" />
            Select Your Profile
          </DialogTitle>
          <DialogDescription className="text-base pt-2">
            Please choose your profile to continue. Your activities and logs will be saved under your name.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-6">
          {salespeople.map((salesperson) => (
            <Button
              key={salesperson.id}
              onClick={() => onSelectSalesperson(salesperson)}
              variant="outline"
              size="lg"
              className="w-full justify-start text-md py-7 rounded-lg hover:bg-primary/10 focus:ring-2 focus:ring-primary"
            >
              {salesperson.name}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SalespersonSelectorModal;
