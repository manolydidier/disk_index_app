'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, ScanSearch } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';

type DiskSourceType = 'SERVER' | 'AGENT';

type ScanActionsModalProps = {
  diskId: string;
  sourceType: DiskSourceType;
};

type RequestScanPayload = {
  success?: boolean;
  alreadyQueued?: boolean;
  commandId?: string;
  error?: string;
};

type AgentCommandPayload = {
  success?: boolean;
  command?: {
    id: string;
    status:
      | 'PENDING'
      | 'CLAIMED'
      | 'RUNNING'
      | 'COMPLETED'
      | 'FAILED'
      | 'CANCELED';
    progressPercent: number;
    phase: string | null;
    currentPath: string | null;
    errorMessage: string | null;
    result: unknown;
  };
  error?: string;
};

type ServerScanStartPayload = {
  id?: string;
  error?: string;
};

type ServerScanJobPayload = {
  id: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  progressPercent: number;
  phase: string | null;
  currentPath: string | null;
  errorMessage: string | null;
  summary?: unknown;
};

export function ScanActionsModal({
  diskId,
  sourceType
}: ScanActionsModalProps) {
  const [open, setOpen] = useState(false);
  const [loadingType, setLoadingType] = useState<'FULL' | 'DIFFERENTIAL' | null>(null);

  const [trackingMode, setTrackingMode] = useState<'SERVER' | 'AGENT' | null>(null);
  const [trackingId, setTrackingId] = useState<string | null>(null);

  const [status, setStatus] = useState<string | null>(null);
  const [phase, setPhase] = useState<string | null>(null);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const pollTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        window.clearTimeout(pollTimerRef.current);
      }
    };
  }, []);

  function resetTrackingState() {
    setTrackingMode(null);
    setTrackingId(null);
    setStatus(null);
    setPhase(null);
    setProgressPercent(0);
    setCurrentPath(null);
    setErrorMessage(null);
  }

  async function fetchAgentCommand(commandId: string) {
    const response = await fetch(`/api/agent/commands/${commandId}`, {
      cache: 'no-store'
    });

    const payload = (await response.json().catch(() => ({}))) as AgentCommandPayload;

    if (!response.ok || !payload.command) {
      throw new Error(payload.error || 'Impossible de lire la commande agent.');
    }

    return payload.command;
  }

  async function fetchServerScanJob(jobId: string) {
    const response = await fetch(`/api/scan-jobs/${jobId}`, {
      cache: 'no-store'
    });

    const payload = (await response.json().catch(() => ({}))) as
      | ServerScanJobPayload
      | { error?: string };

    if (!response.ok || !('id' in payload)) {
      throw new Error(
        !('id' in payload) && payload.error
          ? payload.error
          : 'Impossible de lire le job de scan.'
      );
    }

    return payload;
  }

  async function pollAgentCommand(commandId: string) {
    try {
      const command = await fetchAgentCommand(commandId);

      setStatus(command.status);
      setPhase(command.phase ?? null);
      setProgressPercent(command.progressPercent ?? 0);
      setCurrentPath(command.currentPath ?? null);
      setErrorMessage(command.errorMessage ?? null);

      if (
        command.status === 'PENDING' ||
        command.status === 'CLAIMED' ||
        command.status === 'RUNNING'
      ) {
        pollTimerRef.current = window.setTimeout(() => {
          void pollAgentCommand(commandId);
        }, 2000);
        return;
      }

      setLoadingType(null);

      if (command.status === 'COMPLETED') {
        toast.success('Scan agent terminé');
        return;
      }

      if (command.status === 'FAILED') {
        toast.error('Scan agent échoué', {
          description: command.errorMessage || 'La commande a échoué.'
        });
        return;
      }

      if (command.status === 'CANCELED') {
        toast.error('Scan agent annulé');
      }
    } catch (error) {
      setLoadingType(null);
      toast.error('Suivi agent impossible', {
        description:
          error instanceof Error
            ? error.message
            : 'Impossible de suivre la commande agent.'
      });
    }
  }

  async function pollServerScanJob(jobId: string) {
    try {
      const job = await fetchServerScanJob(jobId);

      setStatus(job.status);
      setPhase(job.phase ?? null);
      setProgressPercent(job.progressPercent ?? 0);
      setCurrentPath(job.currentPath ?? null);
      setErrorMessage(job.errorMessage ?? null);

      if (job.status === 'PENDING' || job.status === 'RUNNING') {
        pollTimerRef.current = window.setTimeout(() => {
          void pollServerScanJob(jobId);
        }, 1500);
        return;
      }

      setLoadingType(null);

      if (job.status === 'COMPLETED') {
        toast.success('Scan serveur terminé');
        return;
      }

      if (job.status === 'FAILED') {
        toast.error('Scan serveur échoué', {
          description: job.errorMessage || 'Le scan serveur a échoué.'
        });
      }
    } catch (error) {
      setLoadingType(null);
      toast.error('Suivi serveur impossible', {
        description:
          error instanceof Error
            ? error.message
            : 'Impossible de suivre le scan serveur.'
      });
    }
  }

  async function startServerScan(scanType: 'FULL' | 'DIFFERENTIAL') {
    const response = await fetch(`/api/disks/${diskId}/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        scanType
      })
    });

    const payload = (await response.json().catch(() => ({}))) as ServerScanStartPayload;

    if (!response.ok || !payload.id) {
      throw new Error(payload.error || 'Impossible de lancer le scan serveur.');
    }

    setTrackingMode('SERVER');
    setTrackingId(payload.id);
    setStatus('RUNNING');
    setPhase('INITIALISATION');
    setProgressPercent(0);
    setCurrentPath(null);
    setErrorMessage(null);

    toast.success('Scan serveur lancé');
    await pollServerScanJob(payload.id);
  }

  async function startAgentScan(scanType: 'FULL' | 'DIFFERENTIAL') {
    const response = await fetch('/api/agent/commands/request-scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        diskId,
        scanType
      })
    });

    const payload = (await response.json().catch(() => ({}))) as RequestScanPayload;

    if (!response.ok || !payload.commandId) {
      throw new Error(payload.error || 'Impossible de demander le scan agent.');
    }

    setTrackingMode('AGENT');
    setTrackingId(payload.commandId);
    setStatus(payload.alreadyQueued ? 'PENDING' : 'CLAIMED');
    setPhase(payload.alreadyQueued ? 'EN_ATTENTE' : 'RÉCUPÉRÉE');
    setProgressPercent(0);
    setCurrentPath(null);
    setErrorMessage(null);

    toast.success(
      payload.alreadyQueued ? 'Scan déjà en attente' : 'Scan agent demandé'
    );

    await pollAgentCommand(payload.commandId);
  }

  async function handleStartScan(scanType: 'FULL' | 'DIFFERENTIAL') {
    if (pollTimerRef.current) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    resetTrackingState();
    setLoadingType(scanType);

    try {
      if (sourceType === 'SERVER') {
        await startServerScan(scanType);
        return;
      }

      await startAgentScan(scanType);
    } catch (error) {
      setLoadingType(null);

      const message =
        error instanceof Error ? error.message : 'Le scan a échoué.';

      setErrorMessage(message);

      toast.error('Lancement impossible', {
        description: message
      });
    }
  }

  const isBusy = loadingType !== null;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && pollTimerRef.current) {
          window.clearTimeout(pollTimerRef.current);
          pollTimerRef.current = null;
        }
        setOpen(nextOpen);
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant={sourceType === 'SERVER' ? 'default' : 'outline'}
          className="h-9 rounded-xl"
        >
          <ScanSearch className="h-4 w-4" />
          {sourceType === 'SERVER' ? 'Scan serveur' : 'Scan agent'}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-xl rounded-2xl">
        <DialogHeader>
          <DialogTitle>Lancer un scan</DialogTitle>
          <DialogDescription>
            {sourceType === 'SERVER'
              ? 'Le scan sera exécuté directement sur le serveur.'
              : 'Le site va envoyer une commande de scan à l’agent de cet ordinateur.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              type="button"
              onClick={() => void handleStartScan('DIFFERENTIAL')}
              disabled={isBusy}
            >
              {loadingType === 'DIFFERENTIAL' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  En cours...
                </>
              ) : (
                'Scan différentiel'
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => void handleStartScan('FULL')}
              disabled={isBusy}
            >
              {loadingType === 'FULL' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  En cours...
                </>
              ) : (
                'Scan complet'
              )}
            </Button>
          </div>

          {trackingId ? (
            <div className="rounded-2xl border bg-muted/10 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">
                  {trackingMode === 'SERVER' ? 'Scan serveur' : 'Commande agent'}
                </p>
                <span className="text-xs text-muted-foreground">
                  {status ?? '—'}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span>{phase ?? 'En attente'}</span>
                  <span>{progressPercent}%</span>
                </div>

                <Progress value={progressPercent} className="h-2" />

                {currentPath ? (
                  <div className="rounded-xl border bg-background px-3 py-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Parcours en cours
                    </p>
                    <p className="mt-1 break-all font-mono text-xs">
                      {currentPath}
                    </p>
                  </div>
                ) : null}

                {errorMessage ? (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-destructive">
                      Erreur
                    </p>
                    <p className="mt-1 break-all text-xs text-destructive">
                      {errorMessage}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}