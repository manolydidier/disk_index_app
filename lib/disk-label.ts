export function getDriveLetter(rootPath: string | null | undefined) {
  if (!rootPath) return null;

  const match = rootPath.match(/^([A-Za-z]):[\\/]/);
  return match ? `${match[1].toUpperCase()}:` : null;
}

export function getDiskDisplayLabel(input: {
  code: string;
  name: string;
  rootPath: string;
  status?: string | null;
}) {
  const letter = getDriveLetter(input.rootPath);

  if (letter && input.status !== 'DISCONNECTED') {
    return letter;
  }

  return input.code;
}

export function getDiskDisplayTitle(input: {
  code: string;
  name: string;
  rootPath: string;
  status?: string | null;
}) {
  const letter = getDriveLetter(input.rootPath);

  if (letter && input.status !== 'DISCONNECTED') {
    return `${letter} — ${input.name}`;
  }

  return `${input.code} — ${input.name}`;
}