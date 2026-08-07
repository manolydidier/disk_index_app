import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveAgentDeviceStatus } from '@/lib/agent/device-status';
import { requireSession } from '@/lib/require-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  try {
    const candidates = await prisma.agentAvailableDisk.findMany({
      where: {
        isConnected: true,
        agentDevice: {
          status: 'ONLINE'
        }
      },
      include: {
        agentDevice: {
          select: {
            id: true,
            hostName: true,
            machineId: true,
            userLabel: true,
            status: true,
            lastHeartbeatAt: true
          }
        }
      },
      orderBy: [
        { agentDeviceId: 'asc' },
        { rootPath: 'asc' }
      ]
    });

    // The DB's ONLINE status only ever gets set by a heartbeat, never
    // cleared — an agent whose process died months ago still reads
    // ONLINE. Re-check staleness here so this list doesn't offer disks
    // from an agent that will never actually pick up a scan command.
    const disks = candidates.filter(
      (disk) =>
        resolveAgentDeviceStatus(
          disk.agentDevice.status,
          disk.agentDevice.lastHeartbeatAt
        ) === 'ONLINE'
    );

    return NextResponse.json(disks);
  } catch (error) {
    console.error('[AGENT DISKS AVAILABLE] ERREUR:', error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Impossible de charger les disques agent.'
      },
      { status: 500 }
    );
  }
}