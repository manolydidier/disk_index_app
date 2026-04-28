import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const disks = await prisma.agentAvailableDisk.findMany({
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