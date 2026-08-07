import { prisma } from '@/lib/prisma';
import { StorageClient } from '@/components/disks/storage-client';

// The disk list must reflect the current DB state, not a build-time snapshot.
export const dynamic = 'force-dynamic';

export default async function StoragePage() {
  const disks = await prisma.disk.findMany({
    where: { isEnabled: true },
    select: { id: true, code: true, name: true },
    orderBy: { code: 'asc' }
  });

  return <StorageClient disks={disks} />;
}
