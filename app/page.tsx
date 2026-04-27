import Link from 'next/link';
import { DiskStatus } from '@prisma/client';
import { HardDrive, Database, BellDot, Search } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getDiskDisplayLabel, getDiskDisplayTitle } from '@/lib/disk-label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
    <div className="space-y-8">
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
          description="Fichiers et dossiers actuellement disponibles"
        />
        <StatCard
          icon={<BellDot className="h-5 w-5" />}
          title="Alertes en attente"
          value={String(stats[2])}
          description="Activités non encore acquittées"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <DiskForm />

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Inventaire des disques</CardTitle>
                <CardDescription>
                  Ajout, rescan, désactivation, ouverture du disque et accès direct
                  au détail.
                </CardDescription>
              </div>

              <Button asChild variant="outline">
                <Link href="/search">
                  <Search className="h-4 w-4" />
                  Ouvrir la recherche
                </Link>
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Disque</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Chemin racine</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Index</TableHead>
                  <TableHead>Alertes</TableHead>
                  <TableHead>Accès</TableHead>
                  <TableHead>Scans</TableHead>
                  <TableHead>Gestion</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {disks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">
                      Aucun disque enregistré.
                    </TableCell>
                  </TableRow>
                ) : (
                  disks.map((disk) => {
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

                    return (
                      <TableRow key={disk.id}>
                        <TableCell className="font-semibold">
                          <Link
                            href={`/disks/${disk.id}`}
                            className="hover:underline"
                            title={diskTitle}
                          >
                            {diskLabel}
                          </Link>
                        </TableCell>

                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{disk.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {disk.code}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell className="font-mono text-xs">
                          {disk.rootPath}
                        </TableCell>

                        <TableCell>
                          <Badge
                            variant={
                              disk.status === 'ACTIVE'
                                ? 'default'
                                : disk.status === 'DISCONNECTED'
                                  ? 'destructive'
                                  : 'secondary'
                            }
                          >
                            {statusLabels[disk.status]}
                          </Badge>
                        </TableCell>

                        <TableCell>{disk._count.entries}</TableCell>
                        <TableCell>{disk._count.activities}</TableCell>

                        <TableCell>
                          <OpenDiskButton
                            diskId={disk.id}
                            rootPath={disk.rootPath}
                            status={disk.status}
                          />
                        </TableCell>

                        <TableCell>
                          <div className="flex flex-col gap-2">
                            <ScanButton diskId={disk.id} scanType="DIFFERENTIAL" />
                            <ScanButton diskId={disk.id} scanType="FULL" />
                          </div>
                        </TableCell>

                        <TableCell>
                          <DiskRowActions
                            diskId={disk.id}
                            isEnabled={disk.isEnabled}
                            status={disk.status}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
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
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardDescription>{title}</CardDescription>
          <div className="rounded-lg bg-primary/10 p-2 text-primary">{icon}</div>
        </div>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>

      <CardContent>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}