import { DiskStatus } from '@prisma/client';
import { z } from 'zod';

export const diskCreateSchema = z.object({
  code: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z
      .string()
      .trim()
      .regex(/^DB\d{4,}$/, 'Le code doit avoir la forme DB0001.')
      .optional()
  ),
  name: z.string().trim().min(2, 'Le nom est requis.').max(120),
  rootPath: z.string().trim().min(2, 'Le chemin racine est requis.').max(500),
  description: z.preprocess(
    (value) => (value === '' ? null : value),
    z.string().trim().max(1000).optional().nullable()
  ),
  status: z.nativeEnum(DiskStatus).default(DiskStatus.ACTIVE)
});

export const diskUpdateSchema = diskCreateSchema.partial().extend({
  isEnabled: z.boolean().optional()
});

export const scanRequestSchema = z.object({
  scanType: z.enum(['FULL', 'DIFFERENTIAL']).default('DIFFERENTIAL'),
  maxDepth: z.preprocess(
    (value) => {
      if (value === '' || value === null || value === undefined) {
        return undefined;
      }
      return Number(value);
    },
    z.number().int().min(1).max(100).optional()
  ),
  excludeHidden: z.preprocess(
    (value) => {
      if (value === undefined) return true;
      if (typeof value === 'boolean') return value;
      if (value === 'true') return true;
      if (value === 'false') return false;
      return true;
    },
    z.boolean().default(true)
  ),
  excludedNames: z.preprocess(
    (value) => {
      if (!value) return undefined;
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') {
        return value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
      }
      return undefined;
    },
    z.array(z.string()).optional()
  ),
  excludedExtensions: z.preprocess(
    (value) => {
      if (!value) return undefined;
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') {
        return value
          .split(',')
          .map((item) => item.trim().replace(/^\./, ''))
          .filter(Boolean);
      }
      return undefined;
    },
    z.array(z.string()).optional()
  )
});

export const activityAcknowledgeSchema = z
  .object({
    ids: z.array(z.string()).optional(),
    diskId: z.string().optional()
  })
  .refine((value) => Boolean(value.diskId || value.ids?.length), {
    message: "Vous devez fournir un diskId ou une liste d'identifiants."
  });