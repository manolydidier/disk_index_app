'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, Copy, Files, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExportCsvButton } from '@/components/disks/export-csv-button';
import { formatBytes, truncateMiddle } from '@/lib/utils';

type DiskOption = {
  id: string;
  code: string;
  name: string;
};

type DuplicateGroup = {
  name: string;
  size: string;
  count: number;
  wasted: string;
  files: {
    id: string;
    relativePath: string;
    fullPath: string;
    modifiedAt: string | null;
    disk: { id: string; code: string; name: string };
  }[];
};

type DuplicatesData = {
  totalWastedBytes: string;
  groups: DuplicateGroup[];
};

function formatDate(value: string | null) {
  if (!value) return '-';
  try {
    return format(new Date(value), 'dd MMM yyyy HH:mm', { locale: fr });
  } catch {
    return '-';
  }
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success('Chemin copié');
  } catch {
    toast.error('Copie impossible');
  }
}

export function DuplicatesClient({ disks }: { disks: DiskOption[] }) {
  const [diskId, setDiskId] = useState('');
  const [data, setData] = useState<DuplicatesData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const params = new URLSearchParams();
    if (diskId) params.set('diskId', diskId);

    fetch(`/api/duplicates?${params.toString()}`, { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || 'Impossible de charger les doublons.');
        }
        if (!cancelled) setData(payload);
      })
      .catch((error) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'Erreur inconnue.';
        toast.error('Détection de doublons indisponible', { description: message });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [diskId]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Détection de doublons</CardTitle>
            <CardDescription>
              Fichiers de même nom et même taille, potentiellement dupliqués.
            </CardDescription>
          </div>

          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={diskId}
            onChange={(e) => setDiskId(e.target.value)}
          >
            <option value="">Tous les disques</option>
            {disks.map((disk) => (
              <option key={disk.id} value={disk.id}>
                {disk.code} — {disk.name}
              </option>
            ))}
          </select>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-start gap-2 rounded-xl border border-dashed bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Comparaison basée sur le nom et la taille des fichiers indexés — pas de vérification
          du contenu (aucun hash n&apos;est calculé pendant le scan). Traite ces résultats comme
          des doublons probables à vérifier avant suppression.
        </div>

        {loading && !data ? (
          <div className="flex items-center justify-center gap-3 rounded-xl border px-6 py-14 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Recherche de doublons...
          </div>
        ) : !data || data.groups.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-14 text-center">
            <Files className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Aucun doublon détecté</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Aucun fichier avec le même nom et la même taille n&apos;a été trouvé
              {diskId ? ' sur ce disque' : ' dans l’index actuel'}.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="secondary">{data.groups.length} groupe{data.groups.length > 1 ? 's' : ''}</Badge>
                <span className="text-sm text-muted-foreground">
                  Espace potentiellement récupérable :{' '}
                  <span className="font-medium text-foreground">
                    {formatBytes(BigInt(data.totalWastedBytes))}
                  </span>
                </span>
              </div>

              <ExportCsvButton
                href={`/api/duplicates/export${diskId ? `?diskId=${diskId}` : ''}`}
              />
            </div>

            <div className="space-y-2">
              {data.groups.map((group) => (
                <details
                  key={`${group.name}:${group.size}`}
                  className="group overflow-hidden rounded-xl border"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-muted/10 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                      <span className="truncate text-sm font-medium">{group.name}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatBytes(BigInt(group.size))} × {group.count}</span>
                      <Badge variant="outline">
                        récup. {formatBytes(BigInt(group.wasted))}
                      </Badge>
                    </div>
                  </summary>

                  <div className="divide-y border-t">
                    {group.files.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between gap-3 px-4 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-medium">
                            {file.disk.code} — {file.disk.name}
                          </p>
                          <p
                            className="truncate font-mono text-xs text-muted-foreground"
                            title={file.relativePath}
                          >
                            {truncateMiddle(file.relativePath, 55, 20)}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Modifié {formatDate(file.modifiedAt)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => void copyText(file.fullPath)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Copier
                        </Button>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
