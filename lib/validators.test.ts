import { describe, expect, it } from 'vitest';
import { activityAcknowledgeSchema, diskCreateSchema, scanRequestSchema } from './validators';

describe('diskCreateSchema', () => {
  it('accepts a minimal valid disk', () => {
    const result = diskCreateSchema.safeParse({
      name: 'Archives',
      rootPath: 'D:\\Archives'
    });

    expect(result.success).toBe(true);
  });

  it('rejects a malformed disk code', () => {
    const result = diskCreateSchema.safeParse({
      code: 'not-a-code',
      name: 'Archives',
      rootPath: 'D:\\Archives'
    });

    expect(result.success).toBe(false);
  });

  it('rejects a name that is too short', () => {
    const result = diskCreateSchema.safeParse({
      name: 'A',
      rootPath: 'D:\\Archives'
    });

    expect(result.success).toBe(false);
  });

  it('treats an empty description as null instead of an empty string', () => {
    const result = diskCreateSchema.safeParse({
      name: 'Archives',
      rootPath: 'D:\\Archives',
      description: ''
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBeNull();
    }
  });
});

describe('scanRequestSchema', () => {
  it('defaults to a differential scan with hidden files excluded', () => {
    const result = scanRequestSchema.safeParse({});

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.scanType).toBe('DIFFERENTIAL');
      expect(result.data.excludeHidden).toBe(true);
    }
  });

  it('parses a comma-separated list of excluded extensions, stripping leading dots', () => {
    const result = scanRequestSchema.safeParse({ excludedExtensions: '.tmp, .log,bak' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.excludedExtensions).toEqual(['tmp', 'log', 'bak']);
    }
  });

  it('rejects a maxDepth outside the allowed range', () => {
    const result = scanRequestSchema.safeParse({ maxDepth: '500' });

    expect(result.success).toBe(false);
  });
});

describe('activityAcknowledgeSchema', () => {
  it('accepts a diskId with no ids', () => {
    expect(activityAcknowledgeSchema.safeParse({ diskId: 'disk-1' }).success).toBe(true);
  });

  it('accepts ids with no diskId', () => {
    expect(activityAcknowledgeSchema.safeParse({ ids: ['a', 'b'] }).success).toBe(true);
  });

  it('rejects an empty payload with neither diskId nor ids', () => {
    expect(activityAcknowledgeSchema.safeParse({}).success).toBe(false);
  });
});
