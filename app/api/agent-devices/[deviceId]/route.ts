import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/require-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const renameSchema = z.object({
  userLabel: z.string().trim().min(1).max(120)
});

export async function PATCH(
  request: Request,
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
  const body = await request.json().catch(() => ({}));
  const parsed = renameSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

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

  const updated = await prisma.agentDevice.update({
    where: { id: deviceId },
    data: { userLabel: parsed.data.userLabel }
  });

  return NextResponse.json({
    success: true,
    device: { id: updated.id, userLabel: updated.userLabel }
  });
}

export async function DELETE(
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
    select: { id: true, hostName: true }
  });

  if (!device) {
    return NextResponse.json(
      { error: 'Appareil introuvable.' },
      { status: 404 }
    );
  }

  await prisma.agentDevice.delete({ where: { id: deviceId } });

  return NextResponse.json({ success: true });
}
