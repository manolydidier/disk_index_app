import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function jsonSafe<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_, currentValue) =>
      typeof currentValue === 'bigint' ? currentValue.toString() : currentValue
    )
  );
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const unacknowledged = searchParams.get('unacknowledged') === 'true';
    const diskId = searchParams.get('diskId')?.trim() || undefined;

    const activities = await prisma.diskActivity.findMany({
      where: {
        ...(diskId ? { diskId } : {}),
        ...(unacknowledged ? { acknowledgedAt: null } : {})
      },
      include: {
        disk: {
          select: {
            id: true,
            code: true,
            name: true,
            rootPath: true,
            status: true
          }
        },
        scanJob: {
          select: {
            id: true,
            scanType: true,
            status: true,
            startedAt: true,
            finishedAt: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 200
    });

    return NextResponse.json(jsonSafe(activities));
  } catch (error) {
    console.error('GET /api/activities ERROR:', error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Impossible de charger les activités.'
      },
      { status: 500 }
    );
  }
}