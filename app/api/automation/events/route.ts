import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/require-session';

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
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  try {
    const events = await prisma.automationEvent.findMany({
      where: {
        isDismissed: false
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        disk: {
          select: {
            id: true,
            code: true,
            name: true,
            rootPath: true,
            status: true
          }
        }
      }
    });

    return NextResponse.json(jsonSafe(events));
  } catch (error) {
    console.error('GET /api/automation/events ERROR:', error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Impossible de charger les notifications.'
      },
      { status: 500 }
    );
  }
}