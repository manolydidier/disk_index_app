'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { DiskStatus } from '@prisma/client';
import {
  BellDot,
  CheckCircle2,
  Clock3,
  Database,
  Eye,
  HardDrive,
  LayoutGrid,
  List,
  Loader2,
  Search,
  Wifi,
  WifiOff,
  X,
  XCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { AddDiskModal } from '@/components/disks/add-disk-modal';
import { DiskRowActions } from '@/components/disks/disk-row-actions';
import { OpenDiskButton } from '@/components/disks/open-disk-button';
import { ScanActionsModal } from '@/components/disks/scan-actions-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';

type DashboardDisk = {
  id: string;
  code: string;
  name: string;
  rootPath: string;
  description: string | null;
  status: DiskStatus;
  isEnabled: boolean;
  sourceType: 'SERVER' | 'AGENT';
  sourceLabel: string | null;
  remoteDiskKey: string | null;
  lastSeenAt: string | null;
  entriesCount: number;
  activitiesCount: number;
  lastScan: {
    scanType: string;
    status: string;
  } | null;
  latestAgentCommand: {
    id: string;
    commandType: 'FULL_SCAN' | 'DIFFERENTIAL_SCAN' | 'REFRESH_AVAILABLE_DISKS';
    status: 'PENDING' | 'CLAIMED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELED';
    progressPercent: number;
    phase: string | null;
    currentPath: string | null;
    errorMessage: string | null;
    updatedAt: string;
  } | null;
  agentDevice: {
    id: string;
    machineId: string;
    hostName: string;
    userLabel: string | null;
    status: 'ONLINE' | 'OFFLINE' | 'DISABLED';
    lastHeartbeatAt: string | null;
    lastSeenAt: string | null;
  } | null;
  displayLabel: string;
  displayTitle: string;
};

type DashboardStats = {
  diskCount: number;
  fileEntryCount: number;
  activityCount: number;
};

type DashboardViewSwitcherProps = {
  disks: DashboardDisk[];
  stats: DashboardStats;
};

type ViewMode = 'cards' | 'table';

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

const commandStatusLabels: Record<
  'PENDING' | 'CLAIMED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELED',
  string
> = {
  PENDING: 'En attente',
  CLAIMED: 'Récupérée',
  RUNNING: 'En cours',
  COMPLETED: 'Terminée',
  FAILED: 'Erreur',
  CANCELED: 'Annulée'
};

export function DashboardViewSwitcher({
  disks,
  stats
}: DashboardViewSwitcherProps) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredDisks = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    if (!query) return disks;

    return disks.filter((disk) => {
      const haystack = [
        disk.code,
        disk.name,
        disk.rootPath,
        disk.displayLabel,
        disk.displayTitle,
        statusLabels[disk.status],
        disk.sourceType,
        disk.sourceLabel ?? '',
        disk.agentDevice?.hostName ?? '',
        disk.agentDevice?.machineId ?? '',
        disk.agentDevice?.userLabel ?? '',
        disk.agentDevice?.status ?? '',
        disk.latestAgentCommand?.status ?? '',
        disk.latestAgentCommand?.phase ?? ''
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [disks, searchTerm]);

  const hasActiveAgentCommand = useMemo(() => {
    return disks.some(
      (disk) =>
        disk.sourceType === 'AGENT' &&
        disk.latestAgentCommand &&
        ['PENDING', 'CLAIMED', 'RUNNING'].includes(
          disk.latestAgentCommand.status
        )
    );
  }, [disks]);

  useEffect(() => {
    if (!hasActiveAgentCommand) return;

    const timer = window.setInterval(() => {
      router.refresh();
    }, 4000);

    return () => window.clearInterval(timer);
  }, [hasActiveAgentCommand, router]);

  return (
    <div className="space-y-6">
      <section className="grid gap-3 md:grid-cols-3">
        <StatCard
          icon={<HardDrive className="h-5 w-5" />}
          title="Disques gérés"
          value={String(stats.diskCount)}
          description="Disques serveur et utilisateur"
        />
        <StatCard
          icon={<Database className="h-5 w-5" />}
          title="Entrées indexées"
          value={stats.fileEntryCount.toLocaleString('fr-FR')}
          description="Fichiers et dossiers indexés"
        />
        <StatCard
          icon={<BellDot className="h-5 w-5" />}
          title="Alertes en attente"
          value={String(stats.activityCount)}
          description="Activités non acquittées"
        />
      </section>

      <section>
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <CardTitle>Disques disponibles</CardTitle>
                <CardDescription>
                  Les disques du serveur et ceux remontés par les agents apparaissent ici.
                </CardDescription>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-full border bg-background p-1">
                  <Button
                    type="button"
                    variant={viewMode === 'cards' ? 'default' : 'ghost'}
                    size="sm"
                    className="rounded-full"
                    onClick={() => setViewMode('cards')}
                  >
                    <LayoutGrid className="h-4 w-4" />
                    Cartes
                  </Button>

                  <Button
                    type="button"
                    variant={viewMode === 'table' ? 'default' : 'ghost'}
                    size="sm"
                    className="rounded-full"
                    onClick={() => setViewMode('table')}
                  >
                    <List className="h-4 w-4" />
                    Tableau
                  </Button>
                </div>

                <Button
                  asChild
                  variant="outline"
                  className="rounded-full"
                  title="Recherche globale dans le contenu indexé de tous les disques"
                >
                  <Link href="/search">
                    <Search className="h-4 w-4" />
                    Rechercher un fichier
                  </Link>
                </Button>

                <AddDiskModal />
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full max-w-xl">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filtrer les disques affichés (nom, machine, statut...)"
                  className="h-10 rounded-xl pl-9 pr-10"
                />

                {searchTerm ? (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
                    aria-label="Effacer la recherche"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>

              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                {hasActiveAgentCommand ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Actualisation automatique active
                  </span>
                ) : null}
                <span>{filteredDisks.length} disque(s)</span>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {filteredDisks.length === 0 ? (
              disks.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-14 text-center">
                  <HardDrive className="h-10 w-10 text-muted-foreground" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      Aucun disque pour le moment
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Ajoute ton premier disque pour commencer à l'indexer.
                    </p>
                  </div>
                  <AddDiskModal />
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
                  Aucun disque ne correspond à la recherche.
                </div>
              )
            ) : viewMode === 'cards' ? (
              <DiskCardsView disks={filteredDisks} />
            ) : (
              <DiskTableView disks={filteredDisks} />
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function DiskCardsView({ disks }: { disks: DashboardDisk[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
      {disks.map((disk) => (
        <Card
          key={disk.id}
          className="overflow-hidden rounded-2xl border bg-background shadow-sm transition hover:shadow-md"
        >
          <CardHeader className="space-y-4 pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <Link
                  href={`/disks/${disk.id}`}
                  className="block text-base font-semibold leading-none hover:underline"
                  title={disk.displayTitle}
                >
                  {disk.displayLabel}
                </Link>

                {disk.displayLabel !== disk.code ? (
                  <p className="text-xs text-muted-foreground">{disk.code}</p>
                ) : null}

                <p className="text-sm text-muted-foreground">{disk.name}</p>
              </div>

              <StatusBadge status={disk.status} />
            </div>

            <div className="rounded-xl bg-muted/40 px-3 py-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Chemin racine
              </p>
              <p className="mt-1 break-all font-mono text-xs">{disk.rootPath}</p>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <InfoMiniCard
                label="Entrées"
                value={String(disk.entriesCount)}
                icon={<Database className="h-4 w-4" />}
              />
              <InfoMiniCard
                label="Alertes"
                value={String(disk.activitiesCount)}
                icon={<BellDot className="h-4 w-4" />}
              />
            </div>

            <div className="divide-y rounded-xl border">
              <InfoRow
                label="Source"
                value={
                  disk.sourceType === 'SERVER'
                    ? 'Disque scanné par le serveur'
                    : 'Disque remonté par un agent utilisateur'
                }
                sub={disk.sourceLabel ?? undefined}
                badge={<SourceBadge sourceType={disk.sourceType} />}
              />

              <InfoRow
                label="Machine"
                value={getMachineLabel(disk)}
                sub={
                  disk.sourceType === 'AGENT'
                    ? disk.agentDevice?.userLabel
                      ? `Utilisateur : ${disk.agentDevice.userLabel}`
                      : disk.lastSeenAt
                        ? `Dernière activité : ${new Date(disk.lastSeenAt).toLocaleString('fr-FR')}`
                        : 'Agent sans activité récente'
                    : 'Scan exécuté directement côté serveur'
                }
                badge={
                  disk.sourceType === 'AGENT' ? (
                    <AgentStatusBadge status={disk.agentDevice?.status ?? 'OFFLINE'} />
                  ) : undefined
                }
              />

              {disk.sourceType === 'AGENT' ? (
                <InfoRow
                  label="Commande agent"
                  value={
                    disk.latestAgentCommand
                      ? getCommandTypeLabel(disk.latestAgentCommand.commandType)
                      : 'Aucune commande récente'
                  }
                  sub={
                    disk.latestAgentCommand
                      ? `${disk.latestAgentCommand.phase ?? '—'} · ${disk.latestAgentCommand.progressPercent ?? 0}%`
                      : undefined
                  }
                  error={disk.latestAgentCommand?.errorMessage ?? undefined}
                  badge={
                    disk.latestAgentCommand ? (
                      <CommandStatusBadge status={disk.latestAgentCommand.status} />
                    ) : undefined
                  }
                />
              ) : null}

              <InfoRow
                label="Dernier scan"
                value={
                  disk.lastScan
                    ? disk.lastScan.scanType === 'FULL'
                      ? 'Scan complet'
                      : 'Scan différentiel'
                    : 'Aucun scan enregistré'
                }
                sub={disk.lastScan ? `Statut : ${disk.lastScan.status}` : undefined}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <ViewDiskButton diskId={disk.id} />
              <OpenDiskButton
                diskId={disk.id}
                rootPath={disk.rootPath}
                status={disk.status}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <ScanActionsModal
                diskId={disk.id}
                sourceType={disk.sourceType}
                agentStatus={disk.agentDevice?.status}
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
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function DiskTableView({ disks }: { disks: DashboardDisk[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Disque</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Machine</TableHead>
            <TableHead>État agent</TableHead>
            <TableHead>Commande</TableHead>
            <TableHead>Chemin</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead>Entrées</TableHead>
            <TableHead>Dernier scan</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {disks.map((disk) => (
            <TableRow key={disk.id}>
              <TableCell className="font-semibold">
                <Link
                  href={`/disks/${disk.id}`}
                  className="hover:underline"
                  title={disk.displayTitle}
                >
                  {disk.displayLabel}
                </Link>
                {disk.displayLabel !== disk.code ? (
                  <p className="text-xs font-normal text-muted-foreground">
                    {disk.code}
                  </p>
                ) : null}
              </TableCell>

              <TableCell>
                <SourceBadge sourceType={disk.sourceType} />
              </TableCell>

              <TableCell>{getMachineLabel(disk)}</TableCell>

              <TableCell>
                {disk.sourceType === 'AGENT' ? (
                  <AgentStatusBadge status={disk.agentDevice?.status ?? 'OFFLINE'} />
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>

              <TableCell>
                {disk.sourceType === 'AGENT' ? (
                  <AgentCommandInline disk={disk} />
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>

              <TableCell className="font-mono text-xs">{disk.rootPath}</TableCell>

              <TableCell>
                <StatusBadge status={disk.status} />
              </TableCell>

              <TableCell>{disk.entriesCount}</TableCell>

              <TableCell>
                {disk.lastScan ? (
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {disk.lastScan.scanType === 'FULL'
                        ? 'Complet'
                        : 'Différentiel'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {disk.lastScan.status}
                    </p>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">Aucun</span>
                )}
              </TableCell>

              <TableCell>
                <div className="flex justify-end gap-2">
                  <ViewDiskButton diskId={disk.id} />
                  <OpenDiskButton
                    diskId={disk.id}
                    rootPath={disk.rootPath}
                    status={disk.status}
                  />
                  <ScanActionsModal
                    diskId={disk.id}
                    sourceType={disk.sourceType}
                    agentStatus={disk.agentDevice?.status}
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
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ViewDiskButton({ diskId }: { diskId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleView() {
    toast.info('Chargement du disque', {
      description: 'Veuillez patienter un instant...'
    });

    startTransition(() => {
      router.push(`/disks/${diskId}`);
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="h-9 rounded-xl"
      onClick={handleView}
      disabled={isPending}
    >
      {isPending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement...
        </>
      ) : (
        <>
          <Eye className="h-4 w-4" />
          Voir
        </>
      )}
    </Button>
  );
}

function InfoRow({
  label,
  value,
  sub,
  error,
  badge
}: {
  label: string;
  value: string;
  sub?: string;
  error?: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="mt-0.5 truncate text-sm font-medium">{value}</p>
        {sub ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</p>
        ) : null}
        {error ? (
          <p className="mt-1 break-all text-xs text-destructive">{error}</p>
        ) : null}
      </div>

      {badge ? <div className="shrink-0">{badge}</div> : null}
    </div>
  );
}

function AgentCommandInline({ disk }: { disk: DashboardDisk }) {
  const command = disk.latestAgentCommand;

  if (!command) {
    return <span className="text-xs text-muted-foreground">Aucune</span>;
  }

  return (
    <div className="space-y-1">
      <CommandStatusBadge status={command.status} />
      <p className="text-xs text-muted-foreground">
        {command.phase ?? getCommandTypeLabel(command.commandType)}
      </p>
      <p className="text-xs text-muted-foreground">
        {command.progressPercent ?? 0}%
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

function CommandStatusBadge({
  status
}: {
  status: 'PENDING' | 'CLAIMED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELED';
}) {
  const variant =
    status === 'COMPLETED'
      ? 'default'
      : status === 'FAILED'
        ? 'destructive'
        : status === 'CANCELED'
          ? 'secondary'
          : 'outline';

  return (
    <Badge variant={variant}>
      {status === 'PENDING' || status === 'CLAIMED' ? (
        <Clock3 className="h-3.5 w-3.5" />
      ) : status === 'RUNNING' ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : status === 'COMPLETED' ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : (
        <XCircle className="h-3.5 w-3.5" />
      )}
      {commandStatusLabels[status]}
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
      className="shrink-0"
    >
      {statusLabels[status]}
    </Badge>
  );
}

function getMachineLabel(disk: DashboardDisk) {
  if (disk.sourceType === 'SERVER') {
    return 'Serveur';
  }

  return (
    disk.agentDevice?.hostName ||
    disk.sourceLabel ||
    disk.agentDevice?.machineId ||
    'Machine inconnue'
  );
}

function getCommandTypeLabel(
  commandType: 'FULL_SCAN' | 'DIFFERENTIAL_SCAN' | 'REFRESH_AVAILABLE_DISKS'
) {
  if (commandType === 'FULL_SCAN') return 'Scan complet';
  if (commandType === 'DIFFERENTIAL_SCAN') return 'Scan différentiel';
  return 'Actualisation des disques';
}

function StatCard({
  icon,
  title,
  value,
  description
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl border bg-background px-4 py-2.5 shadow-sm"
      title={description}
    >
      <div className="shrink-0 rounded-lg bg-primary/10 p-2 text-primary">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xl font-semibold leading-none">{value}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">{title}</p>
      </div>
    </div>
  );
}

function InfoMiniCard({
  label,
  value,
  icon
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-muted/20 px-3 py-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  );
}