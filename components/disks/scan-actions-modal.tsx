'use client';

import { SearchCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { ScanButton } from '@/components/disks/scan-button';

type ScanActionsModalProps = {
  diskId: string;
};

export function ScanActionsModal({ diskId }: ScanActionsModalProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-9 rounded-xl">
          <SearchCheck className="h-4 w-4" />
          Scanner
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl rounded-2xl">
        <DialogHeader>
          <DialogTitle>Scanner le disque</DialogTitle>
          <DialogDescription>
            Choisis le type de scan et le niveau maximal à explorer.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 pt-2 md:grid-cols-2">
          <div className="space-y-3 rounded-2xl border bg-muted/20 p-4">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">Scan différentiel</h3>
              <p className="text-xs text-muted-foreground">
                Met à jour l’index en comparant les changements détectés depuis
                le dernier scan.
              </p>
            </div>

            <ScanButton diskId={diskId} scanType="DIFFERENTIAL" />
          </div>

          <div className="space-y-3 rounded-2xl border bg-muted/20 p-4">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">Scan complet</h3>
              <p className="text-xs text-muted-foreground">
                Relance une analyse complète du disque. Plus long, mais utile
                pour une réindexation totale.
              </p>
            </div>

            <ScanButton diskId={diskId} scanType="FULL" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}