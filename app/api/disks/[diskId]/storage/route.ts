import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/require-session';
import { canAccessDisk, getAccessibleDiskIds } from '@/lib/disk-access';

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
    select: { id: true, code: true, name: true }
  });

  if (!disk) {
    return NextResponse.json({ error: 'Disque introuvable.' }, { status: 404 });
  }

  const baseWhere = { diskId, entryType: 'FILE' as const, deletedAt: null };

  const [totals, folderCount, byExtension, largestFiles] = await Promise.all([
    prisma.fileEntry.aggregate({
      where: baseWhere,
      _sum: { size: true },
      _count: { _all: true }
    }),
    prisma.fileEntry.count({
      where: { diskId, entryType: 'FOLDER', deletedAt: null }
    }),
    prisma.fileEntry.groupBy({
      by: ['extension'],
      where: baseWhere,
      _sum: { size: true },
      _count: { _all: true },
      orderBy: { _sum: { size: 'desc' } },
      take: 20
    }),
    prisma.fileEntry.findMany({
      where: baseWhere,
      select: {
        id: true,
        name: true,
        relativePath: true,
        extension: true,
        size: true,
        modifiedAt: true
      },
      orderBy: { size: 'desc' },
      take: 20
    })
  ]);

  const totalSize = totals._sum.size ?? BigInt(0);

  const payload = {
    disk: { id: disk.id, code: disk.code, name: disk.name },
    totalFiles: totals._count._all,
    totalFolders: folderCount,
    totalSize,
    byExtension: byExtension.map((row) => ({
      extension: row.extension || '(sans extension)',
      size: row._sum.size ?? BigInt(0),
      count: row._count._all
    })),
    largestFiles: largestFiles.map((file) => ({
      id: file.id,
      name: file.name,
      relativePath: file.relativePath,
      extension: file.extension,
      size: file.size ?? BigInt(0),
      modifiedAt: file.modifiedAt?.toISOString() ?? null
    }))
  };

  return NextResponse.json(jsonSafe(payload));
}
