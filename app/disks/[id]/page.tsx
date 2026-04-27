import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { HardDrive, Calendar, Files, Activity, ChevronRight } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { buildDiskTreeResponse } from '@/lib/tree';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DiskForm } from '@/components/disks/disk-form';
import { DiskTreeView } from '@/components/disks/disk-tree-view';
import { ScanButton } from '@/components/disks/scan-button';
import { DiskRowActions } from '@/components/disks/disk-row-actions';

const statusLabels: Record<string, string> = {
  ACTIVE: 'Actif',
  INACTIVE: 'Inactif',
  DISCONNECTED: 'Non connecté'
};

const scanTypeLabels: Record<string, string> = {
  DIFFERENTIAL: 'Différentiel',
  FULL: 'Complet'
};

const activityTypeColors: Record<string, string> = {
  ADDED: 'text-emerald-600 dark:text-emerald-400',
  DELETED: 'text-red-600 dark:text-red-400',
  MODIFIED: 'text-blue-600 dark:text-blue-400',
  RENAMED: 'text-violet-600 dark:text-violet-400'
};

const scanStatusColors: Record<string, string> = {
  COMPLETED: 'text-emerald-600 dark:text-emerald-400',
  FAILED: 'text-red-600 dark:text-red-400',
  RUNNING: 'text-blue-600 dark:text-blue-400',
  PENDING: 'text-muted-foreground'
};

export default async function DiskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const disk = await prisma.disk.findUnique({
    where: { id },
    include: {
      entries: {
        where: { deletedAt: null },
        orderBy: { relativePath: 'asc' }
      },
      scanJobs: {
        orderBy: { createdAt: 'desc' },
        take: 10
      },
      activities: {
        orderBy: { createdAt: 'desc' },
        take: 20
      }
    }
  });

  if (!disk) notFound();

  const tree = buildDiskTreeResponse({
    diskId: disk.code,
    diskName: disk.name,
    rootPath: disk.rootPath,
    status: disk.status,
    lastScan: disk.lastScanAt,
    entries: disk.entries
  });

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      {/* Header card */}
      <Card className="overflow-hidden">
        {/* Thin accent bar on top */}
        <div className="h-1 w-full bg-gradient-to-r from-primary/60 via-primary to-primary/60" />

        <CardHeader className="border-b bg-muted/20 px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            {/* Title */}
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary">
                <HardDrive className="h-5 w-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-xl sm:text-2xl">
                    {disk.code}
                  </CardTitle>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                  <CardTitle className="text-xl font-normal sm:text-2xl">{disk.name}</CardTitle>
                </div>
                <CardDescription className="mt-1 font-mono text-xs">{disk.rootPath}</CardDescription>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={
                  disk.status === 'ACTIVE'
                    ? 'default'
                    : disk.status === 'DISCONNECTED'
                      ? 'destructive'
                      : 'secondary'
                }
              >
                {statusLabels[disk.status] ?? disk.status}
              </Badge>
              <ScanButton diskId={disk.id} scanType="DIFFERENTIAL" />
              <ScanButton diskId={disk.id} scanType="FULL" />
              <DiskRowActions diskId={disk.id} isEnabled={disk.isEnabled} status={disk.status} />
            </div>
          </div>
        </CardHeader>

        {/* Metrics */}
        <CardContent className="grid grid-cols-2 gap-3 px-4 py-4 sm:px-6 md:grid-cols-4">
          <Metric
            icon={<HardDrive className="h-3.5 w-3.5" />}
            label="Statut"
            value={statusLabels[disk.status] ?? disk.status}
          />
          <Metric
            icon={<Calendar className="h-3.5 w-3.5" />}
            label="Dernier scan"
            value={
              disk.lastScanAt
                ? format(disk.lastScanAt, 'dd MMM yyyy HH:mm', { locale: fr })
                : 'Jamais'
            }
          />
          <Metric
            icon={<Files className="h-3.5 w-3.5" />}
            label="Entrées indexées"
            value={disk.entries.length.toLocaleString('fr-FR')}
          />
          <Metric
            icon={<Activity className="h-3.5 w-3.5" />}
            label="Activités récentes"
            value={String(disk.activities.length)}
          />
        </CardContent>
      </Card>

      {/* Form + tree */}
      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <DiskForm
          disk={{
            id: disk.id,
            code: disk.code,
            name: disk.name,
            rootPath: disk.rootPath,
            description: disk.description,
            status: disk.status,
            isEnabled: disk.isEnabled
          }}
        />
        <DiskTreeView tree={tree.tree} />
      </div>

      {/* Scan history + activities */}
      <div className="grid gap-6 xl:grid-cols-2">
        {/* Scan history */}
        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-muted/20 px-4 py-4 sm:px-6">
            <CardTitle className="text-base">Historique des scans</CardTitle>
            <CardDescription className="text-xs">
              Scans complets et différentiels récents.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {disk.scanJobs.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Aucun scan enregistré.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/10 hover:bg-muted/10">
                      <TableHead className="pl-5">Type</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Démarré</TableHead>
                      <TableHead className="pr-5">Résumé</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {disk.scanJobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell className="pl-5 font-medium">
                          {scanTypeLabels[job.scanType] ?? job.scanType}
                        </TableCell>
                        <TableCell>
                          <span className={`text-xs font-semibold ${scanStatusColors[job.status] ?? ''}`}>
                            {job.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {job.startedAt
                            ? format(job.startedAt, 'dd/MM/yyyy HH:mm', { locale: fr })
                            : '—'}
                        </TableCell>
                        <TableCell className="pr-5 max-w-[180px]">
                          <span className="block truncate text-[11px] text-muted-foreground" title={job.summary ? JSON.stringify(job.summary) : job.errorMessage ?? ''}>
                            {job.summary ? JSON.stringify(job.summary) : job.errorMessage || '—'}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activities */}
        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-muted/20 px-4 py-4 sm:px-6">
            <CardTitle className="text-base">Dernières activités</CardTitle>
            <CardDescription className="text-xs">
              Ajouts, suppressions, modifications ou renommages détectés.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {disk.activities.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Aucune activité détectée.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/10 hover:bg-muted/10">
                      <TableHead className="pl-5">Type</TableHead>
                      <TableHead>Chemin</TableHead>
                      <TableHead className="pr-5">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {disk.activities.map((activity) => (
                      <TableRow key={activity.id}>
                        <TableCell className="pl-5">
                          <span className={`text-xs font-semibold ${activityTypeColors[activity.activityType] ?? ''}`}>
                            {activity.activityType}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <span
                            className="block truncate font-mono text-[11px] text-muted-foreground"
                            title={activity.path}
                          >
                            {activity.path}
                          </span>
                        </TableCell>
                        <TableCell className="pr-5 text-xs text-muted-foreground">
                          {format(activity.createdAt, 'dd/MM/yyyy HH:mm', { locale: fr })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Metric({
  icon,
  label,
  value
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/10 px-3 py-3">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1.5 text-base font-semibold tabular-nums sm:text-lg">{value}</div>
    </div>
  );
}