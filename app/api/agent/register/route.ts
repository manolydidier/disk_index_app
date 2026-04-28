import { NextResponse } from 'next/server';
import { AgentDeviceStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { generateAgentToken, hashAgentToken } from '@/lib/agent/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    const registrationSecret = String(body.registrationSecret ?? '').trim();
    const machineId = String(body.machineId ?? '').trim();
    const hostName = String(body.hostName ?? '').trim();
    const userLabel = String(body.userLabel ?? '').trim() || null;
    const osName = String(body.osName ?? '').trim() || null;
    const appVersion = String(body.appVersion ?? '').trim() || null;

    const expectedSecret = String(
      process.env.AGENT_REGISTRATION_SECRET ?? ''
    ).trim();

    if (!expectedSecret) {
      console.error('[AGENT REGISTER] AGENT_REGISTRATION_SECRET manquant côté serveur.');

      return NextResponse.json(
        { error: 'AGENT_REGISTRATION_SECRET manquant côté serveur.' },
        { status: 500 }
      );
    }

    if (!registrationSecret) {
      return NextResponse.json(
        { error: "Le secret d'enregistrement est requis." },
        { status: 400 }
      );
    }

    if (registrationSecret !== expectedSecret) {
      console.error('[AGENT REGISTER] Secret invalide pour machineId =', machineId);

      return NextResponse.json(
        { error: 'Secret d’enregistrement invalide.' },
        { status: 401 }
      );
    }

    if (!machineId || !hostName) {
      return NextResponse.json(
        { error: 'machineId et hostName sont requis.' },
        { status: 400 }
      );
    }

    console.log('[AGENT REGISTER] Enregistrement agent:', {
      machineId,
      hostName,
      userLabel,
      osName,
      appVersion
    });

    const agent = await prisma.agentDevice.upsert({
      where: { machineId },
      update: {
        hostName,
        userLabel,
        osName,
        appVersion,
        status: AgentDeviceStatus.ONLINE,
        lastSeenAt: new Date(),
        lastHeartbeatAt: new Date()
      },
      create: {
        machineId,
        hostName,
        userLabel,
        osName,
        appVersion,
        status: AgentDeviceStatus.ONLINE,
        lastSeenAt: new Date(),
        lastHeartbeatAt: new Date()
      }
    });

    await prisma.agentAuthToken.updateMany({
      where: {
        agentDeviceId: agent.id,
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    });

    const plainToken = generateAgentToken();

    await prisma.agentAuthToken.create({
      data: {
        agentDeviceId: agent.id,
        tokenHash: hashAgentToken(plainToken)
      }
    });

    console.log('[AGENT REGISTER] Agent enregistré avec succès:', {
      id: agent.id,
      machineId: agent.machineId,
      hostName: agent.hostName
    });

    return NextResponse.json({
      success: true,
      agent: {
        id: agent.id,
        machineId: agent.machineId,
        hostName: agent.hostName,
        userLabel: agent.userLabel
      },
      token: plainToken
    });
  } catch (error) {
    console.error('[AGENT REGISTER] ERREUR:', error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Impossible d'enregistrer l'agent."
      },
      { status: 500 }
    );
  }
}