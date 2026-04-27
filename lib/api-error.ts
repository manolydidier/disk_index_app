const fieldLabels: Record<string, string> = {
  code: 'Code disque',
  name: 'Nom',
  rootPath: 'Chemin racine',
  description: 'Description',
  status: 'Statut',
  scanType: 'Type de scan',
  diskId: 'Disque',
  ids: 'Sélection'
};

export function getApiErrorMessage(
  payload: unknown,
  fallback = 'Une erreur est survenue.'
) {
  if (!payload) return fallback;

  if (typeof payload === 'string') {
    return payload;
  }

  if (typeof payload === 'object') {
    const data = payload as {
      error?: unknown;
      message?: unknown;
      formErrors?: string[];
      fieldErrors?: Record<string, string[]>;
    };

    if (typeof data.error === 'string') {
      return data.error;
    }

    if (typeof data.message === 'string') {
      return data.message;
    }

    const nested = data.error as
      | {
          formErrors?: string[];
          fieldErrors?: Record<string, string[]>;
        }
      | undefined;

    if (nested?.formErrors?.length) {
      return nested.formErrors[0];
    }

    if (nested?.fieldErrors) {
      for (const [key, messages] of Object.entries(nested.fieldErrors)) {
        if (Array.isArray(messages) && messages.length > 0) {
          return `${fieldLabels[key] ?? key} : ${messages[0]}`;
        }
      }
    }

    if (data.formErrors?.length) {
      return data.formErrors[0];
    }

    if (data.fieldErrors) {
      for (const [key, messages] of Object.entries(data.fieldErrors)) {
        if (Array.isArray(messages) && messages.length > 0) {
          return `${fieldLabels[key] ?? key} : ${messages[0]}`;
        }
      }
    }
  }

  return fallback;
}