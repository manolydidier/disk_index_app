'use client';

import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Activity, Clock3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';

type ScanJobItem = {
  id: string;
  scanType: string;
  status: string;
  startedAt: string | null;
  currentPath: string | null;
  phase: string | null;
  summaryText: string;
};

type ActivityItem = {
  id: string;
  activityType: string;
  path: string;
  createdAt: string;
};

type DiskDetailModalsProps = {
  scans: ScanJobItem[];
  activities: ActivityItem[];
};

const scanTypeLabels: Record<string, string> = {
  DIFFERENTIAL: 'Différentiel',
  FULL: 'Complet'
};

const activityTypeLabels: Record<string, string> = {
  ADDED: 'Ajout',
  DELETED: 'Suppression',
  MODIFIED: 'Modification',
  RENAMED: 'Renommage'
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

export function DiskDetailModals({
  scans,
  activities
}: DiskDetailModalsProps) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Dialog>
        <DialogTrigger asChild>
          <Button type="button" variant="outline" className="h-10 rounded-xl">
            <Clock3 className="h-4 w-4" />
            Historique des scans
          </Button>
        </DialogTrigger>

        <DialogContent className="max-h-[85vh] max-w-5xl overflow-hidden rounded-2xl p-0">
          <div className="border-b px-6 py-5">
            <DialogHeader>
              <DialogTitle>Historique des scans</DialogTitle>
              <DialogDescription>
                Scans complets et différentiels récents du disque.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="max-h-[70vh] overflow-auto px-6 py-4">
            {scans.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Aucun scan enregistré.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/20 hover:bg-muted/20">
                      <TableHead className="pl-5">Type</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Démarré</TableHead>
                      <TableHead>Chemin / phase</TableHead>
                      <TableHead className="pr-5">Résumé</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {scans.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell className="pl-5 font-medium">
                          {scanTypeLabels[job.scanType] ?? job.scanType}
                        </TableCell>

                        <TableCell>
                          <span
                            className={`text-xs font-semibold ${
                              scanStatusColors[job.status] ?? ''
                            }`}
                          >
                            {job.status}
                          </span>
                        </TableCell>

                        <TableCell className="text-xs text-muted-foreground">
                          {job.startedAt
                            ? format(new Date(job.startedAt), 'dd/MM/yyyy HH:mm', {
                                locale: fr
                              })
                            : '—'}
                        </TableCell>

                        <TableCell className="max-w-[220px]">
                          <span
                            className="block truncate text-[11px] text-muted-foreground"
                            title={job.currentPath ?? job.phase ?? ''}
                          >
                            {job.currentPath ?? job.phase ?? '—'}
                          </span>
                        </TableCell>

                        <TableCell className="pr-5 max-w-[260px]">
                          <span
                            className="block truncate text-[11px] text-muted-foreground"
                            title={job.summaryText}
                          >
                            {job.summaryText}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog>
        <DialogTrigger asChild>
          <Button type="button" variant="outline" className="h-10 rounded-xl">
            <Activity className="h-4 w-4" />
            Dernières activités
          </Button>
        </DialogTrigger>

        <DialogContent className="max-h-[85vh] max-w-5xl overflow-hidden rounded-2xl p-0">
          <div className="border-b px-6 py-5">
            <DialogHeader>
              <DialogTitle>Dernières activités</DialogTitle>
              <DialogDescription>
                Ajouts, suppressions, modifications et renommages détectés.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="max-h-[70vh] overflow-auto px-6 py-4">
            {activities.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Aucune activité détectée.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/20 hover:bg-muted/20">
                      <TableHead className="pl-5">Type</TableHead>
                      <TableHead>Chemin</TableHead>
                      <TableHead className="pr-5">Date</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {activities.map((activity) => (
                      <TableRow key={activity.id}>
                        <TableCell className="pl-5">
                          <span
                            className={`text-xs font-semibold ${
                              activityTypeColors[activity.activityType] ?? ''
                            }`}
                          >
                            {activityTypeLabels[activity.activityType] ??
                              activity.activityType}
                          </span>
                        </TableCell>

                        <TableCell className="max-w-[320px]">
                          <span
                            className="block truncate font-mono text-[11px] text-muted-foreground"
                            title={activity.path}
                          >
                            {activity.path}
                          </span>
                        </TableCell>

                        <TableCell className="pr-5 text-xs text-muted-foreground">
                          {format(new Date(activity.createdAt), 'dd/MM/yyyy HH:mm', {
                            locale: fr
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}