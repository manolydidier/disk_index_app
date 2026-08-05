import { NextResponse } from 'next/server';
import {
  AgentCommandStatus,
  AgentCommandType,
  DiskSourceType
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { resolveAgentDeviceStatus } from '@/lib/agent/device-status';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    const diskId = String(body.diskId ?? '').trim();
    const rawScanType = String(body.scanType ?? 'DIFFERENTIAL')
      .trim()
      .toUpperCase();

    if (!diskId) {
      return NextResponse.json(
        { error: 'diskId requis.' },
        { status: 400 }
      );
    }

    if (!['FULL', 'DIFFERENTIAL'].includes(rawScanType)) {
      return NextResponse.json(
        { error: 'scanType invalide. Valeurs attendues : FULL ou DIFFERENTIAL.' },
        { status: 400 }
      );
    }

    const disk = await prisma.disk.findUnique({
      where: { id: diskId },
      include: {
        agentDevice: true
      }
    });

    if (!disk) {
      return NextResponse.json(
        { error: 'Disque introuvable.' },
        { status: 404 }
      );
    }

    if (disk.sourceType !== DiskSourceType.AGENT || !disk.agentDeviceId) {
      return NextResponse.json(
        { error: 'Ce disque n’est pas géré par un agent.' },
        { status: 400 }
      );
    }

    if (!disk.remoteDiskKey) {
      return NextResponse.json(
        { error: 'Le disque agent ne possède pas de remoteDiskKey.' },
        { status: 400 }
      );
    }

    const effectiveStatus = disk.agentDevice
      ? resolveAgentDeviceStatus(disk.agentDevice.status, disk.agentDevice.lastHeartbeatAt)
      : 'OFFLINE';

    if (effectiveStatus !== 'ONLINE') {
      return NextResponse.json(
        {
          error:
            "Agent hors ligne. Lance l'agent (npm run agent:start) sur la machine qui héberge ce disque, puis réessaie."
        },
        { status: 400 }
      );
    }

    const existing = await prisma.agentCommand.findFirst({
      where: {
        diskId,
        agentDeviceId: disk.agentDeviceId,
        status: {
          in: [
            AgentCommandStatus.PENDING,
            AgentCommandStatus.CLAIMED,
            AgentCommandStatus.RUNNING
          ]
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        alreadyQueued: true,
        commandId: existing.id
      });
    }

    const command = await prisma.agentCommand.create({
      data: {
        agentDeviceId: disk.agentDeviceId,
        diskId: disk.id,
        commandType:
          rawScanType === 'FULL'
            ? AgentCommandType.FULL_SCAN
            : AgentCommandType.DIFFERENTIAL_SCAN,
        payload: {
          requestedFrom: 'site',
          requestedAt: new Date().toISOString(),
          remoteDiskKey: disk.remoteDiskKey,
          rootPath: disk.rootPath
        },
        status: AgentCommandStatus.PENDING,
        phase: 'EN_ATTENTE',
        progressPercent: 0
      }
    });

    return NextResponse.json({
      success: true,
      alreadyQueued: false,
      commandId: command.id
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Impossible de créer la commande de scan.'
      },
      { status: 500 }
    );
  }
}