import { notFound } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Activity,
  BellDot,
  ChevronDown,
  HardDrive,
  Info,
  Laptop,
  Monitor,
  ScanSearch,
  Server,
  Wifi,
  WifiOff
} from 'lucide-react';
import { DiskStatus } from '@prisma/client';
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
                  <AgentStatusBadge
                    status={disk.agentDevice?.status ?? 'OFFLINE'}
                  />
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
              />

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
                  value={agentStatusLabels[disk.agentDevice?.status ?? 'OFFLINE']}
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
              label="Alertes récentes"
              value={String(disk.activities.length)}
            />
          </AccordionSection>
        </aside>

        <Card className="overflow-hidden border-0 shadow-sm">
          <CardHeader className="border-b bg-muted/20">
            <CardTitle className="text-base">Contenu du disque</CardTitle>
            <CardDescription>
              Arborescence indexée et contenu actuellement connu.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-6">
            <DiskTreeView tree={tree.tree} />
          </CardContent>
        </Card>
      </div>
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