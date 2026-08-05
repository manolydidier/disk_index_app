import { prisma } from '@/lib/prisma';

/**
 * Postgres rejects a case-insensitive `equals` filter (ILIKE under the hood)
 * when the value ends with a backslash, since it reads as a dangling LIKE
 * escape character — which is exactly how Windows drive roots look ("D:\").
 * Compare in JS instead of relying on Prisma's `mode: 'insensitive'`.
 */
export async function findDiskByRootPathCaseInsensitive(rootPath: string) {
  const disks = await prisma.disk.findMany();
  const target = rootPath.toLowerCase();

  return disks.find((disk) => disk.rootPath.toLowerCase() === target) ?? null;
}

export async function generateNextDiskCode() {
  const latestDisk = await prisma.disk.findFirst({
    orderBy: { code: 'desc' },
    select: { code: true }
  });

  const currentNumber = latestDisk?.code ? Number(latestDisk.code.replace(/^DB/, '')) : 0;
  const nextNumber = Number.isFinite(currentNumber) ? currentNumber + 1 : 1;

  return `DB${String(nextNumber).padStart(4, '0')}`;
}
