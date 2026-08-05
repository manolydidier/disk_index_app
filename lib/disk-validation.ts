export const DISK_CODE_PATTERN = /^DB\d{4,}$/;

export type DiskFieldErrors = Partial<
  Record<'code' | 'name' | 'rootPath' | 'description', string[]>
>;

export function validateDiskFields(input: {
  name: string;
  rootPath: string;
  code?: string;
}): DiskFieldErrors {
  const errors: DiskFieldErrors = {};

  if (input.name.trim().length < 2) {
    errors.name = ['Le nom est requis (2 caractères minimum).'];
  }

  if (input.rootPath.trim().length < 2) {
    errors.rootPath = [
      'Le chemin racine est requis. Sélectionne un disque connecté ou saisis-le manuellement.'
    ];
  }

  const code = input.code?.trim();
  if (code && !DISK_CODE_PATTERN.test(code)) {
    errors.code = ['Le code doit avoir la forme DB0001.'];
  }

  return errors;
}
