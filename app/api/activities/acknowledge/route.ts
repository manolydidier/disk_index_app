import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { activityAcknowledgeSchema } from '@/lib/validators';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  const parsed = activityAcknowledgeSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await prisma.diskActivity.updateMany({
    where: {
      id: parsed.data.ids ? { in: parsed.data.ids } : undefined,
      diskId: parsed.data.diskId,
      acknowledgedAt: null
    },
    data: {
      acknowledgedAt: new Date()
    }
  });

  return NextResponse.json({ success: true });
}
