import { NextResponse } from 'next/server';
import { DiskStatus, Prisma, ScanStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { diskUpdateSchema } from '@/lib/validators';
import { normalizeDiskRootPath } from '@/lib/root-path';
import { requireSession } from '@/lib/require-session';
import { canAccessDisk, getAccessibleDiskIds } from '@/lib/disk-access';

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
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { diskId } = await context.params;

  const accessibleDiskIds = await getAccessibleDiskIds(session.user);
  if (!canAccessDisk(accessibleDiskIds, diskId)) {
    return NextResponse.json({ error: 'Disque introuvable.' }, { status: 404 });
  }

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
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  try {
    const { diskId } = await context.params;

    const accessibleDiskIds = await getAccessibleDiskIds(session.user);
    if (!canAccessDisk(accessibleDiskIds, diskId)) {
      return NextResponse.json({ error: 'Disque introuvable.' }, { status: 404 });
    }

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

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return NextResponse.json(
        {
          error: {
            fieldErrors: {
              code: ['Ce code est déjà utilisé par un autre disque.']
            }
          }
        },
        { status: 409 }
      );
    }

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
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  try {
    const { diskId } = await context.params;

    const accessibleDiskIds = await getAccessibleDiskIds(session.user);
    if (!canAccessDisk(accessibleDiskIds, diskId)) {
      return NextResponse.json({ error: 'Disque introuvable.' }, { status: 404 });
    }

    const disk = await prisma.disk.findUnique({
      where: { id: diskId },
      select: {
        id: true,
        code: true,
        status: true,
        isEnabled: true
      }
    });

    if (!disk) {
      return NextResponse.json(
        { error: 'Disque introuvable.' },
        { status: 404 }
      );
    }

    const runningJob = await prisma.scanJob.findFirst({
      where: {
        diskId,
        status: ScanStatus.RUNNING
      },
      orderBy: { createdAt: 'desc' }
    });

    if (runningJob) {
      return NextResponse.json(
        {
          error:
            'Un scan est encore en cours sur ce disque. Attends la fin du scan avant de supprimer le disque.'
        },
        { status: 400 }
      );
    }

    if (disk.status === DiskStatus.ACTIVE && disk.isEnabled) {
      return NextResponse.json(
        {
          error:
            'Un disque actif ne peut pas être supprimé. Désactive-le d’abord.'
        },
        { status: 400 }
      );
    }

    await prisma.$transaction([
      prisma.fileEntry.deleteMany({
        where: { diskId }
      }),
      prisma.diskActivity.deleteMany({
        where: { diskId }
      }),
      prisma.scanJob.deleteMany({
        where: { diskId }
      }),
      prisma.automationEvent.deleteMany({
        where: { diskId }
      }),
      prisma.diskAutomationPreference.deleteMany({
        where: { diskId }
      }),
      prisma.disk.delete({
        where: { id: diskId }
      })
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DISK DELETE ERROR:', error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Impossible de supprimer le disque.'
      },
      { status: 500 }
    );
  }
}