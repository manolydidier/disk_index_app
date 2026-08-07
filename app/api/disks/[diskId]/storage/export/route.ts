import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/require-session';
import { canAccessDisk, getAccessibleDiskIds } from '@/lib/disk-access';
import { buildCsv } from '@/lib/csv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
    select: { id: true, code: true }
  });

  if (!disk) {
    return NextResponse.json({ error: 'Disque introuvable.' }, { status: 404 });
  }

  const byExtension = await prisma.fileEntry.groupBy({
    by: ['extension'],
    where: { diskId, entryType: 'FILE', deletedAt: null },
    _sum: { size: true },
    _count: { _all: true },
    orderBy: { _sum: { size: 'desc' } }
  });

  const rows = byExtension.map((row) => [
    row.extension || '(sans extension)',
    row._count._all,
    row._sum.size?.toString() ?? '0'
  ]);

  const csv = buildCsv(['Extension', 'Nombre de fichiers', 'Taille totale (octets)'], rows);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${disk.code}-espace-disque.csv"`
    }
  });
}
