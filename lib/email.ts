import 'server-only';
import { prisma } from '@/lib/prisma';

// nodemailer pulls in Node-only built-ins (fs, net, tls...) via static
// requires. A normal top-level import drags it into every bundle Next.js
// produces for this module's reachable graph — including the edge-runtime
// bundle of instrumentation.ts — which fails to resolve those built-ins.
// `webpackIgnore` keeps it out of the bundle entirely; it's only resolved
// by Node's real module loader when sendMail() actually runs.
type NodemailerModule = typeof import('nodemailer');

export type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
};

// SMTP settings configured via /settings/automation (stored in
// AutomationSettings) always win. Environment variables are only a
// fallback for the case where nobody has configured it through the UI yet.
async function resolveSmtpConfig(): Promise<SmtpConfig | null> {
  const settings = await prisma.automationSettings.findUnique({ where: { id: 1 } });

  const host = settings?.smtpHost || process.env.SMTP_HOST;
  const port = settings?.smtpPort ?? Number(process.env.SMTP_PORT ?? 587);
  const user = settings?.smtpUser || process.env.SMTP_USER;
  const pass = settings?.smtpPassword || process.env.SMTP_PASS;
  const from = settings?.smtpFrom || process.env.SMTP_FROM || user;

  if (!host || !user || !pass || !from) return null;

  return { host, port, user, pass, from };
}

export async function isEmailConfigured() {
  return (await resolveSmtpConfig()) !== null;
}

// Errors are thrown, not swallowed, so callers (the test-email endpoint in
// particular) can tell the difference between "sent" and "failed".
// Fire-and-forget callers (the automation daemon) already .catch() this.
async function deliver(config: SmtpConfig, input: { to: string[]; subject: string; text: string }) {
  const recipients = input.to.filter(Boolean);
  if (recipients.length === 0) return;

  const nodemailer = (await import(
    /* webpackIgnore: true */ 'nodemailer'
  )) as NodemailerModule;

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.user, pass: config.pass }
  });

  await transporter.sendMail({
    from: config.from,
    to: recipients.join(', '),
    subject: input.subject,
    text: input.text
  });
}

export async function sendMail(input: {
  to: string[];
  subject: string;
  text: string;
}) {
  const config = await resolveSmtpConfig();

  if (!config) {
    console.warn(
      '[EMAIL] SMTP non configuré (ni dans /settings/automation, ni via SMTP_HOST/USER/PASS) — email ignoré:',
      input.subject
    );
    return;
  }

  await deliver(config, input);
}

// Used by the "tester l'envoi" button in the settings UI so an admin can
// validate SMTP credentials they've typed but not saved yet.
export async function sendMailWithConfig(
  config: SmtpConfig,
  input: { to: string[]; subject: string; text: string }
) {
  await deliver(config, input);
}
