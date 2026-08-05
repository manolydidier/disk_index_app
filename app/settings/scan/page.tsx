'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Play, SearchCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  DEFAULT_SCAN_SETTINGS,
  SCAN_SETTINGS_STORAGE_KEY,
  ScanSettings
} from '@/lib/scan-settings';
import { ScanSettingsForm } from '@/components/scan/scan-settings-form';

type DiskOption = {
  id: string;
  code: string;
  name: string;
  rootPath: string;
  status: string;
};

type ScanResponse = {
  success?: boolean;
  summary?: unknown;
  error?: string;
};

export default function ManualScanClient() {
  const [disks, setDisks] = useState<DiskOption[]>([]);
  const [diskId, setDiskId] = useState('');
  const [settings, setSettings] = useState<ScanSettings>(DEFAULT_SCAN_SETTINGS);
  const [loadingDisks, setLoadingDisks] = useState(true);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('Prêt');
  const [resultText, setResultText] = useState('');

  useEffect(() => {
    async function loadDisks() {
      try {
        const response = await fetch('/api/disks', { cache: 'no-store' });
        const payload = (await response.json()) as DiskOption[];
        setDisks(Array.isArray(payload) ? payload : []);
      } catch {
        toast.error('Impossible de charger les disques');
      } finally {
        setLoadingDisks(false);
      }
    }

    void loadDisks();

    try {
      const raw = localStorage.getItem(SCAN_SETTINGS_STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as Partial<ScanSettings>;
      setSettings({
        ...DEFAULT_SCAN_SETTINGS,
        ...parsed
      });
    } catch {
      // ignore
    }
  }, []);

  const selectedDisk = useMemo(
    () => disks.find((disk) => disk.id === diskId) ?? null,
    [diskId, disks]
  );

  async function runScan() {
    if (!diskId) {
      toast.error('Choisis un disque');
      return;
    }

    setRunning(true);
    setProgress(8);
    setPhase('Préparation');
    setResultText('');

    const interval = window.setInterval(() => {
      setProgress((current) => {
        if (current >= 90) return current;
        return current + 6;
      });
    }, 500);

    try {
      setPhase('Scan en cours');

      const response = await fetch(`/api/disks/${diskId}/scan-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      });

      const payload = (await response.json().catch(() => ({}))) as ScanResponse;

      if (!response.ok) {
        throw new Error(payload.error || 'Le scan a échoué.');
      }

      setPhase('Terminé');
      setProgress(100);
      setResultText(
        payload.summary
          ? JSON.stringify(payload.summary)
          : 'Scan terminé avec succès.'
      );

      toast.success('Scan terminé');
    } catch (error) {
      setPhase('Échec');
      toast.error('Erreur de scan', {
        description:
          error instanceof Error ? error.message : 'Le scan a échoué.'
      });
    } finally {
      window.clearInterval(interval);
      setRunning(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>Choix du disque</CardTitle>
          <CardDescription>
            Lance un scan manuel synchrone, sans tâche en arrière-plan.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Disque</label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={diskId}
              onChange={(e) => setDiskId(e.target.value)}
              disabled={loadingDisks || running}
            >
              <option value="">Choisir un disque</option>
              {disks.map((disk) => (
                <option key={disk.id} value={disk.id}>
                  {disk.code} — {disk.name}
                </option>
              ))}
            </select>
          </div>

          {selectedDisk ? (
            <div className="rounded-xl border bg-muted/20 px-4 py-3 text-sm">
              <p className="font-medium">{selectedDisk.code} — {selectedDisk.name}</p>
              <p className="font-mono text-xs text-muted-foreground">
                {selectedDisk.rootPath}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Statut : {selectedDisk.status}
              </p>
            </div>
          ) : null}

          <Button
            type="button"
            onClick={runScan}
            disabled={running || !diskId}
            className="w-full"
          >
            {running ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Scan en cours...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Lancer le scan
              </>
            )}
          </Button>

          {(running || progress > 0) && (
            <div className="space-y-2 rounded-xl border px-4 py-4">
              <div className="flex items-center justify-between text-sm">
                <span>{phase}</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground">
                Le scan est exécuté directement et la page attend la fin.
              </p>
            </div>
          )}

          {resultText ? (
            <div className="rounded-xl border bg-muted/20 px-4 py-3">
              <p className="mb-1 text-sm font-medium">Résultat</p>
              <p className="break-all text-xs text-muted-foreground">
                {resultText}
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>Paramètres du scan</CardTitle>
          <CardDescription>
            Ces réglages sont appliqués au scan manuel courant.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <ScanSettingsForm
            value={settings}
            onChange={setSettings}
            disabled={running}
          />

          <div className="flex items-center gap-2 rounded-xl border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            <SearchCheck className="h-4 w-4" />
            Tu peux modifier ici les paramètres sans toucher aux réglages enregistrés.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}