import { NextResponse } from 'next/server';
import { ScanType } from '@prisma/client';
import { z } from 'zod';
import { runDiskScanSync } from '@/lib/scanner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const scanSyncSchema = z.object({
  scanType: z.enum(['FULL', 'DIFFERENTIAL']).default('DIFFERENTIAL'),
  maxDepth: z.number().int().min(1).max(99).optional(),
  excludeHidden: z.boolean().optional(),
  excludedNames: z.array(z.string()).optional(),
  excludedExtensions: z.array(z.string()).optional()
});

export async function POST(
  request: Request,
  context: { params: Promise<{ diskId: string }> }
) {
  try {
    const { diskId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const parsed = scanSyncSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await runDiskScanSync(
      diskId,
      parsed.data.scanType === 'FULL'
        ? ScanType.FULL
        : ScanType.DIFFERENTIAL,
      {
        maxDepth: parsed.data.maxDepth,
        excludeHidden: parsed.data.excludeHidden,
        excludedNames: parsed.data.excludedNames,
        excludedExtensions: parsed.data.excludedExtensions
      }
    );

    return NextResponse.json({
      success: true,
      summary: result
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Le scan a échoué.'
      },
      { status: 500 }
    );
  }
}