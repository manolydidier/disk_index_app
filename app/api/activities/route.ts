import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const unacknowledged = searchParams.get('unacknowledged') === 'true';
  const diskId = searchParams.get('diskId')?.trim() || undefined;

  const activities = await prisma.diskActivity.findMany({
    where: {
      diskId,
      acknowledgedAt: unacknowledged ? null : undefined
    },
    include: {
      disk: {
        select: {
          id: true,
          code: true,
          name: true,
          status: true
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 50
  });

  return NextResponse.json(activities);
}
