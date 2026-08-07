import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/require-session';
import { buildCsv } from '@/lib/csv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_GROUPS = 50;

export async function GET(request: Request) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const diskId = searchParams.get('diskId')?.trim() ?? '';

  const groups = await prisma.fileEntry.groupBy({
    by: ['name', 'size'],
    where: {
      entryType: 'FILE',
      deletedAt: null,
      size: { gt: 0 },
      ...(diskId ? { diskId } : {})
    },
    _count: { _all: true },
    having: { id: { _count: { gt: 1 } } },
    orderBy: { _count: { id: 'desc' } },
    take: 300
  });

  const ranked = groups
    .map((group) => ({
      name: group.name,
      size: group.size ?? BigInt(0),
      wasted: (group.size ?? BigInt(0)) * BigInt(group._count._all - 1)
    }))
    .sort((a, b) => (b.wasted > a.wasted ? 1 : b.wasted < a.wasted ? -1 : 0))
    .slice(0, MAX_GROUPS);

  const entries = ranked.length
    ? await prisma.fileEntry.findMany({
        where: {
          entryType: 'FILE',
          deletedAt: null,
          ...(diskId ? { diskId } : {}),
          OR: ranked.map((group) => ({ name: group.name, size: group.size }))
        },
        select: {
          name: true,
          size: true,
          relativePath: true,
          fullPath: true,
          modifiedAt: true,
          disk: { select: { code: true, name: true } }
        },
        orderBy: [{ name: 'asc' }, { relativePath: 'asc' }]
      })
    : [];

  const rows = entries.map((entry) => [
    entry.name,
    entry.size?.toString() ?? '',
    entry.disk.code,
    entry.disk.name,
    entry.relativePath,
    entry.fullPath,
    entry.modifiedAt?.toISOString() ?? ''
  ]);

  const csv = buildCsv(
    ['Nom', 'Taille (octets)', 'Code disque', 'Nom disque', 'Chemin relatif', 'Chemin complet', 'Modifié le'],
    rows
  );

  const filename = diskId ? 'doublons-disque.csv' : 'doublons-tous-disques.csv';

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  });
}
