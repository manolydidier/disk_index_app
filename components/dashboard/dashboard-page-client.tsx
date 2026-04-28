import Link from 'next/link';
import { DiskStatus } from '@prisma/client';
import {
  HardDrive,
  Database,
  BellDot,
  Search,
  FolderOpen,
  Activity
} from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getDiskDisplayLabel, getDiskDisplayTitle } from '@/lib/disk-label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { DiskForm } from '@/components/disks/disk-form';
import { ScanButton } from '@/components/disks/scan-button';
import { DiskRowActions } from '@/components/disks/disk-row-actions';
import { OpenDiskButton } from '@/components/disks/open-disk-button';

const statusLabels: Record<DiskStatus, string> = {
  ACTIVE: 'Actif',
  INACTIVE: 'Inactif',
  DISCONNECTED: 'Non connecté'
};

export default async function DashboardPage() {
  const [disks, stats] = await Promise.all([
    prisma.disk.findMany({
      include: {
        _count: {
          select: {
            entries: { where: { deletedAt: null } },
            activities: { where: { acknowledgedAt: null } }
          }
        },
        scanJobs: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { code: 'asc' }
    }),
    prisma.$transaction([
      prisma.disk.count(),
      prisma.fileEntry.count({ where: { deletedAt: null } }),
      prisma.diskActivity.count({ where: { acknowledgedAt: null } })
    ])
  ]);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          icon={<HardDrive className="h-5 w-5" />}
          title="Disques gérés"
          value={String(stats[0])}
          description="Disques enregistrés dans l’application"
        />
        <StatCard
          icon={<Database className="h-5 w-5" />}
          title="Entrées indexées"
          value={stats[1].toLocaleString('fr-FR')}
          description="Fichiers et dossiers indexés"
        />
        <StatCard
          icon={<BellDot className="h-5 w-5" />}
          title="Alertes en attente"
          value={String(stats[2])}
          description="Activités non acquittées"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <DiskForm />

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Disques enregistrés</CardTitle>
                <CardDescription>
                  Vue plus simple avec actions directes et accès rapide.
                </CardDescription>
              </div>

              <Button asChild variant="outline" className="rounded-full">
                <Link href="/search">
                  <Search className="h-4 w-4" />
                  Ouvrir la recherche
                </Link>
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            {disks.length === 0 ? (
              <div className="rounded-2xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
                Aucun disque enregistré.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {disks.map((disk) => {
                  const diskLabel = getDiskDisplayLabel({
                    code: disk.code,
                    name: disk.name,
                    rootPath: disk.rootPath,
                    status: disk.status
                  });

                  const diskTitle = getDiskDisplayTitle({
                    code: disk.code,
                    name: disk.name,
                    rootPath: disk.rootPath,
                    status: disk.status
                  });

                  const lastScan = disk.scanJobs[0] ?? null;

                  return (
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
                              title={diskTitle}
                            >
                              {diskLabel}
                            </Link>

                            <p className="text-sm text-muted-foreground">
                              {disk.name}
                            </p>
                          </div>

                          <Badge
                            variant={
                              disk.status === 'ACTIVE'
                                ? 'default'
                                : disk.status === 'DISCONNECTED'
                                  ? 'destructive'
                                  : 'secondary'
                            }
                            className="shrink-0"
                          >
                            {statusLabels[disk.status]}
                          </Badge>
                        </div>

                        <div className="rounded-xl bg-muted/40 px-3 py-2">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            Chemin racine
                          </p>
                          <p className="mt-1 break-all font-mono text-xs">
                            {disk.rootPath}
                          </p>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <InfoMiniCard
                            label="Entrées"
                            value={String(disk._count.entries)}
                            icon={<Database className="h-4 w-4" />}
                          />
                          <InfoMiniCard
                            label="Alertes"
                            value={String(disk._count.activities)}
                            icon={<BellDot className="h-4 w-4" />}
                          />
                        </div>

                        <div className="rounded-xl border bg-background px-3 py-3">
                          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            <Activity className="h-3.5 w-3.5" />
                            Dernier scan
                          </div>

                          <div className="mt-2 text-sm">
                            {lastScan ? (
                              <div className="space-y-1">
                                <p className="font-medium">
                                  {lastScan.scanType === 'FULL'
                                    ? 'Scan complet'
                                    : 'Scan différentiel'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Statut : {lastScan.status}
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
                          <Button
                            asChild
                            variant="outline"
                            className="h-9 rounded-xl"
                          >
                            <Link href={`/disks/${disk.id}`}>
                              <FolderOpen className="h-4 w-4" />
                              Détails
                            </Link>
                          </Button>

                          <OpenDiskButton
                            diskId={disk.id}
                            rootPath={disk.rootPath}
                            status={disk.status}
                          />
                        </div>

                        <div className="grid gap-2">
                          <ScanButton diskId={disk.id} scanType="DIFFERENTIAL" />
                          <ScanButton diskId={disk.id} scanType="FULL" />
                        </div>

                        <div className="pt-1">
                          <DiskRowActions
                            diskId={disk.id}
                            isEnabled={disk.isEnabled}
                            status={disk.status}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
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