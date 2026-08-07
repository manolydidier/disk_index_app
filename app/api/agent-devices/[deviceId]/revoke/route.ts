import { NextResponse } from 'next/server';
import { AgentDeviceStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/require-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  _: Request,
  context: { params: Promise<{ deviceId: string }> }
) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  if (session.user.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Accès réservé aux administrateurs.' },
      { status: 403 }
    );
  }

  const { deviceId } = await context.params;

  const device = await prisma.agentDevice.findUnique({
    where: { id: deviceId },
    select: { id: true }
  });

  if (!device) {
    return NextResponse.json(
      { error: 'Appareil introuvable.' },
      { status: 404 }
    );
  }

  await prisma.$transaction([
    prisma.agentDevice.update({
      where: { id: deviceId },
      data: { status: AgentDeviceStatus.DISABLED }
    }),
    prisma.agentAuthToken.updateMany({
      where: { agentDeviceId: deviceId, revokedAt: null },
      data: { revokedAt: new Date() }
    })
  ]);

  return NextResponse.json({
    success: true,
    message: 'Accès révoqué. Cet appareil devra se réenregistrer pour se reconnecter.'
  });
}
