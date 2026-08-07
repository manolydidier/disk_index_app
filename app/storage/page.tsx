import { prisma } from '@/lib/prisma';
import { StorageClient } from '@/components/disks/storage-client';
import { diskAccessWhere, getSessionAccessibleDiskIds } from '@/lib/disk-access';

// The disk list must reflect the current DB state, not a build-time snapshot.
export const dynamic = 'force-dynamic';

export default async function StoragePage() {
  const accessibleDiskIds = await getSessionAccessibleDiskIds();

  const disks = await prisma.disk.findMany({
    where: { isEnabled: true, ...diskAccessWhere(accessibleDiskIds) },
    select: { id: true, code: true, name: true },
    orderBy: { code: 'asc' }
  });

  return <StorageClient disks={disks} />;
}
