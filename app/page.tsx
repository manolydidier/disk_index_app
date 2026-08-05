import { prisma } from '@/lib/prisma';
import { getDiskDisplayLabel, getDiskDisplayTitle } from '@/lib/disk-label';
import { resolveAgentDeviceStatus } from '@/lib/agent/device-status';
import { DashboardViewSwitcher } from '@/components/dashboard/dashboard-view-switcher';

// Without this, Next.js prerenders this page as static at build time since
// its Prisma calls aren't detected as a dynamic API — every disk toggle,
// scan, or status change would be invisible until the next `next build`.
export const dynamic = 'force-dynamic';

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
        },
        agentDevice: {
          select: {
            id: true,
            machineId: true,
            hostName: true,
            userLabel: true,
            status: true,
            lastHeartbeatAt: true,
            lastSeenAt: true
          }
        },
        agentCommands: {
          orderBy: { updatedAt: 'desc' },
          take: 1,
          select: {
            id: true,
            commandType: true,
            status: true,
            progressPercent: true,
            phase: true,
            currentPath: true,
            errorMessage: true,
            updatedAt: true
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

  const preparedDisks = disks.map((disk) => {
    const lastScan = disk.scanJobs[0] ?? null;
    const latestAgentCommand = disk.agentCommands[0] ?? null;

    return {
      id: disk.id,
      code: disk.code,
      name: disk.name,
      rootPath: disk.rootPath,
      description: disk.description,
      status: disk.status,
      isEnabled: disk.isEnabled,
      sourceType: disk.sourceType,
      sourceLabel: disk.sourceLabel,
      remoteDiskKey: disk.remoteDiskKey,
      lastSeenAt: disk.lastSeenAt?.toISOString() ?? null,
      entriesCount: disk._count.entries,
      activitiesCount: disk._count.activities,
      lastScan: lastScan
        ? {
            scanType: lastScan.scanType,
            status: lastScan.status
          }
        : null,
      latestAgentCommand: latestAgentCommand
        ? {
            id: latestAgentCommand.id,
            commandType: latestAgentCommand.commandType,
            status: latestAgentCommand.status,
            progressPercent: latestAgentCommand.progressPercent,
            phase: latestAgentCommand.phase,
            currentPath: latestAgentCommand.currentPath,
            errorMessage: latestAgentCommand.errorMessage,
            updatedAt: latestAgentCommand.updatedAt.toISOString()
          }
        : null,
      agentDevice: disk.agentDevice
        ? {
            id: disk.agentDevice.id,
            machineId: disk.agentDevice.machineId,
            hostName: disk.agentDevice.hostName,
            userLabel: disk.agentDevice.userLabel,
            status: resolveAgentDeviceStatus(
              disk.agentDevice.status,
              disk.agentDevice.lastHeartbeatAt
            ),
            lastHeartbeatAt: disk.agentDevice.lastHeartbeatAt?.toISOString() ?? null,
            lastSeenAt: disk.agentDevice.lastSeenAt?.toISOString() ?? null
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