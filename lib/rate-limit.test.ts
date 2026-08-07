import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearLoginFailures, isLoginLocked, recordLoginFailure } from './rate-limit';

describe('rate-limit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not lock an identifier before it has failed', () => {
    expect(isLoginLocked('fresh@example.com')).toBe(false);
  });

  it('does not lock out before reaching the failure threshold', () => {
    const key = 'user-a@example.com';

    for (let i = 0; i < 4; i += 1) recordLoginFailure(key);

    expect(isLoginLocked(key)).toBe(false);
  });

  it('locks out after 5 failures within the window', () => {
    const key = 'user-b@example.com';

    for (let i = 0; i < 5; i += 1) recordLoginFailure(key);

    expect(isLoginLocked(key)).toBe(true);
  });

  it('unlocks automatically once the lockout period elapses', () => {
    const key = 'user-c@example.com';

    for (let i = 0; i < 5; i += 1) recordLoginFailure(key);
    expect(isLoginLocked(key)).toBe(true);

    vi.advanceTimersByTime(10 * 60 * 1000 + 1);

    expect(isLoginLocked(key)).toBe(false);
  });

  it('clears failures on a successful login', () => {
    const key = 'user-d@example.com';

    for (let i = 0; i < 4; i += 1) recordLoginFailure(key);
    clearLoginFailures(key);
    recordLoginFailure(key);

    expect(isLoginLocked(key)).toBe(false);
  });
});
