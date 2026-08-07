import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { sendMailWithConfig } from '@/lib/email';
import { requireSession } from '@/lib/require-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const testEmailSchema = z.object({
  to: z.string().email(),
  smtpHost: z.string().trim().optional(),
  smtpPort: z.number().int().min(1).max(65535).optional(),
  smtpUser: z.string().trim().optional(),
  // Empty string means "use the already-saved password" — the form never
  // receives the real stored password back, so it can't resend it as-is.
  smtpPassword: z.string().optional(),
  smtpFrom: z.string().trim().optional()
});

export async function POST(request: Request) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => ({}));
  const parsed = testEmailSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Paramètres invalides.' },
      { status: 400 }
    );
  }

  const input = parsed.data;

  const savedSettings = await prisma.automationSettings.findUnique({
    where: { id: 1 }
  });

  const host = input.smtpHost || savedSettings?.smtpHost;
  const port = input.smtpPort ?? savedSettings?.smtpPort ?? 587;
  const user = input.smtpUser || savedSettings?.smtpUser;
  const pass = input.smtpPassword || savedSettings?.smtpPassword;
  const from = input.smtpFrom || savedSettings?.smtpFrom || user;

  if (!host || !user || !pass || !from) {
    return NextResponse.json(
      {
        error:
          "Configuration SMTP incomplète. Renseigne au minimum le serveur, l'utilisateur et le mot de passe."
      },
      { status: 400 }
    );
  }

  try {
    await sendMailWithConfig(
      { host, port, user, pass, from },
      {
        to: [input.to],
        subject: 'Disk Indexer — email de test',
        text: 'Si tu reçois ce message, la configuration SMTP de Disk Indexer fonctionne correctement.'
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Échec de l'envoi. Vérifie le serveur, le port et les identifiants."
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    success: true,
    message: `Email de test envoyé à ${input.to}.`
  });
}
