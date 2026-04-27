'use client';

import { Eye, FolderOpen } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

type OpenDiskButtonProps = {
  diskId: string;
  rootPath: string;
  status: 'ACTIVE' | 'INACTIVE' | 'DISCONNECTED' | string;
};

async function callOpenPath(
  rootPath: string,
  action: 'open-folder' | 'reveal-item'
) {
  const response = await fetch('/api/open-path', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      absolutePath: rootPath,
      entryType: 'FOLDER',
      action
    })
  });

  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error || "Impossible d'exécuter cette action.");
  }

  return payload;
}

export function OpenDiskButton({
  rootPath,
  status
}: OpenDiskButtonProps) {
  const disabled = status === 'DISCONNECTED' || !rootPath;

  async function handleOpenDisk() {
    if (disabled) {
      toast.error('Disque non disponible', {
        description: 'Ce disque est marqué comme non connecté.'
      });
      return;
    }

    try {
      const payload = await callOpenPath(rootPath, 'open-folder');

      toast.success('Disque ouvert', {
        description:
          payload.message ||
          "Le disque a été ouvert sur la machine qui héberge l'application."
      });
    } catch (error) {
      toast.error('Ouverture impossible', {
        description:
          error instanceof Error
            ? error.message
            : "Impossible d'ouvrir le disque."
      });
    }
  }

  async function handleRevealDisk() {
    if (disabled) {
      toast.error('Disque non disponible', {
        description: 'Ce disque est marqué comme non connecté.'
      });
      return;
    }

    try {
      const payload = await callOpenPath(rootPath, 'reveal-item');

      toast.success('Disque localisé', {
        description:
          payload.message ||
          "Le disque a été localisé sur la machine qui héberge l'application."
      });
    } catch (error) {
      toast.error('Localisation impossible', {
        description:
          error instanceof Error
            ? error.message
            : "Impossible de localiser le disque."
      });
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled}
        onClick={handleOpenDisk}
        title={disabled ? 'Disque non connecté' : 'Ouvrir le disque'}
      >
        <FolderOpen className="h-4 w-4" />
        Ouvrir
      </Button>

      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled}
        onClick={handleRevealDisk}
        title={disabled ? 'Disque non connecté' : "Révéler dans l'explorateur"}
      >
        <Eye className="h-4 w-4" />
        Révéler
      </Button>
    </div>
  );
}