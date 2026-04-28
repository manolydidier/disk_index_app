import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
            sourceType: true
          }
        }
      }
    });

    if (!job) {
      return NextResponse.json(
        { error: 'Job de scan introuvable.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: job.id,
      diskId: job.diskId,
      scanType: job.scanType,
      status: job.status,
      progressPercent: job.progressPercent ?? 0,
      processedItems: job.processedItems ?? 0,
      totalItems: job.totalItems ?? 0,
      phase: job.phase ?? null,
      currentPath: job.currentPath ?? null,
      errorMessage: job.errorMessage ?? null,
      summary: job.summary ?? null,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      disk: job.disk
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Impossible de lire le job de scan.'
      },
      { status: 500 }
    );
  }
}