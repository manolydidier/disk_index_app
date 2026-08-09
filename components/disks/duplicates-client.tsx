'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Copy, Files, Loader2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { ExportCsvButton } from '@/components/disks/export-csv-button';
import { formatBytes, truncateMiddle } from '@/lib/utils';

type DiskOption = {
  id: string;
  code: string;
  name: string;
};

type DuplicateFile = {
  id: string;
  relativePath: string;
  fullPath: string;
  modifiedAt: string | null;
  disk: { id: string; code: string; name: string };
};

type DuplicateGroup = {
  name: string;
  size: string;
  count: number;
  wasted: string;
  files: DuplicateFile[];
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
  const [deleteTarget, setDeleteTarget] = useState<DuplicateFile | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const remainingGroupFiles = useMemo(() => {
    if (!deleteTarget || !data) return [];
    const group = data.groups.find((item) =>
      item.files.some((file) => file.id === deleteTarget.id)
    );
    return group ? group.files.filter((file) => file.id !== deleteTarget.id) : [];
  }, [deleteTarget, data]);

  async function confirmDelete() {
    if (!deleteTarget) return;

    setDeletingId(deleteTarget.id);

    try {
      const response = await fetch(`/api/file-entries/${deleteTarget.id}/delete`, {
        method: 'POST'
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        mode?: 'immediate' | 'queued';
      };

      if (!response.ok) {
        throw new Error(payload.error || 'Suppression impossible.');
      }

      setData((current) =>
        current
          ? {
              ...current,
              groups: current.groups
                .map((group) => ({
                  ...group,
                  files: group.files.filter((file) => file.id !== deleteTarget.id)
                }))
                .filter((group) => group.files.length > 1)
            }
          : current
      );

      toast.success(
        payload.mode === 'queued' ? 'Suppression demandée' : 'Fichier supprimé',
        {
          description:
            payload.mode === 'queued'
              ? "L'agent va supprimer ce fichier sous peu."
              : 'Le fichier a été supprimé du disque et retiré de l’index.'
        }
      );
    } catch (error) {
      toast.error('Suppression impossible', {
        description: error instanceof Error ? error.message : undefined
      });
    } finally {
      setDeletingId(null);
      setDeleteTarget(null);
    }
  }

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

            <Accordion type="multiple" className="space-y-2">
              {data.groups.map((group) => (
                <AccordionItem
                  key={`${group.name}:${group.size}`}
                  value={`${group.name}:${group.size}`}
                  className="overflow-hidden rounded-xl border border-b-0"
                >
                  <AccordionTrigger className="bg-muted/10 px-4 py-3 hover:no-underline">
                    <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                      <span className="truncate text-sm font-medium">{group.name}</span>
                      <div className="flex shrink-0 items-center gap-2 text-xs font-normal text-muted-foreground">
                        <span>{formatBytes(BigInt(group.size))} × {group.count}</span>
                        <Badge variant="outline">
                          récup. {formatBytes(BigInt(group.wasted))}
                        </Badge>
                      </div>
                    </div>
                  </AccordionTrigger>

                  <AccordionContent className="pb-0">
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
                          <div className="flex shrink-0 gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => void copyText(file.fullPath)}
                            >
                              <Copy className="h-3.5 w-3.5" />
                              Copier
                            </Button>

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              disabled={deletingId === file.id}
                              onClick={() => setDeleteTarget(file)}
                            >
                              {deletingId === file.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                              Supprimer
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </>
        )}
      </CardContent>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer ce fichier ?</DialogTitle>
            <DialogDescription>
              Cette action supprime le fichier du disque{' '}
              {deleteTarget ? `(${deleteTarget.disk.code} — ${deleteTarget.disk.name})` : ''} et
              le retire de l&apos;index. Elle est irréversible.
            </DialogDescription>
          </DialogHeader>

          {deleteTarget ? (
            <p
              className="break-all rounded-lg bg-muted/30 px-3 py-2 font-mono text-xs text-muted-foreground"
              title={deleteTarget.fullPath}
            >
              {deleteTarget.fullPath}
            </p>
          ) : null}

          {deleteTarget ? (
            remainingGroupFiles.length > 0 ? (
              <div className="space-y-1.5 rounded-lg border px-3 py-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {remainingGroupFiles.length} autre{remainingGroupFiles.length > 1 ? 's' : ''}{' '}
                  exemplaire{remainingGroupFiles.length > 1 ? 's' : ''} resteron
                  {remainingGroupFiles.length > 1 ? 't' : 'a'} dans l&apos;index :
                </p>
                <ul className="space-y-1">
                  {remainingGroupFiles.map((file) => (
                    <li
                      key={file.id}
                      className="truncate font-mono text-[11px] text-muted-foreground"
                      title={file.relativePath}
                    >
                      {file.disk.code} — {truncateMiddle(file.relativePath, 45, 15)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
                C&apos;est le dernier exemplaire de ce groupe : il disparaîtra de la liste des
                doublons après suppression.
              </p>
            )
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={Boolean(deletingId)}
              onClick={() => void confirmDelete()}
            >
              {deletingId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Supprimer définitivement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
