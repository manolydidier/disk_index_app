import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { prisma } from '@/lib/prisma';
import { buildDiskTreeResponse } from '@/lib/tree';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DiskForm } from '@/components/disks/disk-form';
import { DiskTreeView } from '@/components/disks/disk-tree-view';
import { ScanButton } from '@/components/disks/scan-button';
import { DiskRowActions } from '@/components/disks/disk-row-actions';

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

  if (!disk) {
    notFound();
  }

  const tree = buildDiskTreeResponse({
    diskId: disk.code,
    diskName: disk.name,
    rootPath: disk.rootPath,
    status: disk.status,
    lastScan: disk.lastScanAt,
    entries: disk.entries
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="text-2xl">{disk.code} — {disk.name}</CardTitle>
              <CardDescription>{disk.rootPath}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={disk.status === 'ACTIVE' ? 'default' : disk.status === 'DISCONNECTED' ? 'destructive' : 'secondary'}>{disk.status}</Badge>
              <ScanButton diskId={disk.id} scanType="DIFFERENTIAL" />
              <ScanButton diskId={disk.id} scanType="FULL" />
              <DiskRowActions diskId={disk.id} isEnabled={disk.isEnabled} status={disk.status} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <Metric label="Statut" value={disk.status} />
          <Metric label="Dernier scan" value={disk.lastScanAt ? format(disk.lastScanAt, 'dd MMM yyyy HH:mm', { locale: fr }) : 'Jamais'} />
          <Metric label="Entrées indexées" value={String(disk.entries.length)} />
          <Metric label="Activités récentes" value={String(disk.activities.length)} />
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
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

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Historique des scans</CardTitle>
            <CardDescription>Suivi des scans complets et différentiels.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Démarré</TableHead>
                  <TableHead>Résumé</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {disk.scanJobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>{job.scanType}</TableCell>
                    <TableCell>{job.status}</TableCell>
                    <TableCell>{job.startedAt ? format(job.startedAt, 'dd/MM/yyyy HH:mm', { locale: fr }) : '-'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{job.summary ? JSON.stringify(job.summary) : job.errorMessage || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dernières activités</CardTitle>
            <CardDescription>Ajouts, suppressions, modifications ou renommages détectés.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Chemin</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {disk.activities.map((activity) => (
                  <TableRow key={activity.id}>
                    <TableCell>{activity.activityType}</TableCell>
                    <TableCell className="font-mono text-xs">{activity.path}</TableCell>
                    <TableCell>{format(activity.createdAt, 'dd/MM/yyyy HH:mm', { locale: fr })}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}
