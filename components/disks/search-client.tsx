'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  Copy,
  FolderOpen,
  Info,
  Loader2,
  Search,
  HardDrive,
  FileText,
  Filter,
  Folder,
  ExternalLink,
  Eye,
  MousePointerClick,
  X
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

const SIZE_PRESETS = [
  { label: 'Toutes tailles', value: '' },
  { label: '> 1 Mo', value: '1048576' },
  { label: '> 10 Mo', value: '10485760' },
  { label: '> 100 Mo', value: '104857600' },
  { label: '> 1 Go', value: '1073741824' }
];

type Filters = {
  extension: string;
  entryType: '' | 'FILE' | 'FOLDER';
  sizeMin: string;
  modifiedAfter: string;
  modifiedBefore: string;
};

const EMPTY_FILTERS: Filters = {
  extension: '',
  entryType: '',
  sizeMin: '',
  modifiedAfter: '',
  modifiedBefore: ''
};

function countActiveFilters(filters: Filters) {
  return Object.values(filters).filter(Boolean).length;
}

export function SearchClient({ disks }: { disks: DiskOption[] }) {
  const [query, setQuery] = useState('');
  const [diskId, setDiskId] = useState('');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const debounceRef = useRef<number | null>(null);
  const requestIdRef = useRef(0);
  const activeFilterCount = countActiveFilters(filters);

  const subtitle = useMemo(() => {
    if (!diskId) return 'Tous les disques indexés';
    const disk = disks.find((item) => item.id === diskId);
    return disk ? `${disk.code} — ${disk.name}` : 'Filtre actif';
  }, [diskId, disks]);

  async function runSearch(trimmedQuery: string) {
    const requestId = ++requestIdRef.current;
    setLoading(true);

    try {
      const params = new URLSearchParams({ q: trimmedQuery });
      if (diskId) params.set('diskId', diskId);
      if (filters.extension) params.set('extension', filters.extension);
      if (filters.entryType) params.set('entryType', filters.entryType);
      if (filters.sizeMin) params.set('sizeMin', filters.sizeMin);
      if (filters.modifiedAfter) params.set('modifiedAfter', filters.modifiedAfter);
      if (filters.modifiedBefore) params.set('modifiedBefore', filters.modifiedBefore);

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

      if (requestId !== requestIdRef.current) return;

      setResults(Array.isArray(payload) ? payload : []);
      setHasSearched(true);
    } catch (error) {
      if (requestId !== requestIdRef.current) return;

      const message =
        error instanceof Error ? error.message : 'La recherche a échoué.';

      toast.error('Erreur de recherche', {
        description: message
      });
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    const trimmed = query.trim();

    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }

    if (!trimmed) {
      requestIdRef.current += 1;
      setResults([]);
      setSelected(null);
      setDetailsOpen(false);
      setHasSearched(false);
      setLoading(false);
      return;
    }

    debounceRef.current = window.setTimeout(() => {
      void runSearch(trimmed);
    }, 300);

    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, diskId, filters]);

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
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nom de fichier, extension, dossier, chemin..."
                className="pl-9"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && query.trim()) {
                    if (debounceRef.current) window.clearTimeout(debounceRef.current);
                    void runSearch(query.trim());
                  }
                }}
              />
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

            <Button
              onClick={() => {
                if (!query.trim()) return;
                if (debounceRef.current) window.clearTimeout(debounceRef.current);
                void runSearch(query.trim());
              }}
              disabled={!query.trim() || loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              {loading ? 'Recherche...' : 'Rechercher'}
            </Button>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              <Filter className="h-3.5 w-3.5" />
              Filtres avancés
              {activeFilterCount > 0 ? (
                <Badge variant="secondary" className="ml-0.5 px-1.5 py-0 text-[11px]">
                  {activeFilterCount}
                </Badge>
              ) : null}
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${filtersOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {filtersOpen ? (
              <div className="mt-3 grid gap-3 rounded-xl border bg-muted/10 p-4 sm:grid-cols-2 lg:grid-cols-5">
                <FilterField label="Extension">
                  <Input
                    value={filters.extension}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, extension: e.target.value.replace(/^\./, '') }))
                    }
                    placeholder="pdf, docx..."
                    className="h-9"
                  />
                </FilterField>

                <FilterField label="Type">
                  <select
                    className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                    value={filters.entryType}
                    onChange={(e) =>
                      setFilters((f) => ({
                        ...f,
                        entryType: e.target.value as Filters['entryType']
                      }))
                    }
                  >
                    <option value="">Fichiers et dossiers</option>
                    <option value="FILE">Fichiers uniquement</option>
                    <option value="FOLDER">Dossiers uniquement</option>
                  </select>
                </FilterField>

                <FilterField label="Taille minimum">
                  <select
                    className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                    value={filters.sizeMin}
                    onChange={(e) => setFilters((f) => ({ ...f, sizeMin: e.target.value }))}
                  >
                    {SIZE_PRESETS.map((preset) => (
                      <option key={preset.value} value={preset.value}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </FilterField>

                <FilterField label="Modifié après">
                  <Input
                    type="date"
                    value={filters.modifiedAfter}
                    onChange={(e) => setFilters((f) => ({ ...f, modifiedAfter: e.target.value }))}
                    className="h-9"
                  />
                </FilterField>

                <FilterField label="Modifié avant">
                  <Input
                    type="date"
                    value={filters.modifiedBefore}
                    onChange={(e) => setFilters((f) => ({ ...f, modifiedBefore: e.target.value }))}
                    className="h-9"
                  />
                </FilterField>

                {activeFilterCount > 0 ? (
                  <div className="flex items-end sm:col-span-2 lg:col-span-5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setFilters(EMPTY_FILTERS)}
                    >
                      <X className="h-3.5 w-3.5" />
                      Réinitialiser les filtres
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {!query.trim() ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-14 text-center">
              <Search className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">Recherche un fichier ou un dossier</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Tape un nom, une extension (ex. .pdf) ou un bout de chemin — les
                résultats s’affichent au fur et à mesure.
              </p>
            </div>
          ) : loading && results.length === 0 ? (
            <div className="flex items-center justify-center gap-3 rounded-xl border px-6 py-14 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Recherche en cours...
            </div>
          ) : hasSearched && results.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-14 text-center">
              <Search className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">Aucun résultat</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Rien ne correspond à « {query.trim()} »
                {diskId ? ' sur ce disque' : ''}. Essaie un autre terme ou
                élargis le filtre de disque.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {results.length} résultat{results.length > 1 ? 's' : ''}
                {loading ? ' · actualisation...' : ''}
              </p>

              <div className="overflow-hidden rounded-xl border">
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
                    {results.map((result) => {
                    const disabledReason = getOpenDisabledReason(result);

                    return (
                      <TableRow
                        key={result.id}
                        className="cursor-pointer hover:bg-muted/40"
                        onClick={() => openDetails(result)}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {result.entryType === 'FILE' ? (
                              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                            ) : (
                              <Folder className="h-4 w-4 shrink-0 text-amber-500" />
                            )}
                            <span className="truncate">{result.name}</span>
                          </div>
                        </TableCell>

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
                  })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
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

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
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