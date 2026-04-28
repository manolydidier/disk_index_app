import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await context.params;

  const job = await prisma.scanJob.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      status: true,
      scanType: true,
      progressPercent: true,
      processedItems: true,
      totalItems: true,
      phase: true,
      currentPath: true,
      errorMessage: true,
      summary: true,
      startedAt: true,
      finishedAt: true
    }
  });

  if (!job) {
    return NextResponse.json(
      { error: 'Job de scan introuvable.' },
      { status: 404 }
    );
  }

  return NextResponse.json(job);
}