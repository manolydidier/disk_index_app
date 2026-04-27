'use client';

import { useMemo, useState } from 'react';
import {
  Copy,
  FolderOpen,
  Info,
  Search,
  HardDrive,
  FileText,
  Folder,
  ExternalLink,
  Eye,
  MousePointerClick
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { formatBytes, truncateMiddle } from '@/lib/utils';
import { getDiskDisplayLabel, getDiskDisplayTitle } from '@/lib/disk-label';

type DiskOption = {
  id: string;
  code: string;
  name: string;
};

type SearchResult = {
  id: string;
  name: string;
  relativePath: string;
  fullPath: string;
  absolutePath: string | null;
  extension: string | null;
  entryType: 'FILE' | 'FOLDER';
  modifiedAt: string | null;
  size: string | null;
  disk: {
    id: string;
    code: string;
    name: string;
    status: 'ACTIVE' | 'INACTIVE' | 'DISCONNECTED' | string;
    rootPath: string;
    driveLetter: string | null;
  };
};

type SearchApiError = {
  error?: string;
};

type OpenAction = 'open-folder' | 'open-item' | 'reveal-item';

function getStatusLabel(status: string) {
  if (status === 'ACTIVE') return 'Actif';
  if (status === 'INACTIVE') return 'Inactif';
  if (status === 'DISCONNECTED') return 'Non connecté';
  return status;
}

function formatDate(value: string | null) {
  if (!value) return '-';
  try {
    return format(new Date(value), 'dd MMM yyyy HH:mm', { locale: fr });
  } catch {
    return '-';
  }
}

function getOpenDisabledReason(item: SearchResult) {
  if (!item.absolutePath) {
    return 'Chemin absolu indisponible';
  }

  if (item.disk.status === 'DISCONNECTED') {
    return 'Disque non connecté';
  }

  return null;
}

export function SearchClient({ disks }: { disks: DiskOption[] }) {
  const [query, setQuery] = useState('');
  const [diskId, setDiskId] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const subtitle = useMemo(() => {
    if (!diskId) return 'Tous les disques indexés';
    const disk = disks.find((item) => item.id === diskId);
    return disk ? `${disk.code} — ${disk.name}` : 'Filtre actif';
  }, [diskId, disks]);

  async function runSearch() {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      setResults([]);
      setSelected(null);
      setDetailsOpen(false);
      return;
    }

    setLoading(true);

    try {
      const params = new URLSearchParams({ q: trimmedQuery });
      if (diskId) params.set('diskId', diskId);

      const response = await fetch(`/api/search?${params.toString()}`, {
        cache: 'no-store'
      });

      const payload = (await response.json().catch(() => ({}))) as
        | SearchResult[]
        | SearchApiError;

      if (!response.ok) {
        throw new Error(
          !Array.isArray(payload) && payload.error
            ? payload.error
            : 'La recherche a échoué.'
        );
      }

      const nextResults = Array.isArray(payload) ? payload : [];
      setResults(nextResults);

      if (nextResults.length === 0) {
        setSelected(null);
        setDetailsOpen(false);

        toast.info('Aucun résultat', {
          description: 'Aucun fichier ou dossier ne correspond à cette recherche.'
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'La recherche a échoué.';

      toast.error('Erreur de recherche', {
        description: message
      });
    } finally {
      setLoading(false);
    }
  }

  function openDetails(item: SearchResult) {
    setSelected(item);
    setDetailsOpen(true);
  }

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success('Chemin copié', {
        description: `${label} a été copié dans le presse-papiers.`
      });
    } catch {
      toast.error('Copie impossible', {
        description: "Le navigateur n'a pas pu copier ce texte."
      });
    }
  }

  async function openAction(item: SearchResult, action: OpenAction) {
    const disabledReason = getOpenDisabledReason(item);

    if (disabledReason) {
      toast.error('Action impossible', {
        description: disabledReason
      });
      return;
    }

    setActionLoading(`${item.id}:${action}`);

    try {
      const response = await fetch('/api/open-path', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          absolutePath: item.absolutePath,
          entryType: item.entryType,
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

      const successTitle =
        action === 'open-folder'
          ? 'Dossier ouvert'
          : action === 'open-item'
            ? 'Élément ouvert'
            : 'Élément localisé';

      toast.success(successTitle, {
        description:
          payload.message ||
          "L'action a été exécutée sur la machine qui héberge l'application."
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Impossible d'exécuter cette action.";

      toast.error('Action impossible', {
        description: message
      });
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Recherche globale</CardTitle>
          <CardDescription>{subtitle}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid gap-3 lg:grid-cols-[1fr_240px_auto]">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nom de fichier, extension, dossier, chemin..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  void runSearch();
                }
              }}
            />

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

            <Button onClick={runSearch} disabled={!query.trim() || loading}>
              <Search className="h-4 w-4" />
              {loading ? 'Recherche...' : 'Rechercher'}
            </Button>
          </div>

          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Chemin exact</TableHead>
                  <TableHead>Disque</TableHead>
                  <TableHead>Taille</TableHead>
                  <TableHead>Modifié le</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {results.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Aucun résultat.
                    </TableCell>
                  </TableRow>
                ) : (
                  results.map((result) => {
                    const disabledReason = getOpenDisabledReason(result);

                    return (
                      <TableRow
                        key={result.id}
                        className="cursor-pointer hover:bg-muted/40"
                        onClick={() => openDetails(result)}
                      >
                        <TableCell className="font-medium">{result.name}</TableCell>

                        <TableCell>
                          <Badge variant="outline">
                            {result.entryType === 'FILE' ? 'Fichier' : 'Dossier'}
                          </Badge>
                        </TableCell>

                        <TableCell className="font-mono text-xs">
                          {truncateMiddle(result.fullPath, 70, 28)}
                        </TableCell>

                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {getDiskDisplayLabel(result.disk)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {result.disk.name}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell>
                          {result.size ? formatBytes(Number(result.size)) : '-'}
                        </TableCell>

                        <TableCell>{formatDate(result.modifiedAt)}</TableCell>

                        <TableCell>
                          <div
                            className="flex flex-wrap gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => openDetails(result)}
                            >
                              <Info className="h-4 w-4" />
                              Détails
                            </Button>

                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => void copyText(result.fullPath, 'Le chemin exact')}
                            >
                              <Copy className="h-4 w-4" />
                              Copier
                            </Button>

                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={Boolean(disabledReason) || actionLoading === `${result.id}:open-folder`}
                              onClick={() => void openAction(result, 'open-folder')}
                              title={disabledReason ?? 'Ouvrir le dossier'}
                            >
                              <FolderOpen className="h-4 w-4" />
                              Ouvrir
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-5xl">
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selected.entryType === 'FILE' ? (
                    <FileText className="h-5 w-5" />
                  ) : (
                    <Folder className="h-5 w-5" />
                  )}
                  {selected.name}
                </DialogTitle>

                <DialogDescription>
                  {getDiskDisplayTitle(selected.disk)}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-6">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <DetailItem label="Nom" value={selected.name} />
                  <DetailItem
                    label="Type"
                    value={selected.entryType === 'FILE' ? 'Fichier' : 'Dossier'}
                  />
                  <DetailItem label="Extension" value={selected.extension || '-'} />
                  <DetailItem
                    label="Taille"
                    value={selected.size ? formatBytes(Number(selected.size)) : '-'}
                  />
                  <DetailItem
                    label="Modifié le"
                    value={formatDate(selected.modifiedAt)}
                  />
                  <DetailItem
                    label="Statut du disque"
                    value={getStatusLabel(selected.disk.status)}
                  />
                </div>

                <div className="grid gap-4">
                  <PathBlock
                    icon={<HardDrive className="h-4 w-4" />}
                    title="Chemin indexé"
                    value={selected.fullPath}
                    onCopy={() =>
                      void copyText(selected.fullPath, 'Le chemin indexé')
                    }
                  />

                  <PathBlock
                    icon={<ExternalLink className="h-4 w-4" />}
                    title="Chemin absolu"
                    value={selected.absolutePath || 'Indisponible'}
                    onCopy={
                      selected.absolutePath
                        ? () =>
                            void copyText(
                              selected.absolutePath!,
                              'Le chemin absolu'
                            )
                        : undefined
                    }
                  />
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      void copyText(selected.fullPath, 'Le chemin exact')
                    }
                  >
                    <Copy className="h-4 w-4" />
                    Copier le chemin exact
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    disabled={!selected.absolutePath}
                    onClick={() =>
                      selected.absolutePath
                        ? void copyText(
                            selected.absolutePath,
                            'Le chemin absolu'
                          )
                        : undefined
                    }
                  >
                    <Copy className="h-4 w-4" />
                    Copier le chemin absolu
                  </Button>

                  <Button
                    type="button"
                    disabled={
                      Boolean(getOpenDisabledReason(selected)) ||
                      actionLoading === `${selected.id}:open-folder`
                    }
                    onClick={() => void openAction(selected, 'open-folder')}
                  >
                    <FolderOpen className="h-4 w-4" />
                    {actionLoading === `${selected.id}:open-folder`
                      ? 'Ouverture...'
                      : 'Ouvrir le dossier'}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    disabled={
                      Boolean(getOpenDisabledReason(selected)) ||
                      actionLoading === `${selected.id}:open-item`
                    }
                    onClick={() => void openAction(selected, 'open-item')}
                  >
                    <MousePointerClick className="h-4 w-4" />
                    {selected.entryType === 'FILE'
                      ? 'Ouvrir le fichier'
                      : 'Ouvrir ce dossier'}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    disabled={
                      Boolean(getOpenDisabledReason(selected)) ||
                      actionLoading === `${selected.id}:reveal-item`
                    }
                    onClick={() => void openAction(selected, 'reveal-item')}
                  >
                    <Eye className="h-4 w-4" />
                    Révéler dans l’explorateur
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

function PathBlock({
  icon,
  title,
  value,
  onCopy
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  onCopy?: () => void;
}) {
  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          {icon}
          <span>{title}</span>
        </div>

        {onCopy ? (
          <Button type="button" variant="ghost" size="sm" onClick={onCopy}>
            <Copy className="h-4 w-4" />
            Copier
          </Button>
        ) : null}
      </div>

      <p className="break-all font-mono text-xs text-muted-foreground">{value}</p>
    </div>
  );
}