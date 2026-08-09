import { diskCreateSchema } from '@/lib/validators';

export type DiskFieldErrors = Partial<
  Record<'code' | 'name' | 'rootPath' | 'description', string[]>
>;

const FIELD_MESSAGES: Partial<Record<'code' | 'name' | 'rootPath', string>> = {
  name: 'Le nom est requis (2 caractères minimum).',
  rootPath: 'Le chemin racine est requis. Sélectionne un disque connecté ou saisis-le manuellement.',
  code: 'Le code doit avoir la forme DB0001.'
};

const diskFieldsSchema = diskCreateSchema.pick({ code: true, name: true, rootPath: true });

export function validateDiskFields(input: {
  name: string;
  rootPath: string;
  code?: string;
}): DiskFieldErrors {
  const result = diskFieldsSchema.safeParse(input);
  if (result.success) return {};

  const errors: DiskFieldErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as keyof typeof FIELD_MESSAGES | undefined;
    if (!field || errors[field]) continue;
    errors[field] = [FIELD_MESSAGES[field] ?? issue.message];
  }
  return errors;
}
