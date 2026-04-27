import { NextResponse } from 'next/server';
import { DiskStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { diskUpdateSchema } from '@/lib/validators';
import { normalizeDiskRootPath } from '@/lib/root-path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function jsonSafe<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_, currentValue) =>
      typeof currentValue === 'bigint' ? currentValue.toString() : currentValue
    )
  );
}

export async function GET(
  _: Request,
  context: { params: Promise<{ diskId: string }> }
) {
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
    return NextResponse.json(
      { error: 'Disque introuvable.' },
      { status: 404 }
    );
  }

  return NextResponse.json(jsonSafe(disk));
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ diskId: string }> }
) {
  try {
    const { diskId } = await context.params;
    const payload = await request.json().catch(() => ({}));
    const parsed = diskUpdateSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data: Record<string, unknown> = { ...parsed.data };

    if (typeof parsed.data.rootPath === 'string') {
      data.rootPath = normalizeDiskRootPath(parsed.data.rootPath);
    }

    const disk = await prisma.disk.update({
      where: { id: diskId },
      data
    });

    return NextResponse.json(jsonSafe(disk));
  } catch (error) {
    console.error('DISK UPDATE ERROR:', error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Impossible de mettre à jour le disque.'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _: Request,
  context: { params: Promise<{ diskId: string }> }
) {
  const { diskId } = await context.params;

  const disk = await prisma.disk.findUnique({
    where: { id: diskId },
    select: { status: true, isEnabled: true }
  });

  if (!disk) {
    return NextResponse.json(
      { error: 'Disque introuvable.' },
      { status: 404 }
    );
  }

  if (disk.status === DiskStatus.ACTIVE && disk.isEnabled) {
    return NextResponse.json(
      {
        error:
          'Un disque actif ne peut pas être supprimé. Désactivez-le d’abord.'
      },
      { status: 400 }
    );
  }

  await prisma.disk.delete({
    where: { id: diskId }
  });

  return NextResponse.json({ success: true });
}