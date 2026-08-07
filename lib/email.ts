import 'server-only';

// nodemailer pulls in Node-only built-ins (fs, net, tls...) via static
// requires. A normal top-level import drags it into every bundle Next.js
// produces for this module's reachable graph — including the edge-runtime
// bundle of instrumentation.ts — which fails to resolve those built-ins.
// `webpackIgnore` keeps it out of the bundle entirely; it's only resolved
// by Node's real module loader when sendMail() actually runs.
type NodemailerModule = typeof import('nodemailer');
type Transporter = ReturnType<NodemailerModule['createTransport']>;

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 587);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;

let transporter: Transporter | null = null;

async function getTransporter() {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;

  if (!transporter) {
    const nodemailer = (await import(
      /* webpackIgnore: true */ 'nodemailer'
    )) as NodemailerModule;

    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS }
    });
  }

  return transporter;
}

export function isEmailConfigured() {
  return Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);
}

export async function sendMail(input: {
  to: string[];
  subject: string;
  text: string;
}) {
  const recipients = input.to.filter(Boolean);
  if (recipients.length === 0) return;

  const client = await getTransporter();

  if (!client) {
    console.warn(
      '[EMAIL] SMTP non configuré (SMTP_HOST/SMTP_USER/SMTP_PASS manquants) — email ignoré:',
      input.subject
    );
    return;
  }

  try {
    await client.sendMail({
      from: SMTP_FROM,
      to: recipients.join(', '),
      subject: input.subject,
      text: input.text
    });
  } catch (error) {
    console.error('[EMAIL] Envoi impossible:', error instanceof Error ? error.message : error);
  }
}
