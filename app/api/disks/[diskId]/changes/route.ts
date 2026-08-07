import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/require-session';
import { canAccessDisk, getAccessibleDiskIds } from '@/lib/disk-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_ACTIVITIES = 500;

function parseDateParam(value: string | null, fallback: Date) {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

export async function GET(
  request: Request,
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

  const { searchParams } = new URL(request.url);
  const defaultFrom = new Date();
  defaultFrom.setDate(defaultFrom.getDate() - 30);

  const from = parseDateParam(searchParams.get('from'), defaultFrom);
  const to = parseDateParam(searchParams.get('to'), new Date());

  const where = {
    diskId,
    activityType: { not: 'DISK_STATUS' as const },
    createdAt: { gte: from, lte: to }
  };

  const [counts, activities, totalCount] = await Promise.all([
    prisma.diskActivity.groupBy({
      by: ['activityType'],
      where,
      _count: { _all: true }
    }),
    prisma.diskActivity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: MAX_ACTIVITIES,
      select: {
        id: true,
        activityType: true,
        path: true,
        previousPath: true,
        details: true,
        createdAt: true
      }
    }),
    prisma.diskActivity.count({ where })
  ]);

  const countsByType = Object.fromEntries(
    counts.map((row) => [row.activityType, row._count._all])
  );

  return NextResponse.json({
    disk,
    from: from.toISOString(),
    to: to.toISOString(),
    counts: {
      added: countsByType.ADDED ?? 0,
      modified: countsByType.MODIFIED ?? 0,
      deleted: countsByType.DELETED ?? 0,
      renamed: countsByType.RENAMED ?? 0
    },
    totalCount,
    truncated: totalCount > MAX_ACTIVITIES,
    activities: activities.map((activity) => ({
      id: activity.id,
      activityType: activity.activityType,
      path: activity.path,
      previousPath: activity.previousPath,
      createdAt: activity.createdAt.toISOString()
    }))
  });
}
