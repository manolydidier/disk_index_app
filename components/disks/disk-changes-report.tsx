'use client';

import { useEffect, useState } from 'react';
import { FilePlus, FileX, Loader2, Pencil, Replace } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { ExportCsvButton } from '@/components/disks/export-csv-button';
import { truncateMiddle } from '@/lib/utils';

type ChangesReport = {
  from: string;
  to: string;
  counts: { added: number; modified: number; deleted: number; renamed: number };
  totalCount: number;
  truncated: boolean;
  activities: {
    id: string;
    activityType: 'ADDED' | 'MODIFIED' | 'DELETED' | 'RENAMED';
    path: string;
    previousPath: string | null;
    createdAt: string;
  }[];
};

function toDateInputValue(iso: string) {
  return iso.slice(0, 10);
}

function formatDateTime(value: string) {
  try {
    return format(new Date(value), 'dd MMM yyyy HH:mm', { locale: fr });
  } catch {
    return value;
  }
}

const TYPE_META = {
  ADDED: { label: 'Ajouté', icon: FilePlus, variant: 'default' as const },
  MODIFIED: { label: 'Modifié', icon: Pencil, variant: 'secondary' as const },
  DELETED: { label: 'Supprimé', icon: FileX, variant: 'destructive' as const },
  RENAMED: { label: 'Renommé', icon: Replace, variant: 'secondary' as const }
};

export function DiskChangesReport({ diskId }: { diskId: string }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState<ChangesReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const params = new URLSearchParams();
    if (from) params.set('from', new Date(from).toISOString());
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      params.set('to', end.toISOString());
    }

    fetch(`/api/disks/${diskId}/changes?${params.toString()}`, { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || 'Impossible de charger le rapport.');
        }
        if (!cancelled) {
          setData(payload);
          if (!from) setFrom(toDateInputValue(payload.from));
          if (!to) setTo(toDateInputValue(payload.to));
        }
      })
      .catch((error) => {
        if (cancelled) return;
        toast.error('Rapport indisponible', {
          description: error instanceof Error ? error.message : undefined
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diskId, from, to]);

  const exportParams = new URLSearchParams();
  if (from) exportParams.set('from', new Date(from).toISOString());
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    exportParams.set('to', end.toISOString());
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-xs">
            <span className="block font-medium text-muted-foreground">Du</span>
            <input
              type="date"
              className="h-9 rounded-md border bg-background px-3 text-sm"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="block font-medium text-muted-foreground">Au</span>
            <input
              type="date"
              className="h-9 rounded-md border bg-background px-3 text-sm"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        </div>

        <ExportCsvButton href={`/api/disks/${diskId}/changes/export?${exportParams.toString()}`} />
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center gap-3 rounded-xl border px-6 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement du rapport...
        </div>
      ) : !data ? null : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(['added', 'modified', 'deleted', 'renamed'] as const).map((key) => {
              const meta = TYPE_META[key.toUpperCase() as keyof typeof TYPE_META];
              const Icon = meta.icon;
              return (
                <div key={key} className="flex items-center gap-2 rounded-xl border px-3 py-2.5">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-semibold">{data.counts[key]}</p>
                    <p className="text-[11px] text-muted-foreground">{meta.label}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {data.activities.length === 0 ? (
            <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              Aucun changement sur cette période.
            </p>
          ) : (
            <div className="max-h-[420px] space-y-2 overflow-y-auto">
              {data.truncated ? (
                <p className="text-xs text-muted-foreground">
                  Affichage des {data.activities.length} changements les plus récents sur{' '}
                  {data.totalCount} au total — exporte en CSV pour la liste complète.
                </p>
              ) : null}

              {data.activities.map((activity) => {
                const meta = TYPE_META[activity.activityType];
                const Icon = meta.icon;

                return (
                  <div
                    key={activity.id}
                    className="flex items-start justify-between gap-3 rounded-xl border bg-muted/10 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p
                        className="break-all font-mono text-xs"
                        title={activity.path}
                      >
                        {truncateMiddle(activity.path, 70, 25)}
                      </p>
                      {activity.previousPath ? (
                        <p className="mt-0.5 break-all font-mono text-[11px] text-muted-foreground">
                          depuis {truncateMiddle(activity.previousPath, 60, 20)}
                        </p>
                      ) : null}
                      <p className="text-[11px] text-muted-foreground">
                        {formatDateTime(activity.createdAt)}
                      </p>
                    </div>
                    <Badge variant={meta.variant} className="shrink-0">
                      <Icon className="h-3.5 w-3.5" />
                      {meta.label}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
