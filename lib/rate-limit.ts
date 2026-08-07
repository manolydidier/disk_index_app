// In-memory sliding-window limiter. Good enough for this single-process
// deployment — resets on restart and does not share state across instances.
type Bucket = {
  failures: number;
  windowStartedAt: number;
  lockedUntil: number | null;
};

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 10 * 60 * 1000;
const LOCKOUT_MS = 10 * 60 * 1000;
const MAX_FAILURES = 5;

function getBucket(key: string): Bucket {
  const existing = buckets.get(key);
  const now = Date.now();

  if (!existing || now - existing.windowStartedAt > WINDOW_MS) {
    const fresh: Bucket = { failures: 0, windowStartedAt: now, lockedUntil: null };
    buckets.set(key, fresh);
    return fresh;
  }

  return existing;
}

export function isLoginLocked(key: string): boolean {
  const bucket = buckets.get(key);
  if (!bucket?.lockedUntil) return false;

  if (Date.now() >= bucket.lockedUntil) {
    buckets.delete(key);
    return false;
  }

  return true;
}

export function recordLoginFailure(key: string): void {
  const bucket = getBucket(key);
  bucket.failures += 1;

  if (bucket.failures >= MAX_FAILURES) {
    bucket.lockedUntil = Date.now() + LOCKOUT_MS;
  }
}

export function clearLoginFailures(key: string): void {
  buckets.delete(key);
}
