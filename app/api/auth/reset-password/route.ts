import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { hashResetToken } from '@/lib/password-reset';
import { clearLoginFailures } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8)
});

const INVALID_TOKEN_MESSAGE = 'Ce lien de réinitialisation est invalide ou a expiré.';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = resetPasswordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Le mot de passe doit contenir au moins 8 caractères.' },
      { status: 400 }
    );
  }

  const { token, password } = parsed.data;
  const tokenHash = hashResetToken(token);

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true }
  });

  if (
    !resetToken ||
    resetToken.usedAt ||
    resetToken.expiresAt.getTime() < Date.now() ||
    !resetToken.user.isActive
  ) {
    return NextResponse.json({ error: INVALID_TOKEN_MESSAGE }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash }
    }),
    // Consume every outstanding token for this user, not just the one used —
    // a stale reset link from an earlier request should stop working too.
    prisma.passwordResetToken.updateMany({
      where: { userId: resetToken.userId, usedAt: null },
      data: { usedAt: new Date() }
    })
  ]);

  clearLoginFailures(resetToken.user.email);

  return NextResponse.json({
    message: 'Mot de passe mis à jour. Tu peux te connecter avec ton nouveau mot de passe.'
  });
}
