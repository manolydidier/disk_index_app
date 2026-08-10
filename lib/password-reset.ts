import 'server-only';
import crypto from 'crypto';

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1h

export function generateResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Only the hash is ever stored — same convention as AgentAuthToken.tokenHash —
// so a leaked database dump doesn't hand out usable reset links.
export function hashResetToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}
