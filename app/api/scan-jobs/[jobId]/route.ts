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

export async function GET(
  _: Request,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await context.params;

    const job = await prisma.scanJob.findUnique({
      where: { id: jobId },
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

    if (!job) {
      return NextResponse.json(
        { error: 'Job introuvable.' },
        { status: 404 }
      );
    }

    return NextResponse.json(jsonSafe(job));
  } catch (error) {
    console.error('GET /api/scan-jobs/[jobId] ERROR:', error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Impossible de charger le job.'
      },
      { status: 500 }
    );
  }
}