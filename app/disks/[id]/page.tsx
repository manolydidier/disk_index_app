import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Activity,
  ArrowLeft,
  BellDot,
  ClipboardList,
  HardDrive,
  History,
  Info,
  Laptop,
  Monitor,
  ScanSearch,
  Server,
  ShieldCheck,
  Wifi,
  WifiOff
} from 'lucide-react';
import { DiskStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { buildDiskTreeResponse } from '@/lib/tree';
import { resolveAgentDeviceStatus } from '@/lib/agent/device-status';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion';
import { DiskTreeView } from '@/components/disks/disk-tree-view';
import { DiskRowActions } from '@/components/disks/disk-row-actions';
import { OpenDiskButton } from '@/components/disks/open-disk-button';
import { ScanActionsModal } from '@/components/disks/scan-actions-modal';
import { ExportCsvButton } from '@/components/disks/export-csv-button';
import { DiskAccessPanel } from '@/components/disks/disk-access-panel';
import { DiskChangesReport } from '@/components/disks/disk-changes-report';
import { canAccessDisk, getSessionAccessibleDiskIds } from '@/lib/disk-access';
import { formatBytes } from '@/lib/utils';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

// Force per-request rendering — this page's data (disk status, scan
// history, activity log) must never be served from a build-time snapshot.
export const dynamic = 'force-dynamic';

const statusLabels: Record<DiskStatus, string> = {
  ACTIVE: 'Actif',
  INACTIVE: 'Inactif',
  DISCONNECTED: 'Non connecté'
};

const agentStatusLabels: Record<'ONLINE' | 'OFFLINE' | 'DISABLED', string> = {
  ONLINE: 'En ligne',
  OFFLINE: 'Hors ligne',
  DISABLED: 'Désactivé'
};

export default async function DiskDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const accessibleDiskIds = await getSessionAccessibleDiskIds();
  if (!canAccessDisk(accessibleDiskIds, id)) notFound();

  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === 'ADMIN';

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
      },
      agentDevice: {
        select: {
          id: true,
          machineId: true,
          hostName: true,
          userLabel: true,
          status: true,
          osName: true,
          appVersion: true,
          lastHeartbeatAt: true,
          lastSeenAt: true
        }
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
  const agentDeviceStatus = disk.agentDevice
    ? resolveAgentDeviceStatus(disk.agentDevice.status, disk.agentDevice.lastHeartbeatAt)
    : 'OFFLINE';
  const machineLabel =
    disk.sourceType === 'SERVER'
      ? 'Serveur'
      : disk.agentDevice?.hostName ||
        disk.sourceLabel ||
        disk.agentDevice?.machineId ||
        'Machine inconnue';

  const lastHeartbeatLabel =
    disk.agentDevice?.lastHeartbeatAt
      ? formatDistanceToNow(new Date(disk.agentDevice.lastHeartbeatAt), {
          addSuffix: true,
          locale: fr
        })
      : 'Jamais';

  return (
    <div className="space-y-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour au tableau de bord
      </Link>

      <Card className="overflow-hidden border-0 shadow-sm">
        <div className="h-1 w-full bg-gradient-to-r from-primary/60 via-primary to-primary/60" />

        <CardHeader className="border-b bg-muted/20">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 space-y-4">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                  <HardDrive className="h-5 w-5" />
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-xl sm:text-2xl">
                      {disk.code}
                    </CardTitle>
                    <CardTitle className="text-xl font-normal sm:text-2xl">
                      — {disk.name}
                    </CardTitle>
                  </div>

                  <CardDescription className="mt-1 break-all font-mono text-xs sm:text-sm">
                    {disk.rootPath}
                  </CardDescription>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={disk.status} />
                <SourceBadge sourceType={disk.sourceType} />
                {disk.sourceType === 'AGENT' ? (
                  <AgentStatusBadge status={agentDeviceStatus} />
                ) : null}
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

              <ScanActionsModal
                diskId={disk.id}
                sourceType={disk.sourceType}
                agentStatus={agentDeviceStatus}
              />

              <DiskRowActions
                diskId={disk.id}
                code={disk.code}
                name={disk.name}
                rootPath={disk.rootPath}
                description={disk.description}
                isEnabled={disk.isEnabled}
                status={disk.status}
              />
            </div>
          </div>
        </CardHeader>
      </Card>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<HardDrive className="h-4 w-4" />}
          label="Statut disque"
          value={statusLabels[disk.status]}
          subvalue={disk.rootPath}
        />
        <MetricCard
          icon={
            disk.sourceType === 'SERVER' ? (
              <Server className="h-4 w-4" />
            ) : (
              <Laptop className="h-4 w-4" />
            )
          }
          label="Source"
          value={disk.sourceType === 'SERVER' ? 'Serveur' : 'Cet ordinateur'}
          subvalue={disk.sourceLabel || undefined}
        />
        <MetricCard
          icon={<Monitor className="h-4 w-4" />}
          label="Machine"
          value={machineLabel}
          subvalue={
            disk.sourceType === 'AGENT'
              ? disk.agentDevice?.userLabel || disk.agentDevice?.machineId || undefined
              : 'Exécution locale'
          }
        />
        <MetricCard
          icon={<ScanSearch className="h-4 w-4" />}
          label="Dernier scan"
          value={
            latestScan
              ? latestScan.scanType === 'FULL'
                ? 'Complet'
                : 'Différentiel'
              : 'Jamais'
          }
          subvalue={latestScan?.status || 'Aucun scan enregistré'}
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
            <InfoBlock label="Code disque" value={disk.code} />
            <InfoBlock label="Nom" value={disk.name} />
            <InfoBlock label="Chemin racine" value={disk.rootPath} mono />
            <InfoBlock
              label="Source"
              value={disk.sourceType === 'SERVER' ? 'Serveur' : 'Agent utilisateur'}
            />
            <InfoBlock
              label="Machine"
              value={machineLabel}
            />
          </AccordionSection>

          <AccordionSection
            icon={disk.sourceType === 'SERVER' ? <Server className="h-4 w-4" /> : <Wifi className="h-4 w-4" />}
            title="Connexion agent"
            description="État de connexion de la machine source."
            defaultOpen
          >
            {disk.sourceType === 'SERVER' ? (
              <div className="rounded-xl border bg-muted/10 px-3 py-3 text-sm">
                Ce disque est géré directement par le serveur.
              </div>
            ) : (
              <div className="space-y-3">
                <InfoBlock
                  label="État agent"
                  value={agentStatusLabels[agentDeviceStatus]}
                />
                <InfoBlock
                  label="Dernier heartbeat"
                  value={lastHeartbeatLabel}
                />
                <InfoBlock
                  label="Utilisateur"
                  value={disk.agentDevice?.userLabel || 'Non renseigné'}
                />
                <InfoBlock
                  label="Machine ID"
                  value={disk.agentDevice?.machineId || 'Inconnu'}
                  mono
                />
                <InfoBlock
                  label="Système"
                  value={disk.agentDevice?.osName || 'Inconnu'}
                />
                <InfoBlock
                  label="Version agent"
                  value={disk.agentDevice?.appVersion || 'Inconnue'}
                />
              </div>
            )}
          </AccordionSection>

          {isAdmin ? (
            <AccordionSection
              icon={<ShieldCheck className="h-4 w-4" />}
              title="Accès"
              description="Utilisateurs autorisés à voir ce disque."
              defaultOpen
            >
              <DiskAccessPanel diskId={disk.id} />
            </AccordionSection>
          ) : null}

          <AccordionSection
            icon={<Activity className="h-4 w-4" />}
            title="Résumé"
            description="Dernières informations utiles."
            defaultOpen
          >
            <InfoBlock
              label="Dernière activité disque"
              value={
                disk.lastActivityAt
                  ? formatDistanceToNow(new Date(disk.lastActivityAt), {
                      addSuffix: true,
                      locale: fr
                    })
                  : 'Aucune activité'
              }
            />
            <InfoBlock
              label="Dernière détection"
              value={
                disk.lastSeenAt
                  ? formatDistanceToNow(new Date(disk.lastSeenAt), {
                      addSuffix: true,
                      locale: fr
                    })
                  : 'Jamais'
              }
            />
            <InfoBlock
              label="Entrées indexées"
              value={disk.entries.length.toLocaleString('fr-FR')}
            />
            <InfoBlock
              label="Activités récentes"
              value={String(disk.activities.length)}
            />
            {disk.totalBytes ? (
              <InfoBlock
                label="Espace disque"
                value={
                  disk.freeBytes
                    ? `${formatBytes(disk.freeBytes)} libre sur ${formatBytes(disk.totalBytes)}`
                    : formatBytes(disk.totalBytes)
                }
              />
            ) : null}
          </AccordionSection>
        </aside>

        <Card className="overflow-hidden border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-3 border-b bg-muted/20">
            <div>
              <CardTitle className="text-base">Contenu du disque</CardTitle>
              <CardDescription>
                Arborescence indexée et contenu actuellement connu.
              </CardDescription>
            </div>

            <ExportCsvButton
              href={`/api/disks/${disk.id}/export?type=entries`}
            />
          </CardHeader>

          <CardContent className="pt-6">
            <DiskTreeView tree={tree.tree} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="overflow-hidden border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-3 border-b bg-muted/20">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="h-4 w-4" />
                Historique des scans
              </CardTitle>
              <CardDescription>Les 10 derniers scans de ce disque.</CardDescription>
            </div>

            <ExportCsvButton
              href={`/api/disks/${disk.id}/export?type=scans`}
            />
          </CardHeader>

          <CardContent className="pt-6">
            {disk.scanJobs.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center">
                <History className="h-7 w-7 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Aucun scan enregistré pour l&apos;instant.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {disk.scanJobs.map((job) => {
                  const summary = (job.summary ?? {}) as {
                    added?: number;
                    modified?: number;
                    renamed?: number;
                    deleted?: number;
                    totalIndexed?: number;
                  };

                  return (
                    <div
                      key={job.id}
                      className="rounded-xl border bg-muted/10 px-3 py-3 text-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">
                          {job.scanType === 'FULL' ? 'Scan complet' : 'Scan différentiel'}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {job.createdAt.toLocaleString('fr-FR')}
                          </span>
                          <ScanJobStatusBadge status={job.status} />
                        </div>
                      </div>

                      {job.status === 'COMPLETED' ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          +{summary.added ?? 0} ajoutés · {summary.modified ?? 0} modifiés ·{' '}
                          {summary.renamed ?? 0} renommés · -{summary.deleted ?? 0} supprimés ·{' '}
                          {summary.totalIndexed ?? 0} au total
                        </p>
                      ) : job.errorMessage ? (
                        <p className="mt-1 text-xs text-destructive">{job.errorMessage}</p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-3 border-b bg-muted/20">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4" />
                Journal d’activité
              </CardTitle>
              <CardDescription>Les 20 derniers changements détectés.</CardDescription>
            </div>

            <ExportCsvButton
              href={`/api/disks/${disk.id}/export?type=activities`}
            />
          </CardHeader>

          <CardContent className="pt-6">
            {disk.activities.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center">
                <ClipboardList className="h-7 w-7 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Aucune activité enregistrée pour l&apos;instant.</p>
              </div>
            ) : (
              <div className="max-h-[420px] space-y-2 overflow-y-auto">
                {disk.activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start justify-between gap-3 rounded-xl border bg-muted/10 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="break-all font-mono text-xs">{activity.path}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {activity.createdAt.toLocaleString('fr-FR')}
                      </p>
                    </div>
                    <ActivityTypeBadge type={activity.activityType} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden border-0 shadow-sm">
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            Rapport de changements
          </CardTitle>
          <CardDescription>
            Compare l’activité de ce disque sur une période donnée.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-6">
          <DiskChangesReport diskId={disk.id} />
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  subvalue
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subvalue?: string;
}) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="flex items-start gap-3 px-4 py-4">
        <div className="rounded-xl bg-primary/10 p-2 text-primary">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="truncate text-sm font-semibold sm:text-base">{value}</p>
          {subvalue ? (
            <p className="mt-1 break-all text-xs text-muted-foreground">
              {subvalue}
            </p>
          ) : null}
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
    <Accordion
      type="single"
      collapsible
      defaultValue={defaultOpen ? 'section' : undefined}
      className="overflow-hidden rounded-2xl border bg-background shadow-sm"
    >
      <AccordionItem value="section" className="border-b-0">
        <AccordionTrigger className="items-start gap-3 border-b bg-muted/20 px-4 py-4 text-left hover:no-underline [&>svg]:mt-0.5">
          <div className="flex items-start gap-2">
            <div className="mt-0.5 text-muted-foreground">{icon}</div>
            <div>
              <p className="text-sm font-semibold">{title}</p>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          </div>
        </AccordionTrigger>

        <AccordionContent className="space-y-3 px-4 pb-4 pt-3">{children}</AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function InfoBlock({
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

function SourceBadge({
  sourceType
}: {
  sourceType: 'SERVER' | 'AGENT';
}) {
  return (
    <Badge variant={sourceType === 'SERVER' ? 'secondary' : 'outline'}>
      {sourceType === 'SERVER' ? 'Serveur' : 'Cet ordinateur'}
    </Badge>
  );
}

function AgentStatusBadge({
  status
}: {
  status: 'ONLINE' | 'OFFLINE' | 'DISABLED';
}) {
  return (
    <Badge
      variant={
        status === 'ONLINE'
          ? 'default'
          : status === 'OFFLINE'
            ? 'secondary'
            : 'destructive'
      }
    >
      {status === 'ONLINE' ? (
        <Wifi className="h-3.5 w-3.5" />
      ) : (
        <WifiOff className="h-3.5 w-3.5" />
      )}
      {agentStatusLabels[status]}
    </Badge>
  );
}

function ScanJobStatusBadge({
  status
}: {
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
}) {
  const labels: Record<typeof status, string> = {
    PENDING: 'En attente',
    RUNNING: 'En cours',
    COMPLETED: 'Terminé',
    FAILED: 'Échoué'
  };

  return (
    <Badge
      variant={
        status === 'COMPLETED'
          ? 'default'
          : status === 'FAILED'
            ? 'destructive'
            : 'secondary'
      }
    >
      {labels[status]}
    </Badge>
  );
}

function ActivityTypeBadge({
  type
}: {
  type: 'ADDED' | 'MODIFIED' | 'RENAMED' | 'DELETED' | 'DISK_STATUS';
}) {
  const labels: Record<typeof type, string> = {
    ADDED: 'Ajouté',
    MODIFIED: 'Modifié',
    RENAMED: 'Renommé',
    DELETED: 'Supprimé',
    DISK_STATUS: 'Statut disque'
  };

  return (
    <Badge
      variant={
        type === 'DELETED'
          ? 'destructive'
          : type === 'ADDED'
            ? 'default'
            : 'secondary'
      }
      className="shrink-0"
    >
      {labels[type]}
    </Badge>
  );
}

function StatusBadge({ status }: { status: DiskStatus }) {
  return (
    <Badge
      variant={
        status === 'ACTIVE'
          ? 'default'
          : status === 'DISCONNECTED'
            ? 'destructive'
            : 'secondary'
      }
    >
      {statusLabels[status]}
    </Badge>
  );
}