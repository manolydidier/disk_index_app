import { NextResponse } from 'next/server';
import { ActivityType, AgentCommandStatus, AgentCommandType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { authenticateAgentRequest } from '@/lib/agent/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_STATUSES = new Set<AgentCommandStatus>([
  AgentCommandStatus.RUNNING,
  AgentCommandStatus.COMPLETED,
  AgentCommandStatus.FAILED,
  AgentCommandStatus.CANCELED
]);

export async function POST(
  request: Request,
  context: { params: Promise<{ commandId: string }> }
) {
  try {
    const agent = await authenticateAgentRequest(request);
    const { commandId } = await context.params;
    const body = await request.json().catch(() => ({}));

    const rawStatus = String(body.status ?? '').trim().toUpperCase();
    const status = rawStatus as AgentCommandStatus;

    if (!ALLOWED_STATUSES.has(status)) {
      return NextResponse.json(
        {
          error:
            'status invalide. Valeurs autorisées : RUNNING, COMPLETED, FAILED, CANCELED.'
        },
        { status: 400 }
      );
    }

    const progressPercent =
      typeof body.progressPercent === 'number'
        ? Math.max(0, Math.min(100, Math.round(body.progressPercent)))
        : undefined;

    const phase =
      typeof body.phase === 'string' && body.phase.trim()
        ? body.phase.trim()
        : undefined;

    const currentPath =
      typeof body.currentPath === 'string' && body.currentPath.trim()
        ? body.currentPath.trim()
        : undefined;

    const errorMessage =
      typeof body.errorMessage === 'string' && body.errorMessage.trim()
        ? body.errorMessage.trim()
        : undefined;

    const result = body.result ?? undefined;

    const command = await prisma.agentCommand.findUnique({
      where: { id: commandId }
    });

    if (!command || command.agentDeviceId !== agent.id) {
      return NextResponse.json(
        { error: 'Commande introuvable.' },
        { status: 404 }
      );
    }

    const updated = await prisma.agentCommand.update({
      where: { id: commandId },
      data: {
        status,
        progressPercent,
        phase,
        currentPath,
        errorMessage,
        result,
        startedAt:
          status === AgentCommandStatus.RUNNING && !command.startedAt
            ? new Date()
            : undefined,
        finishedAt:
          status === AgentCommandStatus.COMPLETED ||
          status === AgentCommandStatus.FAILED ||
          status === AgentCommandStatus.CANCELED
            ? new Date()
            : undefined
      }
    });

    if (
      updated.commandType === AgentCommandType.DELETE_FILE &&
      status === AgentCommandStatus.COMPLETED
    ) {
      const payload =
        updated.payload && typeof updated.payload === 'object' && !Array.isArray(updated.payload)
          ? (updated.payload as Record<string, unknown>)
          : {};

      const fileEntryId = String(payload.fileEntryId ?? '');
      const fullPath = String(payload.fullPath ?? '');

      if (fileEntryId) {
        const entry = await prisma.fileEntry.findUnique({
          where: { id: fileEntryId },
          select: { id: true, diskId: true, fullPath: true, name: true, deletedAt: true }
        });

        if (entry && !entry.deletedAt) {
          await prisma.$transaction([
            prisma.fileEntry.update({
              where: { id: entry.id },
              data: { deletedAt: new Date() }
            }),
            prisma.diskActivity.create({
              data: {
                diskId: entry.diskId,
                activityType: ActivityType.DELETED,
                path: entry.fullPath || fullPath,
                details: { name: entry.name, source: 'manual-delete-agent' }
              }
            })
          ]);
        }
      }
    }

    return NextResponse.json({
      success: true,
      commandId: updated.id
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Impossible de mettre à jour la commande.'
      },
      { status: 401 }
    );
  }
}