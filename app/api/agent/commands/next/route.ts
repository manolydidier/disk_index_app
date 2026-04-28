import { NextResponse } from 'next/server';
import { AgentCommandStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { authenticateAgentRequest } from '@/lib/agent/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const agent = await authenticateAgentRequest(request);

    const pendingCommand = await prisma.agentCommand.findFirst({
      where: {
        agentDeviceId: agent.id,
        status: AgentCommandStatus.PENDING
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true }
    });

    if (!pendingCommand) {
      return NextResponse.json({
        success: true,
        command: null
      });
    }

    const claimResult = await prisma.agentCommand.updateMany({
      where: {
        id: pendingCommand.id,
        agentDeviceId: agent.id,
        status: AgentCommandStatus.PENDING
      },
      data: {
        status: AgentCommandStatus.CLAIMED,
        claimedAt: new Date(),
        phase: 'RÉCUPÉRÉE'
      }
    });

    if (claimResult.count === 0) {
      return NextResponse.json({
        success: true,
        command: null
      });
    }

    const claimed = await prisma.agentCommand.findUnique({
      where: { id: pendingCommand.id },
      include: {
        disk: {
          select: {
            id: true,
            code: true,
            name: true,
            rootPath: true,
            remoteDiskKey: true,
            sourceType: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      command: claimed
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Impossible de récupérer la commande.'
      },
      { status: 401 }
    );
  }
}