import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/require-session';
import { resolveAgentDeviceStatus } from '@/lib/agent/device-status';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const devices = await prisma.agentDevice.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: {
          disks: true
        }
      },
      authTokens: {
        where: { revokedAt: null },
        select: { id: true }
      }
    }
  });

  return NextResponse.json(
    devices.map((device) => ({
      id: device.id,
      machineId: device.machineId,
      hostName: device.hostName,
      userLabel: device.userLabel,
      osName: device.osName,
      appVersion: device.appVersion,
      status: resolveAgentDeviceStatus(device.status, device.lastHeartbeatAt),
      rawStatus: device.status,
      lastSeenAt: device.lastSeenAt,
      lastHeartbeatAt: device.lastHeartbeatAt,
      createdAt: device.createdAt,
      diskCount: device._count.disks,
      activeTokenCount: device.authTokens.length
    }))
  );
}
