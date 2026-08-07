import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/require-session';
import { canAccessDisk, getAccessibleDiskIds } from '@/lib/disk-access';
import { buildCsv } from '@/lib/csv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
    select: { code: true }
  });

  if (!disk) {
    return NextResponse.json({ error: 'Disque introuvable.' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const defaultFrom = new Date();
  defaultFrom.setDate(defaultFrom.getDate() - 30);

  const from = parseDateParam(searchParams.get('from'), defaultFrom);
  const to = parseDateParam(searchParams.get('to'), new Date());

  const activities = await prisma.diskActivity.findMany({
    where: {
      diskId,
      activityType: { not: 'DISK_STATUS' },
      createdAt: { gte: from, lte: to }
    },
    orderBy: { createdAt: 'desc' }
  });

  const rows = activities.map((activity) => [
    activity.createdAt.toISOString(),
    activity.activityType,
    activity.path,
    activity.previousPath ?? ''
  ]);

  const csv = buildCsv(['Date', 'Type', 'Chemin', 'Ancien chemin'], rows);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${disk.code}-changements.csv"`
    }
  });
}
