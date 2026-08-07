import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/require-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const toggleSchema = z.object({
  userId: z.string().min(1),
  granted: z.boolean()
});

export async function GET(
  _: Request,
  context: { params: Promise<{ diskId: string }> }
) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  if (session.user.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Accès réservé aux administrateurs.' },
      { status: 403 }
    );
  }

  const { diskId } = await context.params;

  const [users, grants] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'USER' },
      select: { id: true, email: true, name: true },
      orderBy: { email: 'asc' }
    }),
    prisma.diskAccess.findMany({
      where: { diskId },
      select: { userId: true }
    })
  ]);

  const grantedIds = new Set(grants.map((g) => g.userId));

  return NextResponse.json(
    users.map((user) => ({
      userId: user.id,
      email: user.email,
      name: user.name,
      hasAccess: grantedIds.has(user.id)
    }))
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ diskId: string }> }
) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  if (session.user.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Accès réservé aux administrateurs.' },
      { status: 403 }
    );
  }

  const { diskId } = await context.params;
  const payload = await request.json().catch(() => ({}));
  const parsed = toggleSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { userId, granted } = parsed.data;

  if (granted) {
    await prisma.diskAccess.upsert({
      where: { userId_diskId: { userId, diskId } },
      update: {},
      create: { userId, diskId }
    });
  } else {
    await prisma.diskAccess.deleteMany({ where: { userId, diskId } });
  }

  return NextResponse.json({ success: true });
}
