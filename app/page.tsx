import { prisma } from '@/lib/prisma';
import { getDiskDisplayLabel, getDiskDisplayTitle } from '@/lib/disk-label';
import { DashboardViewSwitcher } from '@/components/dashboard/dashboard-view-switcher';

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

  const preparedDisks = disks.map((disk) => {
    const lastScan = disk.scanJobs[0] ?? null;

    return {
      id: disk.id,
      code: disk.code,
      name: disk.name,
      rootPath: disk.rootPath,
      status: disk.status,
      isEnabled: disk.isEnabled,
      entriesCount: disk._count.entries,
      activitiesCount: disk._count.activities,
      lastScan: lastScan
        ? {
            scanType: lastScan.scanType,
            status: lastScan.status
          }
        : null,
      displayLabel: getDiskDisplayLabel({
        code: disk.code,
        name: disk.name,
        rootPath: disk.rootPath,
        status: disk.status
      }),
      displayTitle: getDiskDisplayTitle({
        code: disk.code,
        name: disk.name,
        rootPath: disk.rootPath,
        status: disk.status
      })
    };
  });

  return (
    <DashboardViewSwitcher
      disks={preparedDisks}
      stats={{
        diskCount: stats[0],
        fileEntryCount: stats[1],
        activityCount: stats[2]
      }}
    />
  );
}