import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  HardDrive,
  Calendar,
  Files,
  ChevronRight,
  FolderTree,
  BellDot,
  Info,
  Activity,
  ChevronDown
} from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { buildDiskTreeResponse } from '@/lib/tree';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { DiskTreeView } from '@/components/disks/disk-tree-view';
import { DiskRowActions } from '@/components/disks/disk-row-actions';
import { OpenDiskButton } from '@/components/disks/open-disk-button';
import { ScanActionsModal } from '@/components/disks/scan-actions-modal';
import { DiskDetailModals } from '@/components/disks/disk-detail-modals';

const statusLabels: Record<string, string> = {
  ACTIVE: 'Actif',
  INACTIVE: 'Inactif',
  DISCONNECTED: 'Non connecté'
};

const scanTypeLabels: Record<string, string> = {
  DIFFERENTIAL: 'Différentiel',
  FULL: 'Complet'
};

export default async function DiskDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
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

  const latestScan = disk.scanJobs[0] ?? null;

  const scanItems = disk.scanJobs.map((job) => ({
    id: job.id,
    scanType: job.scanType,
    status: job.status,
    startedAt: job.startedAt ? job.startedAt.toISOString() : null,
    currentPath: job.currentPath ?? null,
    phase: job.phase ?? null,
    summaryText: job.summary
      ? JSON.stringify(job.summary)
      : job.errorMessage || '—'
  }));

  const activityItems = disk.activities.map((activity) => ({
    id: activity.id,
    activityType: activity.activityType,
    path: activity.path,
    createdAt: activity.createdAt.toISOString()
  }));

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <Card className="overflow-hidden border-0 shadow-sm">
        <div className="h-1 w-full bg-gradient-to-r from-primary/60 via-primary to-primary/60" />

        <CardHeader className="border-b bg-muted/20 px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 space-y-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-xl bg-primary/10 p-2.5 text-primary">
                  <HardDrive className="h-5 w-5" />
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-xl sm:text-2xl">
                      {disk.code}
                    </CardTitle>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                    <CardTitle className="text-xl font-normal sm:text-2xl">
                      {disk.name}
                    </CardTitle>
                  </div>

                  <CardDescription className="mt-1 break-all font-mono text-xs sm:text-sm">
                    {disk.rootPath}
                  </CardDescription>
                </div>
              </div>

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

                <Badge variant="outline">
                  {disk.entries.length.toLocaleString('fr-FR')} entrées
                </Badge>

                <Badge variant="outline">
                  {disk.activities.length} activités récentes
                </Badge>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <OpenDiskButton
                diskId={disk.id}
                rootPath={disk.rootPath}
                status={disk.status}
              />

              <ScanActionsModal diskId={disk.id} />

              <DiskRowActions
                diskId={disk.id}
                isEnabled={disk.isEnabled}
                status={disk.status}
              />
            </div>
          </div>
        </CardHeader>
      </Card>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricHorizontal
          icon={<HardDrive className="h-4 w-4" />}
          label="Statut"
          value={statusLabels[disk.status] ?? disk.status}
        />
        <MetricHorizontal
          icon={<Calendar className="h-4 w-4" />}
          label="Dernier scan"
          value={
            disk.lastScanAt
              ? format(disk.lastScanAt, 'dd MMM yyyy HH:mm', { locale: fr })
              : 'Jamais'
          }
        />
        <MetricHorizontal
          icon={<Files className="h-4 w-4" />}
          label="Entrées indexées"
          value={disk.entries.length.toLocaleString('fr-FR')}
        />
        <MetricHorizontal
          icon={<BellDot className="h-4 w-4" />}
          label="Repères rapides"
          value={
            latestScan
              ? `${scanTypeLabels[latestScan.scanType] ?? latestScan.scanType} • ${disk.name}`
              : `${statusLabels[disk.status] ?? disk.status} • ${disk.name}`
          }
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <AccordionSection
            icon={<Info className="h-4 w-4" />}
            title="Identification"
            description="Informations générales du disque."
            defaultOpen
          >
            <SidebarInfoBlock label="Code disque" value={disk.code} />
            <SidebarInfoBlock label="Nom" value={disk.name} />
            <SidebarInfoBlock label="Chemin racine" value={disk.rootPath} mono />
            <SidebarInfoBlock
              label="Dernier scan lancé"
              value={
                latestScan
                  ? `${scanTypeLabels[latestScan.scanType] ?? latestScan.scanType} • ${latestScan.status}`
                  : 'Aucun scan'
              }
            />
            <SidebarInfoBlock
              label="Description"
              value={disk.description?.trim() || 'Aucune description'}
            />
          </AccordionSection>

          <AccordionSection
            icon={<Activity className="h-4 w-4" />}
            title="Actions et journaux"
            description="Ouvre les détails longs dans des fenêtres modales."
            defaultOpen
          >
            <div className="grid gap-2">
              <DiskDetailModals scans={scanItems} activities={activityItems} />
            </div>

            <div className="grid gap-2 pt-1">
              <SidebarMiniStat
                label="Historique disponible"
                value={`${scanItems.length} scan${scanItems.length > 1 ? 's' : ''}`}
              />
              <SidebarMiniStat
                label="Activités consultables"
                value={`${activityItems.length} événement${activityItems.length > 1 ? 's' : ''}`}
              />
            </div>
          </AccordionSection>
        </aside>

        <Card className="overflow-hidden border-0 shadow-sm">
          <CardHeader className="border-b bg-muted/20 px-4 py-4 sm:px-6">
            <div className="flex items-center gap-2">
              <FolderTree className="h-4 w-4 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">Contenu du disque</CardTitle>
                <CardDescription className="text-xs">
                  Arborescence indexée du disque.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="px-4 py-4 sm:px-6">
            <DiskTreeView tree={tree.tree} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricHorizontal({
  icon,
  label,
  value
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="flex items-center gap-3 px-4 py-4">
        <div className="rounded-xl bg-primary/10 p-2 text-primary">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="truncate text-sm font-semibold sm:text-base">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function AccordionSection({
  icon,
  title,
  description,
  children,
  defaultOpen = false
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="overflow-hidden rounded-2xl border bg-background shadow-sm"
    >
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 border-b bg-muted/20 px-4 py-4">
        <div className="flex items-start gap-2">
          <div className="mt-0.5 text-muted-foreground">{icon}</div>
          <div>
            <p className="text-sm font-semibold">{title}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>

        <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      </summary>

      <div className="space-y-3 px-4 py-4">{children}</div>
    </details>
  );
}

function SidebarInfoBlock({
  label,
  value,
  mono = false
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-muted/10 px-3 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={`mt-1 text-sm ${mono ? 'break-all font-mono' : ''}`}>
        {value}
      </p>
    </div>
  );
}

function SidebarMiniStat({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border bg-muted/10 px-3 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}