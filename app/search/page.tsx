import { prisma } from '@/lib/prisma';
import { SearchClient } from '@/components/disks/search-client';

export default async function SearchPage() {
  const disks = await prisma.disk.findMany({
    where: { isEnabled: true },
    select: { id: true, code: true, name: true },
    orderBy: { code: 'asc' }
  });

  return <SearchClient disks={disks} />;
}
