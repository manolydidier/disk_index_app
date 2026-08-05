import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export type RootOption = {
  path: string;
  label: string;
  kind: 'drive' | 'mount' | 'folder';
};

async function exists(targetPath: string) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function getWindowsRoots(): Promise<RootOption[]> {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const roots = await Promise.all(
    letters.map(async (letter): Promise<RootOption | null> => {
      const rootPath = `${letter}:\\`;
      const available = await exists(rootPath);
      if (!available) return null;

      return {
        path: rootPath,
        label: `Lecteur ${letter}:`,
        kind: 'drive' as const
      };
    })
  );

  return roots.filter((root): root is RootOption => Boolean(root));
}

async function getUnixRoots(): Promise<RootOption[]> {
  const candidates = ['/', '/mnt', '/media', '/Volumes'];
  const results: RootOption[] = [];

  for (const candidate of candidates) {
    if (!(await exists(candidate))) continue;

    if (candidate === '/') {
      results.push({
        path: '/',
        label: 'Racine système /',
        kind: 'drive'
      });
      continue;
    }

    const entries = await fs.readdir(candidate, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const fullPath = path.join(candidate, entry.name);
      results.push({
        path: fullPath,
        label: `${entry.name} (${candidate})`,
        kind: 'mount'
      });
    }
  }

  return results;
}

export async function getAvailableRoots(): Promise<RootOption[]> {
  const platform = os.platform();
  const roots = platform === 'win32' ? await getWindowsRoots() : await getUnixRoots();

  const unique = new Map<string, RootOption>();
  for (const root of roots) {
    unique.set(root.path, root);
  }

  return [...unique.values()].sort((a, b) => a.path.localeCompare(b.path));
}
