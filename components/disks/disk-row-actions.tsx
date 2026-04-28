'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  MoreHorizontal,
  Trash2,
  PauseCircle,
  PlayCircle,
  Pencil,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';

type DiskRowActionsProps = {
  diskId: string;
  isEnabled: boolean;
  status: 'ACTIVE' | 'INACTIVE' | 'DISCONNECTED';
};

type ApiResponse = {
  success?: boolean;
  error?: string;
};

export function DiskRowActions({
  diskId,
  isEnabled,
  status
}: DiskRowActionsProps) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [loadingAction, setLoadingAction] = useState<
    'toggle' | 'delete' | null
  >(null);

  async function toggleDisk() {
    setLoadingAction('toggle');

    try {
      const response = await fetch(`/api/disks/${diskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          isEnabled: !isEnabled,
          status: !isEnabled ? 'ACTIVE' : 'INACTIVE'
        })
      });

      const payload = (await response.json().catch(() => ({}))) as ApiResponse;

      if (!response.ok) {
        throw new Error(payload.error || 'Impossible de modifier le disque.');
      }

      toast.success(
        !isEnabled ? 'Disque activé' : 'Disque désactivé',
        {
          description: !isEnabled
            ? 'Le disque est à nouveau actif.'
            : 'Le disque a été désactivé.'
        }
      );

      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error('Action impossible', {
        description:
          error instanceof Error
            ? error.message
            : 'Impossible de modifier le disque.'
      });
    } finally {
      setLoadingAction(null);
    }
  }

  async function deleteDisk() {
    setLoadingAction('delete');

    try {
      const response = await fetch(`/api/disks/${diskId}`, {
        method: 'DELETE'
      });

      const payload = (await response.json().catch(() => ({}))) as ApiResponse;

      if (!response.ok) {
        throw new Error(
          payload.error || 'Impossible de supprimer ce disque.'
        );
      }

      toast.success('Disque supprimé', {
        description: 'Le disque et ses données associées ont été supprimés.'
      });

      setConfirmDeleteOpen(false);
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error('Suppression impossible', {
        description:
          error instanceof Error
            ? error.message
            : 'Impossible de supprimer ce disque.'
      });
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="h-9 rounded-xl">
            <MoreHorizontal className="h-4 w-4" />
            Actions
          </Button>
        </DialogTrigger>

        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Actions du disque</DialogTitle>
            <DialogDescription>
              Gère ce disque avec des actions simples et sécurisées.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="h-10 w-full justify-start rounded-xl"
              disabled
            >
              <Pencil className="h-4 w-4" />
              Modifier bientôt
            </Button>

            <Button
              type="button"
              variant="outline"
              className="h-10 w-full justify-start rounded-xl"
              onClick={() => void toggleDisk()}
              disabled={loadingAction !== null}
            >
              {loadingAction === 'toggle' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isEnabled ? (
                <PauseCircle className="h-4 w-4" />
              ) : (
                <PlayCircle className="h-4 w-4" />
              )}

              {isEnabled ? 'Désactiver le disque' : 'Activer le disque'}
            </Button>

            <Button
              type="button"
              variant="destructive"
              className="h-10 w-full justify-start rounded-xl"
              onClick={() => setConfirmDeleteOpen(true)}
              disabled={loadingAction !== null}
            >
              <Trash2 className="h-4 w-4" />
              Supprimer le disque
            </Button>

            <div className="rounded-xl border bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
              Statut actuel : <strong>{status}</strong>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirmer la suppression
            </DialogTitle>
            <DialogDescription>
              Cette action supprimera le disque, ses scans, ses activités et ses
              entrées indexées. Si un scan est en cours, la suppression sera
              refusée.
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setConfirmDeleteOpen(false)}
              disabled={loadingAction === 'delete'}
            >
              Annuler
            </Button>

            <Button
              type="button"
              variant="destructive"
              className="rounded-xl"
              onClick={() => void deleteDisk()}
              disabled={loadingAction === 'delete'}
            >
              {loadingAction === 'delete' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Suppression...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Supprimer maintenant
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}