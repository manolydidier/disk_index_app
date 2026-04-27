import { prisma } from '@/lib/prisma';

export async function generateNextDiskCode() {
  const latestDisk = await prisma.disk.findFirst({
    orderBy: { code: 'desc' },
    select: { code: true }
  });

  const currentNumber = latestDisk?.code ? Number(latestDisk.code.replace(/^DB/, '')) : 0;
  const nextNumber = Number.isFinite(currentNumber) ? currentNumber + 1 : 1;

  return `DB${String(nextNumber).padStart(4, '0')}`;
}
