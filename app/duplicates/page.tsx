import { prisma } from '@/lib/prisma';
import { DuplicatesClient } from '@/components/disks/duplicates-client';
import { diskAccessWhere, getSessionAccessibleDiskIds } from '@/lib/disk-access';

// The disk list must reflect the current DB state, not a build-time snapshot.
export const dynamic = 'force-dynamic';

export default async function DuplicatesPage() {
  const accessibleDiskIds = await getSessionAccessibleDiskIds();

  const disks = await prisma.disk.findMany({
    where: { isEnabled: true, ...diskAccessWhere(accessibleDiskIds) },
    select: { id: true, code: true, name: true },
    orderBy: { code: 'asc' }
  });

  return <DuplicatesClient disks={disks} />;
}
