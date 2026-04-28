'use client';

import Link from 'next/link';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { DiskStatus } from '@prisma/client';
import {
  Activity,
  BellDot,
  Database,
  Eye,
  HardDrive,
  LayoutGrid,
  List,
  Loader2,
  Search,
  X
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
  status: DiskStatus;
  isEnabled: boolean;
  entriesCount: number;
  activitiesCount: number;
  lastScan: {
    scanType: string;
    status: string;
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

export function DashboardViewSwitcher({
  disks,
  stats
}: DashboardViewSwitcherProps) {
  const pathname = usePathname();
  const progressTimersRef = useRef<number[]>([]);

  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [searchTerm, setSearchTerm] = useState('');
  const [routeLoadingDiskId, setRouteLoadingDiskId] = useState<string | null>(
    null
  );
  const [routeProgress, setRouteProgress] = useState(0);
  const [showRouteProgress, setShowRouteProgress] = useState(false);

  function clearProgressTimers() {
    progressTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    progressTimersRef.current = [];
  }

  function startRouteProgress(diskId: string) {
    clearProgressTimers();

    setRouteLoadingDiskId(diskId);
    setShowRouteProgress(true);
    setRouteProgress(12);

    progressTimersRef.current.push(
      window.setTimeout(() => setRouteProgress(38), 80)
    );

    progressTimersRef.current.push(
      window.setTimeout(() => setRouteProgress(64), 180)
    );

    progressTimersRef.current.push(
      window.setTimeout(() => setRouteProgress(82), 340)
    );

    progressTimersRef.current.push(
      window.setTimeout(() => setRouteProgress(92), 700)
    );
  }

  function finishRouteProgress() {
    clearProgressTimers();

    setRouteProgress(100);

    progressTimersRef.current.push(
      window.setTimeout(() => {
        setShowRouteProgress(false);
        setRouteProgress(0);
        setRouteLoadingDiskId(null);
      }, 220)
    );
  }

  useEffect(() => {
    return () => {
      clearProgressTimers();
    };
  }, []);

  useEffect(() => {
    if (showRouteProgress) {
      finishRouteProgress();
    }
  }, [pathname]);

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
        statusLabels[disk.status]
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [disks, searchTerm]);

  const hasDisks = useMemo(() => disks.length > 0, [disks]);
  const hasFilteredDisks = useMemo(
    () => filteredDisks.length > 0,
    [filteredDisks]
  );

  return (
    <div className="space-y-6">
      {showRouteProgress ? (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-[120] h-1 bg-transparent">
          <div
            className="h-full bg-primary transition-all duration-300 ease-out"
            style={{ width: `${routeProgress}%` }}
          />
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          icon={<HardDrive className="h-5 w-5" />}
          title="Disques gérés"
          value={String(stats.diskCount)}
          description="Disques enregistrés dans l’application"
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
                <CardTitle>Disques enregistrés</CardTitle>
                <CardDescription>
                  Alterne entre un affichage en cartes ou en tableau.
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

                <Button asChild variant="outline" className="rounded-full">
                  <Link href="/search">
                    <Search className="h-4 w-4" />
                    Recherche
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
                  placeholder="Rechercher un disque par code, nom, chemin ou statut..."
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

              <p className="text-sm text-muted-foreground">
                {searchTerm.trim()
                  ? `${filteredDisks.length} disque(s) trouvé(s)`
                  : `${disks.length} disque(s) affiché(s)`}
              </p>
            </div>
          </CardHeader>

          <CardContent>
            {!hasDisks ? (
              <div className="rounded-2xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
                Aucun disque enregistré.
              </div>
            ) : !hasFilteredDisks ? (
              <div className="rounded-2xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
                Aucun disque ne correspond à ta recherche.
              </div>
            ) : viewMode === 'cards' ? (
              <DiskCardsView
                disks={filteredDisks}
                routeLoadingDiskId={routeLoadingDiskId}
                onViewStart={startRouteProgress}
              />
            ) : (
              <DiskTableView
                disks={filteredDisks}
                routeLoadingDiskId={routeLoadingDiskId}
                onViewStart={startRouteProgress}
              />
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function DiskCardsView({
  disks,
  routeLoadingDiskId,
  onViewStart
}: {
  disks: DashboardDisk[];
  routeLoadingDiskId: string | null;
  onViewStart: (diskId: string) => void;
}) {
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

            <div className="rounded-xl border bg-background px-3 py-3">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Activity className="h-3.5 w-3.5" />
                Dernier scan
              </div>

              <div className="mt-2 text-sm">
                {disk.lastScan ? (
                  <div className="space-y-1">
                    <p className="font-medium">
                      {disk.lastScan.scanType === 'FULL'
                        ? 'Scan complet'
                        : 'Scan différentiel'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Statut : {disk.lastScan.status}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Aucun scan enregistré
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <ViewDiskButton
                diskId={disk.id}
                isActive={routeLoadingDiskId === disk.id}
                onNavigateStart={onViewStart}
              />

              <OpenDiskButton
                diskId={disk.id}
                rootPath={disk.rootPath}
                status={disk.status}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <ScanActionsModal diskId={disk.id} />
              <DiskRowActions
                diskId={disk.id}
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

function DiskTableView({
  disks,
  routeLoadingDiskId,
  onViewStart
}: {
  disks: DashboardDisk[];
  routeLoadingDiskId: string | null;
  onViewStart: (diskId: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Disque</TableHead>
            <TableHead>Nom</TableHead>
            <TableHead>Chemin racine</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead>Entrées</TableHead>
            <TableHead>Alertes</TableHead>
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
              </TableCell>

              <TableCell>{disk.name}</TableCell>

              <TableCell className="font-mono text-xs">
                {disk.rootPath}
              </TableCell>

              <TableCell>
                <StatusBadge status={disk.status} />
              </TableCell>

              <TableCell>{disk.entriesCount}</TableCell>
              <TableCell>{disk.activitiesCount}</TableCell>

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
                  <ViewDiskButton
                    diskId={disk.id}
                    isActive={routeLoadingDiskId === disk.id}
                    onNavigateStart={onViewStart}
                  />

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
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ViewDiskButton({
  diskId,
  isActive,
  onNavigateStart
}: {
  diskId: string;
  isActive: boolean;
  onNavigateStart: (diskId: string) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleView() {
    onNavigateStart(diskId);

    toast.info('Chargement du disque', {
      description: 'Veuillez patienter un instant...'
    });

    startTransition(() => {
      router.push(`/disks/${diskId}`);
    });
  }

  const loading = isPending || isActive;

  return (
    <Button
      type="button"
      variant="outline"
      className="h-9 rounded-xl"
      onClick={handleView}
      disabled={loading}
    >
      {loading ? (
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
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardDescription>{title}</CardDescription>
          <div className="rounded-xl bg-primary/10 p-2 text-primary">
            {icon}
          </div>
        </div>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>

      <CardContent>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
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