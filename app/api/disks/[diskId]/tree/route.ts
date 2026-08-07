import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildDiskTreeResponse } from '@/lib/tree';
import { requireSession } from '@/lib/require-session';

export const runtime = 'nodejs';

export async function GET(_: Request, context: { params: Promise<{ diskId: string }> }) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { diskId } = await context.params;

  const disk = await prisma.disk.findUnique({
    where: { id: diskId },
    include: {
      entries: {
        where: { deletedAt: null },
        orderBy: { relativePath: 'asc' }
      }
    }
  });

  if (!disk) {
    return NextResponse.json({ error: 'Disque introuvable' }, { status: 404 });
  }

  const tree = buildDiskTreeResponse({
    diskId: disk.code,
    diskName: disk.name,
    rootPath: disk.rootPath,
    status: disk.status,
    lastScan: disk.lastScanAt,
    entries: disk.entries
  });

  return NextResponse.json(tree);
}
