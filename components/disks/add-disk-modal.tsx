'use client';

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { DiskForm } from '@/components/disks/disk-form';

export function AddDiskModal() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="rounded-full">
          <Plus className="h-4 w-4" />
          Ajouter un disque
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-2xl p-0">
        <div className="border-b px-6 py-5">
          <DialogHeader>
            <DialogTitle className="text-xl">
              Ajouter un disque
            </DialogTitle>
            <DialogDescription>
              Sélectionne ou renseigne le disque à indexer.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 py-6">
          <DiskForm />
        </div>
      </DialogContent>
    </Dialog>
  );
}