'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from 'recharts';
import { FileText, Folder, HardDrive, Loader2, PieChart } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { ExportCsvButton } from '@/components/disks/export-csv-button';
import { formatBytes, truncateMiddle } from '@/lib/utils';

type DiskOption = {
  id: string;
  code: string;
  name: string;
};

type StorageData = {
  disk: { id: string; code: string; name: string };
  totalFiles: number;
  totalFolders: number;
  totalSize: string;
  byExtension: { extension: string; size: string; count: number }[];
  largestFiles: {
    id: string;
    name: string;
    relativePath: string;
    extension: string | null;
    size: string;
    modifiedAt: string | null;
  }[];
};

function formatDate(value: string | null) {
  if (!value) return '-';
  try {
    return format(new Date(value), 'dd MMM yyyy HH:mm', { locale: fr });
  } catch {
    return '-';
  }
}

const extensionChartConfig = {
  size: { label: 'Taille' }
} satisfies ChartConfig;

const MAX_CHART_ROWS = 10;

export function StorageClient({ disks }: { disks: DiskOption[] }) {
  const [diskId, setDiskId] = useState(disks[0]?.id ?? '');
  const [data, setData] = useState<StorageData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!diskId) return;

    let cancelled = false;
    setLoading(true);

    fetch(`/api/disks/${diskId}/storage`, { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || "Impossible de charger l'analyse d'espace.");
        }
        if (!cancelled) setData(payload);
      })
      .catch((error) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'Erreur inconnue.';
        toast.error("Analyse d'espace indisponible", { description: message });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [diskId]);

  const sortedExtensions = useMemo(
    () => [...(data?.byExtension ?? [])].sort((a, b) => Number(b.size) - Number(a.size)),
    [data]
  );

  const chartData = useMemo(
    () =>
      sortedExtensions.slice(0, MAX_CHART_ROWS).map((row) => ({
        extension: `.${row.extension}`,
        size: Number(row.size),
        count: row.count,
        share: Number(data?.totalSize) > 0 ? (Number(row.size) / Number(data?.totalSize)) * 100 : 0
      })),
    [sortedExtensions, data]
  );

  const hiddenExtensionCount = Math.max(0, sortedExtensions.length - chartData.length);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Analyse d&apos;espace disque</CardTitle>
            <CardDescription>
              Répartition du stockage par type de fichier et plus gros fichiers indexés.
            </CardDescription>
          </div>

          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={diskId}
            onChange={(e) => setDiskId(e.target.value)}
          >
            {disks.length === 0 ? <option value="">Aucun disque</option> : null}
            {disks.map((disk) => (
              <option key={disk.id} value={disk.id}>
                {disk.code} — {disk.name}
              </option>
            ))}
          </select>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {loading && !data ? (
          <div className="flex items-center justify-center gap-3 rounded-xl border px-6 py-14 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analyse en cours...
          </div>
        ) : !data ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-14 text-center">
            <HardDrive className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Sélectionne un disque</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Choisis un disque indexé pour voir la répartition de son espace de stockage.
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryStat
                icon={<HardDrive className="h-4 w-4" />}
                label="Espace indexé"
                value={formatBytes(BigInt(data.totalSize))}
              />
              <SummaryStat
                icon={<FileText className="h-4 w-4" />}
                label="Fichiers"
                value={data.totalFiles.toLocaleString('fr-FR')}
              />
              <SummaryStat
                icon={<Folder className="h-4 w-4" />}
                label="Dossiers"
                value={data.totalFolders.toLocaleString('fr-FR')}
              />
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <PieChart className="h-4 w-4 text-muted-foreground" />
                  Répartition par type de fichier
                </div>

                <ExportCsvButton href={`/api/disks/${diskId}/storage/export`} />
              </div>

              {data.byExtension.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun fichier indexé sur ce disque.</p>
              ) : (
                <div className="rounded-xl border p-4">
                  <ChartContainer
                    config={extensionChartConfig}
                    className="aspect-auto"
                    style={{ height: Math.max(chartData.length * 36, 120) }}
                  >
                    <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 48 }}>
                      <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="extension"
                        width={72}
                        tickLine={false}
                        axisLine={false}
                        className="font-mono"
                      />
                      <ChartTooltip
                        cursor={{ fill: 'hsl(var(--muted))' }}
                        content={<ChartTooltipContent formatter={(value) => formatBytes(value)} />}
                      />
                      <Bar dataKey="size" radius={[0, 6, 6, 0]}>
                        {chartData.map((_entry, index) => (
                          <Cell key={index} fill={`hsl(var(--chart-${(index % 5) + 1}))`} />
                        ))}
                        <LabelList
                          dataKey="size"
                          position="right"
                          formatter={(value) => formatBytes(Number(value))}
                          className="fill-foreground text-xs"
                        />
                      </Bar>
                    </BarChart>
                  </ChartContainer>

                  {hiddenExtensionCount > 0 ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      +{hiddenExtensionCount} autre{hiddenExtensionCount > 1 ? 's' : ''} type
                      {hiddenExtensionCount > 1 ? 's' : ''} de fichier non affiché
                      {hiddenExtensionCount > 1 ? 's' : ''} (triés par taille).
                    </p>
                  ) : null}
                </div>
              )}
            </div>

            <div>
              <div className="mb-3 text-sm font-medium">Fichiers les plus volumineux</div>

              {data.largestFiles.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun fichier indexé sur ce disque.</p>
              ) : (
                <div className="divide-y rounded-xl border">
                  {data.largestFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between gap-3 px-3 py-2.5"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{file.name}</p>
                          <p
                            className="truncate font-mono text-xs text-muted-foreground"
                            title={file.relativePath}
                          >
                            {truncateMiddle(file.relativePath, 50, 20)}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-medium">{formatBytes(BigInt(file.size))}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(file.modifiedAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SummaryStat({
  icon,
  label,
  value
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border px-4 py-3">
      <div className="rounded-lg bg-primary/10 p-2 text-primary">{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="truncate text-base font-semibold">{value}</p>
      </div>
    </div>
  );
}
