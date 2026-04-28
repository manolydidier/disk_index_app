'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, RefreshCw, SearchCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';

type ScanButtonProps = {
  diskId: string;
  scanType: 'FULL' | 'DIFFERENTIAL';
};

type StartResponse = {
  jobId: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  progressPercent: number;
};

type JobResponse = {
  id: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  progressPercent: number;
  processedItems: number;
  totalItems: number;
  phase: string | null;
  currentPath: string | null;
  errorMessage: string | null;
  summary?: {
    added?: number;
    modified?: number;
    renamed?: number;
    deleted?: number;
    totalIndexed?: number;
  };
};

type ErrorResponse = {
  error?: unknown;
};

function extractErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== 'object') {
    return fallback;
  }

  const data = payload as {
    error?: unknown;
  };

  if (typeof data.error === 'string') {
    return data.error;
  }

  if (
    data.error &&
    typeof data.error === 'object' &&
    'fieldErrors' in data.error
  ) {
    const fieldErrors = (data.error as { fieldErrors?: Record<string, string[]> })
      .fieldErrors;

    if (fieldErrors) {
      for (const messages of Object.values(fieldErrors)) {
        if (messages?.length) {
          return messages[0];
        }
      }
    }
  }

  return fallback;
}

function isJobResponse(payload: unknown): payload is JobResponse {
  if (!payload || typeof payload !== 'object') return false;

  const data = payload as Partial<JobResponse>;

  return (
    typeof data.id === 'string' &&
    typeof data.status === 'string' &&
    typeof data.progressPercent === 'number'
  );
}

function isStartResponse(payload: unknown): payload is StartResponse {
  if (!payload || typeof payload !== 'object') return false;

  const data = payload as Partial<StartResponse>;

  return (
    typeof data.jobId === 'string' &&
    typeof data.status === 'string' &&
    typeof data.progressPercent === 'number'
  );
}

export function ScanButton({ diskId, scanType }: ScanButtonProps) {
  const router = useRouter();
  const pollingRef = useRef<number | null>(null);

  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<string>('PRÊT');
  const [currentPath, setCurrentPath] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [maxDepth, setMaxDepth] = useState<string>('3');
  const [inlineError, setInlineError] = useState<string | null>(null);

  const label = scanType === 'FULL' ? 'Scan complet' : 'Scan différentiel';

  useEffect(() => {
    if (!jobId) return;

    async function poll() {
      try {
        const response = await fetch(`/api/scan-jobs/${jobId}`, {
          cache: 'no-store'
        });

        const payload: JobResponse | ErrorResponse = await response.json();

        if (!response.ok) {
          throw new Error(
            extractErrorMessage(payload, 'Job introuvable.')
          );
        }

        if (!isJobResponse(payload)) {
          throw new Error('Réponse de suivi invalide.');
        }

        setProgress(payload.progressPercent ?? 0);
        setPhase(payload.phase ?? 'EN COURS');
        setCurrentPath(payload.currentPath ?? '');

        if (payload.status === 'COMPLETED') {
          if (pollingRef.current) {
            window.clearInterval(pollingRef.current);
            pollingRef.current = null;
          }

          setIsLoading(false);
          setJobId(null);

          toast.success(`${label} terminé`, {
            description: payload.summary
              ? `Ajouts: ${payload.summary.added ?? 0}, modifiés: ${payload.summary.modified ?? 0}, renommés: ${payload.summary.renamed ?? 0}, supprimés: ${payload.summary.deleted ?? 0}.`
              : 'Le scan a été exécuté avec succès.'
          });

          router.refresh();
        }

        if (payload.status === 'FAILED') {
          if (pollingRef.current) {
            window.clearInterval(pollingRef.current);
            pollingRef.current = null;
          }

          setIsLoading(false);
          setJobId(null);

          const message = payload.errorMessage || 'Le scan a échoué.';
          setInlineError(message);

          toast.error('Échec du scan', {
            description: message
          });
        }
      } catch (error) {
        if (pollingRef.current) {
          window.clearInterval(pollingRef.current);
          pollingRef.current = null;
        }

        const message =
          error instanceof Error
            ? error.message
            : 'Impossible de suivre la progression du scan.';

        setIsLoading(false);
        setJobId(null);
        setInlineError(message);

        toast.error('Erreur de suivi', {
          description: message
        });
      }
    }

    void poll();
    pollingRef.current = window.setInterval(() => {
      void poll();
    }, 1000);

    return () => {
      if (pollingRef.current) {
        window.clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [jobId, label, router]);

  async function handleClick() {
    setInlineError(null);
    setIsLoading(true);
    setProgress(0);
    setPhase('INITIALISATION');
    setCurrentPath('');

    try {
      const response = await fetch(`/api/disks/${diskId}/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          scanType,
          maxDepth:
            maxDepth.trim() === '' ? undefined : Number.parseInt(maxDepth, 10),
          excludeHidden: true
        })
      });

      const payload: StartResponse | ErrorResponse = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          extractErrorMessage(payload, 'Impossible de démarrer le scan.')
        );
      }

      if (!isStartResponse(payload)) {
        throw new Error('Réponse de démarrage invalide.');
      }

      setJobId(payload.jobId);
      setProgress(payload.progressPercent ?? 0);

      toast.info(label, {
        description:
          maxDepth.trim() === ''
            ? 'Le scan a démarré.'
            : `Le scan a démarré jusqu’au niveau ${maxDepth}.`
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Impossible de démarrer le scan.';

      setIsLoading(false);
      setInlineError(message);

      toast.error('Impossible de démarrer le scan', {
        description: message
      });
    }
  }

  return (
    <div className="w-full min-w-[240px] max-w-[290px] space-y-2 rounded-xl border bg-background px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <label className="text-[11px] font-medium text-muted-foreground">
          Niveau max
        </label>

        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {scanType === 'FULL' ? 'Complet' : 'Diff'}
        </span>
      </div>

      <Input
        type="number"
        min={1}
        max={100}
        value={maxDepth}
        onChange={(e) => setMaxDepth(e.target.value)}
        disabled={isLoading}
        placeholder="Ex. 3"
        className="h-9 text-sm"
      />

      <Button
        type="button"
        variant={scanType === 'FULL' ? 'secondary' : 'default'}
        className="h-9 w-full text-sm"
        onClick={handleClick}
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {progress}%
          </>
        ) : scanType === 'FULL' ? (
          <>
            <RefreshCw className="mr-2 h-4 w-4" />
            {label}
          </>
        ) : (
          <>
            <SearchCheck className="mr-2 h-4 w-4" />
            {label}
          </>
        )}
      </Button>

      {isLoading ? (
        <div className="space-y-2 rounded-lg border bg-muted/20 px-3 py-2">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="truncate">{phase}</span>
            <span>{progress}%</span>
          </div>

          <Progress value={progress} className="h-1.5" />

          <p className="line-clamp-2 text-[11px] text-muted-foreground">
            {currentPath || 'Préparation du scan...'}
          </p>
        </div>
      ) : null}

      {inlineError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
          {inlineError}
        </div>
      ) : null}
    </div>
  );
}