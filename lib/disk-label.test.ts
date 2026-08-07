import { describe, expect, it } from 'vitest';
import { getDiskDisplayLabel, getDiskDisplayTitle, getDriveLetter } from './disk-label';

describe('getDriveLetter', () => {
  it('extracts an uppercase drive letter from a Windows path', () => {
    expect(getDriveLetter('d:\\Data')).toBe('D:');
    expect(getDriveLetter('E:/Backups')).toBe('E:');
  });

  it('returns null for non-drive paths or missing input', () => {
    expect(getDriveLetter('\\\\NAS\\share')).toBeNull();
    expect(getDriveLetter(null)).toBeNull();
    expect(getDriveLetter(undefined)).toBeNull();
    expect(getDriveLetter('')).toBeNull();
  });
});

describe('getDiskDisplayLabel', () => {
  const base = { code: 'DB0001', name: 'Archives', rootPath: 'F:\\Archives' };

  it('prefers the drive letter when the disk is connected', () => {
    expect(getDiskDisplayLabel({ ...base, status: 'ACTIVE' })).toBe('F:');
  });

  it('falls back to the disk code when disconnected', () => {
    expect(getDiskDisplayLabel({ ...base, status: 'DISCONNECTED' })).toBe('DB0001');
  });

  it('falls back to the disk code when the path has no drive letter', () => {
    expect(
      getDiskDisplayLabel({ ...base, rootPath: '\\\\NAS\\share', status: 'ACTIVE' })
    ).toBe('DB0001');
  });
});

describe('getDiskDisplayTitle', () => {
  const base = { code: 'DB0001', name: 'Archives', rootPath: 'F:\\Archives' };

  it('combines the drive letter and disk name when connected', () => {
    expect(getDiskDisplayTitle({ ...base, status: 'ACTIVE' })).toBe('F: — Archives');
  });

  it('combines the disk code and name when disconnected', () => {
    expect(getDiskDisplayTitle({ ...base, status: 'DISCONNECTED' })).toBe('DB0001 — Archives');
  });
});
