import { NextResponse } from 'next/server';
import { AgentDeviceStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { authenticateAgentRequest } from '@/lib/agent/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const agent = await authenticateAgentRequest(request);
    const body = await request.json().catch(() => ({}));

    const hostName = String(body.hostName ?? '').trim() || agent.hostName;
    const userLabel = String(body.userLabel ?? '').trim() || agent.userLabel;
    const osName = String(body.osName ?? '').trim() || agent.osName;
    const appVersion =
      String(body.appVersion ?? '').trim() || agent.appVersion;

    console.log('[AGENT HEARTBEAT] Reçu:', {
      agentId: agent.id,
      machineId: agent.machineId,
      hostName,
      userLabel,
      osName,
      appVersion
    });

    const updatedAgent = await prisma.agentDevice.update({
      where: { id: agent.id },
      data: {
        hostName,
        userLabel,
        osName,
        appVersion,
        status: AgentDeviceStatus.ONLINE,
        lastSeenAt: new Date(),
        lastHeartbeatAt: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      serverTime: new Date().toISOString(),
      agent: {
        id: updatedAgent.id,
        machineId: updatedAgent.machineId,
        hostName: updatedAgent.hostName,
        userLabel: updatedAgent.userLabel,
        status: updatedAgent.status,
        lastHeartbeatAt: updatedAgent.lastHeartbeatAt
      }
    });
  } catch (error) {
    console.error('[AGENT HEARTBEAT] ERREUR:', error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Heartbeat impossible.'
      },
      { status: 401 }
    );
  }
}