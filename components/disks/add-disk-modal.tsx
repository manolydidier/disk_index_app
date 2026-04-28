'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  HardDrive,
  Laptop,
  Loader2,
  Plus,
  RefreshCw,
  Server
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
import { DiskForm } from '@/components/disks/disk-form';

type SourceMode = 'SERVER' | 'AGENT';

type AgentAvailableDisk = {
  id: string;
  agentDeviceId: string;
  remoteDiskKey: string;
  rootPath: string;
  displayName: string;
  driveType: string | null;
  isRemovable: boolean;
  isConnected: boolean;
  lastSeenAt: string;
  agentDevice: {
    id: string;
    hostName: string;
    machineId: string;
    userLabel: string | null;
    status: 'ONLINE' | 'OFFLINE' | 'DISABLED';
    lastHeartbeatAt: string | null;
  };
};

export function AddDiskModal() {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<SourceMode>('SERVER');
  const [loading, setLoading] = useState(false);
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [availableDisks, setAvailableDisks] = useState<AgentAvailableDisk[]>([]);

  const groupedDisks = useMemo(() => {
    const groups = new Map<string, AgentAvailableDisk[]>();

    const sortedDisks = [...availableDisks].sort((a, b) => {
      const machineA =
        a.agentDevice.userLabel || a.agentDevice.hostName || a.agentDevice.machineId;
      const machineB =
        b.agentDevice.userLabel || b.agentDevice.hostName || b.agentDevice.machineId;

      const machineCompare = machineA.localeCompare(machineB, 'fr');
      if (machineCompare !== 0) return machineCompare;

      return a.rootPath.localeCompare(b.rootPath, 'fr');
    });

    for (const disk of sortedDisks) {
      const machineLabel =
        disk.agentDevice.userLabel ||
        disk.agentDevice.hostName ||
        disk.agentDevice.machineId;

      const current = groups.get(machineLabel) ?? [];
      current.push(disk);
      groups.set(machineLabel, current);
    }

    return Array.from(groups.entries());
  }, [availableDisks]);

  async function loadAvailableDisks() {
    setLoading(true);

    try {
      const response = await fetch('/api/agent/disks/available', {
        cache: 'no-store'
      });

      const payload = (await response.json().catch(() => [])) as
        | AgentAvailableDisk[]
        | { error?: string };

      if (!response.ok) {
        throw new Error(
          !Array.isArray(payload) && payload.error
            ? payload.error
            : 'Impossible de charger les disques disponibles.'
        );
      }

      setAvailableDisks(Array.isArray(payload) ? payload : []);
    } catch (error) {
      toast.error('Chargement impossible', {
        description:
          error instanceof Error
            ? error.message
            : 'Impossible de charger les disques disponibles.'
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open && mode === 'AGENT') {
      void loadAvailableDisks();
    }
  }, [open, mode]);

  useEffect(() => {
    if (!open) {
      setAddingKey(null);
    }
  }, [open]);

  async function addAgentDisk(disk: AgentAvailableDisk) {
    const actionKey = `${disk.agentDeviceId}:${disk.remoteDiskKey}`;
    setAddingKey(actionKey);

    try {
      const response = await fetch('/api/disks/from-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          agentDeviceId: disk.agentDeviceId,
          remoteDiskKey: disk.remoteDiskKey
        })
      });

      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        code?: string;
        alreadyExists?: boolean;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Impossible d'ajouter ce disque.");
      }

      toast.success(
        payload.alreadyExists ? 'Disque déjà ajouté' : 'Disque ajouté',
        {
          description: payload.code
            ? `Code disque : ${payload.code}`
            : 'Le disque est maintenant visible dans le tableau principal.'
        }
      );

      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error('Ajout impossible', {
        description:
          error instanceof Error
            ? error.message
            : "Impossible d'ajouter ce disque."
      });
    } finally {
      setAddingKey(null);
    }
  }

  function renderAgentDisks() {
    if (loading) {
      return (
        <div className="rounded-2xl border px-6 py-10 text-center text-sm text-muted-foreground">
          Chargement des disques disponibles...
        </div>
      );
    }

    if (groupedDisks.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
          Aucun disque agent disponible pour le moment.
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {groupedDisks.map(([machineLabel, disks]) => {
          const firstDisk = disks[0];

          return (
            <div key={machineLabel} className="rounded-2xl border">
              <div className="border-b bg-muted/20 px-4 py-3">
                <p className="text-sm font-semibold">{machineLabel}</p>
                <p className="text-xs text-muted-foreground">
                  {firstDisk?.agentDevice.hostName} • {firstDisk?.agentDevice.machineId}
                </p>
              </div>

              <div className="space-y-3 p-4">
                {disks.map((disk) => {
                  const actionKey = `${disk.agentDeviceId}:${disk.remoteDiskKey}`;
                  const adding = addingKey === actionKey;
                  const canAdd =
                    disk.isConnected && disk.agentDevice.status === 'ONLINE';

                  return (
                    <div
                      key={actionKey}
                      className="flex flex-col gap-3 rounded-xl border bg-background px-4 py-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <HardDrive className="h-4 w-4 text-primary" />
                          <p className="truncate text-sm font-semibold">
                            {disk.displayName}
                          </p>
                        </div>

                        <p className="mt-1 font-mono text-xs text-muted-foreground">
                          {disk.rootPath}
                        </p>

                        <p className="mt-1 text-xs text-muted-foreground">
                          {disk.isRemovable ? 'Amovible' : 'Fixe'}
                          {disk.driveType ? ` • ${disk.driveType}` : ''}
                          {disk.agentDevice.status !== 'ONLINE'
                            ? ' • Agent hors ligne'
                            : ''}
                          {!disk.isConnected ? ' • Disque non connecté' : ''}
                        </p>
                      </div>

                      <Button
                        type="button"
                        onClick={() => void addAgentDisk(disk)}
                        disabled={adding || !canAdd}
                      >
                        {adding ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Ajout...
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4" />
                            Ajouter ce disque
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);

        if (!nextOpen) {
          setMode('SERVER');
        }
      }}
    >
      <DialogTrigger asChild>
        <Button className="rounded-full">
          <Plus className="h-4 w-4" />
          Ajouter un disque
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto rounded-2xl p-0">
        <div className="border-b px-6 py-5">
          <DialogHeader>
            <DialogTitle className="text-xl">Ajouter un disque</DialogTitle>
            <DialogDescription>
              Choisis la source du disque à ajouter dans l’application.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-6 px-6 py-6">
          <div className="inline-flex rounded-full border bg-background p-1">
            <Button
              type="button"
              size="sm"
              variant={mode === 'SERVER' ? 'default' : 'ghost'}
              className="rounded-full"
              onClick={() => setMode('SERVER')}
            >
              <Server className="h-4 w-4" />
              Serveur
            </Button>

            <Button
              type="button"
              size="sm"
              variant={mode === 'AGENT' ? 'default' : 'ghost'}
              className="rounded-full"
              onClick={() => setMode('AGENT')}
            >
              <Laptop className="h-4 w-4" />
              Cet ordinateur
            </Button>
          </div>

          {mode === 'SERVER' ? (
            <div className="rounded-2xl border bg-muted/10 p-4">
              <DiskForm />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">Disques détectés</h3>
                  <p className="text-xs text-muted-foreground">
                    Disques remontés par les agents actuellement en ligne.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void loadAvailableDisks()}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Actualiser
                </Button>
              </div>

              {renderAgentDisks()}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}