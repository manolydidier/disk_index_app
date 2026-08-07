import { NextResponse } from 'next/server';
import { DiskSourceType, DiskStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { generateNextDiskCode } from '@/lib/disk-code';
import { requireSession } from '@/lib/require-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json().catch(() => ({}));

    const agentDeviceId = String(body.agentDeviceId ?? '').trim();
    const remoteDiskKey = String(body.remoteDiskKey ?? '').trim();

    if (!agentDeviceId || !remoteDiskKey) {
      return NextResponse.json(
        { error: 'agentDeviceId et remoteDiskKey sont requis.' },
        { status: 400 }
      );
    }

    const availableDisk = await prisma.agentAvailableDisk.findUnique({
      where: {
        agentDeviceId_remoteDiskKey: {
          agentDeviceId,
          remoteDiskKey
        }
      },
      include: {
        agentDevice: true
      }
    });

    if (!availableDisk) {
      return NextResponse.json(
        { error: 'Disque agent introuvable.' },
        { status: 404 }
      );
    }

    if (availableDisk.agentDevice.status !== 'ONLINE') {
      return NextResponse.json(
        { error: 'L’agent associé à ce disque est hors ligne.' },
        { status: 400 }
      );
    }

    if (!availableDisk.isConnected) {
      return NextResponse.json(
        { error: 'Ce disque n’est pas actuellement connecté.' },
        { status: 400 }
      );
    }

    const existing = await prisma.disk.findFirst({
      where: {
        agentDeviceId,
        remoteDiskKey
      }
    });

    if (existing) {
      const refreshed = await prisma.disk.update({
        where: { id: existing.id },
        data: {
          name: availableDisk.displayName,
          rootPath: availableDisk.rootPath,
          status: availableDisk.isConnected
            ? DiskStatus.ACTIVE
            : DiskStatus.DISCONNECTED,
          sourceType: DiskSourceType.AGENT,
          sourceLabel:
            availableDisk.agentDevice.userLabel ||
            availableDisk.agentDevice.hostName,
          lastSeenAt: availableDisk.lastSeenAt
        }
      });

      return NextResponse.json({
        success: true,
        diskId: refreshed.id,
        code: refreshed.code,
        alreadyExists: true
      });
    }

    const disk = await prisma.disk.create({
      data: {
        code: await generateNextDiskCode(),
        name: availableDisk.displayName,
        rootPath: availableDisk.rootPath,
        description: `Disque ajouté depuis ${
          availableDisk.agentDevice.userLabel ||
          availableDisk.agentDevice.hostName
        }`,
        status: availableDisk.isConnected
          ? DiskStatus.ACTIVE
          : DiskStatus.DISCONNECTED,
        sourceType: DiskSourceType.AGENT,
        agentDeviceId: availableDisk.agentDeviceId,
        sourceLabel:
          availableDisk.agentDevice.userLabel ||
          availableDisk.agentDevice.hostName,
        remoteDiskKey: availableDisk.remoteDiskKey,
        lastSeenAt: availableDisk.lastSeenAt
      }
    });

    return NextResponse.json({
      success: true,
      diskId: disk.id,
      code: disk.code,
      alreadyExists: false
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Impossible d'ajouter le disque agent."
      },
      { status: 500 }
    );
  }
}