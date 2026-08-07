import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAgentRequest } from '@/lib/agent/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AvailableDiskInput = {
  remoteDiskKey: string;
  rootPath: string;
  displayName: string;
  driveType?: string | null;
  isRemovable?: boolean;
  isConnected?: boolean;
  totalBytes?: number | null;
  freeBytes?: number | null;
};

function normalizeDiskInput(disk: AvailableDiskInput) {
  return {
    remoteDiskKey: String(disk.remoteDiskKey ?? '').trim(),
    rootPath: String(disk.rootPath ?? '').trim(),
    displayName: String(disk.displayName ?? '').trim(),
    driveType: String(disk.driveType ?? '').trim() || null,
    isRemovable: Boolean(disk.isRemovable),
    isConnected: disk.isConnected !== false,
    totalBytes:
      typeof disk.totalBytes === 'number' && Number.isFinite(disk.totalBytes)
        ? BigInt(Math.trunc(disk.totalBytes))
        : null,
    freeBytes:
      typeof disk.freeBytes === 'number' && Number.isFinite(disk.freeBytes)
        ? BigInt(Math.trunc(disk.freeBytes))
        : null
  };
}

export async function POST(request: Request) {
  try {
    const agent = await authenticateAgentRequest(request);
    const body = await request.json().catch(() => ({}));

    if (!Array.isArray(body.disks)) {
      return NextResponse.json(
        { error: 'Le champ disks doit être un tableau.' },
        { status: 400 }
      );
    }

    const rawDisks = body.disks as AvailableDiskInput[];

    const normalized = rawDisks
      .map(normalizeDiskInput)
      .filter(
        (disk) => disk.remoteDiskKey && disk.rootPath && disk.displayName
      );

    const dedupedMap = new Map<string, ReturnType<typeof normalizeDiskInput>>();

    for (const disk of normalized) {
      dedupedMap.set(disk.remoteDiskKey, disk);
    }

    const cleaned = Array.from(dedupedMap.values());
    const seenKeys = new Set(cleaned.map((disk) => disk.remoteDiskKey));

    console.log('[AGENT DISKS SYNC] Réception inventaire:', {
      agentId: agent.id,
      machineId: agent.machineId,
      hostName: agent.hostName,
      received: rawDisks.length,
      valid: cleaned.length
    });

    await prisma.$transaction(async (tx) => {
      for (const disk of cleaned) {
        await tx.agentAvailableDisk.upsert({
          where: {
            agentDeviceId_remoteDiskKey: {
              agentDeviceId: agent.id,
              remoteDiskKey: disk.remoteDiskKey
            }
          },
          update: {
            rootPath: disk.rootPath,
            displayName: disk.displayName,
            driveType: disk.driveType,
            isRemovable: disk.isRemovable,
            isConnected: disk.isConnected,
            lastSeenAt: new Date()
          },
          create: {
            agentDeviceId: agent.id,
            remoteDiskKey: disk.remoteDiskKey,
            rootPath: disk.rootPath,
            displayName: disk.displayName,
            driveType: disk.driveType,
            isRemovable: disk.isRemovable,
            isConnected: disk.isConnected,
            lastSeenAt: new Date()
          }
        });

        if (disk.totalBytes !== null || disk.freeBytes !== null) {
          await tx.disk.updateMany({
            where: { agentDeviceId: agent.id, remoteDiskKey: disk.remoteDiskKey },
            data: {
              totalBytes: disk.totalBytes,
              freeBytes: disk.freeBytes,
              spaceCheckedAt: new Date()
            }
          });
        }
      }

      const existing = await tx.agentAvailableDisk.findMany({
        where: { agentDeviceId: agent.id },
        select: { id: true, remoteDiskKey: true }
      });

      const missingIds = existing
        .filter((disk) => !seenKeys.has(disk.remoteDiskKey))
        .map((disk) => disk.id);

      if (missingIds.length > 0) {
        await tx.agentAvailableDisk.updateMany({
          where: {
            id: { in: missingIds }
          },
          data: {
            isConnected: false
          }
        });
      }
    });

    return NextResponse.json({
      success: true,
      count: cleaned.length
    });
  } catch (error) {
    console.error('[AGENT DISKS SYNC] ERREUR:', error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Impossible de synchroniser les disques disponibles.'
      },
      { status: 500 }
    );
  }
}