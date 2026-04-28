import { NextResponse } from 'next/server';
import { ScanType } from '@prisma/client';
import { startDiskScan } from '@/lib/scanner';
import { scanRequestSchema } from '@/lib/validators';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  context: { params: Promise<{ diskId: string }> }
) {
  const { diskId } = await context.params;
  const payload = await request.json().catch(() => ({}));
  const parsed = scanRequestSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const job = await startDiskScan(
      diskId,
      parsed.data.scanType === 'FULL'
        ? ScanType.FULL
        : ScanType.DIFFERENTIAL
    );

    return NextResponse.json(
      {
        jobId: job.id,
        status: job.status,
        progressPercent: job.progressPercent
      },
      { status: 202 }
    );
  } catch (error) {
    console.error('SCAN START ERROR:', error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Impossible de démarrer le scan.'
      },
      { status: 500 }
    );
  }
}