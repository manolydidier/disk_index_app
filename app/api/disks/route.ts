import { NextResponse } from 'next/server';
import { DiskStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { generateNextDiskCode } from '@/lib/disk-code';
import { diskCreateSchema } from '@/lib/validators';
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

export async function GET() {
  const disks = await prisma.disk.findMany({
    orderBy: { code: 'asc' },
    include: {
      _count: {
        select: {
          entries: { where: { deletedAt: null } },
          activities: { where: { acknowledgedAt: null } }
        }
      }
    }
  });

  return NextResponse.json(jsonSafe(disks));
}

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => ({}));
    console.error('DISK CREATE PAYLOAD:', payload);

    const parsed = diskCreateSchema.safeParse(payload);

    if (!parsed.success) {
      console.error(
        'DISK CREATE VALIDATION ERROR:',
        parsed.error.flatten()
      );

      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const code = parsed.data.code ?? (await generateNextDiskCode());
    const rootPath = normalizeDiskRootPath(parsed.data.rootPath);

    const disk = await prisma.disk.create({
      data: {
        code,
        name: parsed.data.name,
        rootPath,
        description: parsed.data.description,
        status: parsed.data.status ?? DiskStatus.ACTIVE
      }
    });

    return NextResponse.json(jsonSafe(disk), { status: 201 });
  } catch (error) {
    console.error('DISK CREATE ERROR:', error);

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
            : 'Impossible de créer le disque.'
      },
      { status: 500 }
    );
  }
}