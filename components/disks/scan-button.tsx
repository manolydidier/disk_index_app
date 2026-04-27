'use client';

import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

type ScanType = 'FULL' | 'DIFFERENTIAL';

type ScanButtonProps = {
  diskId: string;
  scanType: ScanType;
};

type ScanJob = {
  id: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  progressPercent: number | null;
  phase: string | null;
  processedItems: number | null;
  totalItems: number | null;
  errorMessage: string | null;
};

export function ScanButton({ diskId, scanType }: ScanButtonProps) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [phase, setPhase] = useState<string | null>(null);
  const jobIdRef = useRef<string | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
      }
    };
  }, []);

  async function pollJob(jobId: string) {
    try {
      const response = await fetch(`/api/scan-jobs/${jobId}`, {
        cache: 'no-store'
      });

      const payload = (await response.json().catch(() => ({}))) as
        | ScanJob
        | { error?: string };

      if (!response.ok) {
        throw new Error(
          'error' in payload && payload.error
            ? payload.error
            : 'Impossible de suivre le scan.'
        );
      }

      if (!('status' in payload)) return;

      setProgress(payload.progressPercent ?? 0);
      setPhase(payload.phase ?? null);

      if (payload.status === 'COMPLETED') {
        if (pollRef.current) {
          window.clearInterval(pollRef.current);
          pollRef.current = null;
        }

        setLoading(false);
        setProgress(100);

        toast.success('Scan terminé', {
          description:
            scanType === 'FULL'
              ? 'Le scan complet est terminé.'
              : 'Le scan différentiel est terminé.'
        });

        window.setTimeout(() => {
          window.location.reload();
        }, 1200);
      }

      if (payload.status === 'FAILED') {
        if (pollRef.current) {
          window.clearInterval(pollRef.current);
          pollRef.current = null;
        }

        setLoading(false);
        setProgress(null);

        toast.error('Échec du scan', {
          description: payload.errorMessage || 'Le scan a échoué.'
        });
      }
    } catch (error) {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }

      setLoading(false);
      setProgress(null);

      toast.error('Suivi impossible', {
        description:
          error instanceof Error
            ? error.message
            : 'Impossible de suivre le scan.'
      });
    }
  }

  async function handleScan() {
    setLoading(true);
    setProgress(0);
    setPhase('INITIALISATION');

    try {
      const response = await fetch(`/api/disks/${diskId}/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ scanType })
      });

      const payload = (await response.json().catch(() => ({}))) as
        | { id?: string; error?: string }
        | Record<string, unknown>;

      if (!response.ok) {
        throw new Error(
          'error' in payload && typeof payload.error === 'string'
            ? payload.error
            : 'Impossible de lancer le scan.'
        );
      }

      const jobId =
        'id' in payload && typeof payload.id === 'string'
          ? payload.id
          : null;

      if (!jobId) {
        throw new Error('Job de scan introuvable.');
      }

      jobIdRef.current = jobId;

      toast.success('Scan démarré', {
        description:
          scanType === 'FULL'
            ? 'Le scan complet a démarré.'
            : 'Le scan différentiel a démarré.'
      });

      await pollJob(jobId);

      pollRef.current = window.setInterval(() => {
        if (jobIdRef.current) {
          void pollJob(jobIdRef.current);
        }
      }, 1500);
    } catch (error) {
      setLoading(false);
      setProgress(null);

      toast.error('Impossible de lancer le scan', {
        description:
          error instanceof Error
            ? error.message
            : 'Le scan ne peut pas démarrer.'
      });
    }
  }

  const label =
    scanType === 'FULL' ? 'Scan complet' : 'Scan différentiel';

  return (
    <Button
      type="button"
      variant={scanType === 'FULL' ? 'outline' : 'default'}
      onClick={() => void handleScan()}
      disabled={loading}
      className="justify-start"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <RefreshCw className="h-4 w-4" />
      )}

      {loading && progress !== null
        ? `${label} • ${progress}%${phase ? ` • ${phase}` : ''}`
        : label}
    </Button>
  );
}