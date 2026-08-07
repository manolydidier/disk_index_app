import { NextResponse } from 'next/server';
import { ActivityType, AgentCommandStatus, AgentCommandType, DiskSourceType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/require-session';
import { canAccessDisk, getAccessibleDiskIds } from '@/lib/disk-access';
import { resolveAgentDeviceStatus } from '@/lib/agent/device-status';
import { getFsPromises } from '@/lib/server/node-runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isIgnorableFsError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const code = 'code' in error ? String((error as { code?: unknown }).code) : '';
  return code === 'ENOENT';
}

export async function POST(
  _: Request,
  context: { params: Promise<{ entryId: string }> }
) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { entryId } = await context.params;

  const entry = await prisma.fileEntry.findUnique({
    where: { id: entryId },
    include: { disk: { include: { agentDevice: true } } }
  });

  if (!entry || entry.deletedAt) {
    return NextResponse.json({ error: 'Fichier introuvable.' }, { status: 404 });
  }

  if (entry.entryType !== 'FILE') {
    return NextResponse.json(
      { error: 'Seuls les fichiers peuvent être supprimés depuis cette action.' },
      { status: 400 }
    );
  }

  const accessibleDiskIds = await getAccessibleDiskIds(session.user);
  if (!canAccessDisk(accessibleDiskIds, entry.diskId)) {
    return NextResponse.json({ error: 'Fichier introuvable.' }, { status: 404 });
  }

  if (entry.disk.sourceType === DiskSourceType.SERVER) {
    const { unlink } = getFsPromises();

    try {
      await unlink(entry.fullPath);
    } catch (error) {
      if (!isIgnorableFsError(error)) {
        return NextResponse.json(
          {
            error:
              error instanceof Error
                ? `Suppression impossible : ${error.message}`
                : 'Suppression impossible.'
          },
          { status: 500 }
        );
      }
    }

    await prisma.$transaction([
      prisma.fileEntry.update({
        where: { id: entry.id },
        data: { deletedAt: new Date() }
      }),
      prisma.diskActivity.create({
        data: {
          diskId: entry.diskId,
          activityType: ActivityType.DELETED,
          path: entry.fullPath,
          details: { name: entry.name, source: 'manual-delete' }
        }
      })
    ]);

    return NextResponse.json({ success: true, mode: 'immediate' });
  }

  // AGENT-sourced disk: the file lives on a remote machine, so deletion has
  // to go through the same command queue as scans — it can't happen from
  // this request.
  if (!entry.disk.agentDeviceId || !entry.disk.remoteDiskKey) {
    return NextResponse.json(
      { error: "Ce disque n'est géré par aucun agent." },
      { status: 400 }
    );
  }

  const effectiveStatus = entry.disk.agentDevice
    ? resolveAgentDeviceStatus(
        entry.disk.agentDevice.status,
        entry.disk.agentDevice.lastHeartbeatAt
      )
    : 'OFFLINE';

  if (effectiveStatus !== 'ONLINE') {
    return NextResponse.json(
      {
        error:
          "Agent hors ligne. Lance l'agent sur la machine qui héberge ce disque, puis réessaie."
      },
      { status: 400 }
    );
  }

  const command = await prisma.agentCommand.create({
    data: {
      agentDeviceId: entry.disk.agentDeviceId,
      diskId: entry.diskId,
      commandType: AgentCommandType.DELETE_FILE,
      status: AgentCommandStatus.PENDING,
      phase: 'EN_ATTENTE',
      progressPercent: 0,
      payload: {
        fileEntryId: entry.id,
        remoteDiskKey: entry.disk.remoteDiskKey,
        fullPath: entry.fullPath,
        relativePath: entry.relativePath
      }
    }
  });

  return NextResponse.json({
    success: true,
    mode: 'queued',
    commandId: command.id
  });
}
