import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/email';
import { generateResetToken, hashResetToken, RESET_TOKEN_TTL_MS } from '@/lib/password-reset';
import { isLoginLocked, recordLoginFailure } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const forgotPasswordSchema = z.object({
  email: z.string().email()
});

// Always the same response, whether or not the account exists — the
// alternative (revealing "no account with this email") lets anyone enumerate
// registered users just by hitting this endpoint.
const GENERIC_MESSAGE =
  "Si un compte existe avec cette adresse, un email de réinitialisation vient d'être envoyé.";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = forgotPasswordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Adresse email invalide.' }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase().trim();
  const rateLimitKey = `forgot-password:${email}`;

  if (isLoginLocked(rateLimitKey)) {
    // Same generic message — a lockout response would itself confirm the
    // account exists (real accounts are the only ones that can accumulate
    // requests worth locking out, since we always claim to have sent one).
    return NextResponse.json({ message: GENERIC_MESSAGE });
  }

  recordLoginFailure(rateLimitKey);

  const user = await prisma.user.findUnique({ where: { email } });

  if (user && user.isActive) {
    const rawToken = generateResetToken();
    const tokenHash = hashResetToken(rawToken);

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS)
      }
    });

    const resetUrl = `${new URL(request.url).origin}/reset-password/${rawToken}`;

    try {
      await sendMail({
        to: [user.email],
        subject: 'Disk Indexer — Réinitialisation de votre mot de passe',
        text: [
          `Bonjour${user.name ? ` ${user.name}` : ''},`,
          '',
          'Une demande de réinitialisation de mot de passe a été faite pour ce compte.',
          `Pour choisir un nouveau mot de passe, ouvre ce lien (valable 1 heure) : ${resetUrl}`,
          '',
          "Si tu n'es pas à l'origine de cette demande, ignore cet email — ton mot de passe reste inchangé."
        ].join('\n')
      });
    } catch (error) {
      // Logged server-side only — the client always gets the generic
      // message so an SMTP failure can't be used to distinguish a real
      // account from a made-up one.
      console.error('[FORGOT_PASSWORD_EMAIL_ERROR]', error);
    }
  }

  return NextResponse.json({ message: GENERIC_MESSAGE });
}
