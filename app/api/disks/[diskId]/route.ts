import { NextResponse } from 'next/server';
import { DiskStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { diskUpdateSchema } from '@/lib/validators';

export const runtime = 'nodejs';

export async function GET(_: Request, context: { params: Promise<{ diskId: string }> }) {
  const { diskId } = await context.params;

  const disk = await prisma.disk.findUnique({
    where: { id: diskId },
    include: {
      _count: {
        select: {
          entries: { where: { deletedAt: null } },
          activities: { where: { acknowledgedAt: null } }
        }
      },
      scanJobs: {
        orderBy: { createdAt: 'desc' },
        take: 10
      }
    }
  });

  if (!disk) {
    return NextResponse.json({ error: 'Disque introuvable' }, { status: 404 });
  }

  return NextResponse.json(disk);
}

export async function PATCH(request: Request, context: { params: Promise<{ diskId: string }> }) {
  const { diskId } = await context.params;
  const payload = await request.json();
  const parsed = diskUpdateSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const disk = await prisma.disk.update({
    where: { id: diskId },
    data: parsed.data
  });

  return NextResponse.json(disk);
}

export async function DELETE(_: Request, context: { params: Promise<{ diskId: string }> }) {
  const { diskId } = await context.params;

  const disk = await prisma.disk.findUnique({
    where: { id: diskId },
    select: { status: true, isEnabled: true }
  });

  if (!disk) {
    return NextResponse.json({ error: 'Disque introuvable' }, { status: 404 });
  }

  if (disk.status === DiskStatus.ACTIVE && disk.isEnabled) {
    return NextResponse.json(
      { error: 'Un disque actif ne peut pas être supprimé. Désactivez-le d’abord.' },
      { status: 400 }
    );
  }

  await prisma.disk.delete({ where: { id: diskId } });
  return NextResponse.json({ success: true });
}
