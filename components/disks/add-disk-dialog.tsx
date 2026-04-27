'use client';

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { DiskForm } from '@/components/disks/disk-form';

type AddDiskDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AddDiskDialog({
  open,
  onOpenChange
}: AddDiskDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Ajouter un disque
          </DialogTitle>
          <DialogDescription>
            Enregistre un nouveau disque à indexer sans occuper l’espace du dashboard.
          </DialogDescription>
        </DialogHeader>

        <div className="pt-2">
          <DiskForm />
        </div>
      </DialogContent>
    </Dialog>
  );
}