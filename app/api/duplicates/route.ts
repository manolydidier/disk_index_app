import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/require-session';
import { canAccessDisk, diskIdAccessWhere, getAccessibleDiskIds } from '@/lib/disk-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function jsonSafe<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_, currentValue) =>
      typeof currentValue === 'bigint' ? currentValue.toString() : currentValue
    )
  );
}

const MAX_GROUPS = 50;

export async function GET(request: Request) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const accessibleDiskIds = await getAccessibleDiskIds(session.user);

  const { searchParams } = new URL(request.url);
  const diskId = searchParams.get('diskId')?.trim() ?? '';

  if (diskId && !canAccessDisk(accessibleDiskIds, diskId)) {
    return NextResponse.json({ error: 'Accès refusé à ce disque.' }, { status: 403 });
  }

  // Files are matched by identical name + size — the scanner does not compute
  // a content hash, so this is a heuristic ("probable" duplicates), not a
  // byte-for-byte guarantee.
  const groups = await prisma.fileEntry.groupBy({
    by: ['name', 'size'],
    where: {
      entryType: 'FILE',
      deletedAt: null,
      size: { gt: 0 },
      ...(diskId ? { diskId } : diskIdAccessWhere(accessibleDiskIds))
    },
    _count: { _all: true },
    having: {
      id: { _count: { gt: 1 } }
    },
    orderBy: { _count: { id: 'desc' } },
    take: 300
  });

  if (groups.length === 0) {
    return NextResponse.json({ groups: [], totalWastedBytes: '0' });
  }

  const ranked = groups
    .map((group) => ({
      name: group.name,
      size: group.size ?? BigInt(0),
      count: group._count._all,
      wasted: (group.size ?? BigInt(0)) * BigInt(group._count._all - 1)
    }))
    .sort((a, b) => (b.wasted > a.wasted ? 1 : b.wasted < a.wasted ? -1 : 0))
    .slice(0, MAX_GROUPS);

  const entries = await prisma.fileEntry.findMany({
    where: {
      entryType: 'FILE',
      deletedAt: null,
      ...(diskId ? { diskId } : diskIdAccessWhere(accessibleDiskIds)),
      OR: ranked.map((group) => ({ name: group.name, size: group.size }))
    },
    select: {
      id: true,
      name: true,
      relativePath: true,
      fullPath: true,
      size: true,
      modifiedAt: true,
      disk: {
        select: { id: true, code: true, name: true }
      }
    }
  });

  const totalWastedBytes = ranked.reduce((sum, group) => sum + group.wasted, BigInt(0));

  const payload = {
    totalWastedBytes,
    groups: ranked.map((group) => ({
      name: group.name,
      size: group.size,
      count: group.count,
      wasted: group.wasted,
      files: entries
        .filter((entry) => entry.name === group.name && entry.size === group.size)
        .map((entry) => ({
          id: entry.id,
          relativePath: entry.relativePath,
          fullPath: entry.fullPath,
          modifiedAt: entry.modifiedAt?.toISOString() ?? null,
          disk: entry.disk
        }))
    }))
  };

  return NextResponse.json(jsonSafe(payload));
}
