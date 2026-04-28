import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _: Request,
  context: { params: Promise<{ commandId: string }> }
) {
  try {
    const { commandId } = await context.params;

    const command = await prisma.agentCommand.findUnique({
      where: { id: commandId },
      include: {
        disk: {
          select: {
            id: true,
            code: true,
            name: true,
            rootPath: true,
            sourceType: true,
            remoteDiskKey: true
          }
        },
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
      }
    });

    if (!command) {
      return NextResponse.json(
        { error: 'Commande introuvable.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      command
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Impossible de lire la commande.'
      },
      { status: 500 }
    );
  }
}