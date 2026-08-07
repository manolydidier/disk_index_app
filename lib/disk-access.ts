import 'server-only';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export type SessionUser = {
  id: string;
  role: string;
};

// null means "no restriction" (admins see every disk).
export async function getAccessibleDiskIds(
  user: SessionUser
): Promise<string[] | null> {
  if (user.role === 'ADMIN') return null;

  const rows = await prisma.diskAccess.findMany({
    where: { userId: user.id },
    select: { diskId: true }
  });

  return rows.map((row) => row.diskId);
}

export async function getSessionAccessibleDiskIds(): Promise<string[] | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return [];

  return getAccessibleDiskIds({
    id: session.user.id,
    role: session.user.role
  });
}

// Prisma `where` fragment restricting the Disk relation to accessible disks.
export function diskAccessWhere(accessibleDiskIds: string[] | null) {
  if (accessibleDiskIds === null) return {};
  return { id: { in: accessibleDiskIds } };
}

// Same, but for models that reference a disk via a `diskId` column.
export function diskIdAccessWhere(accessibleDiskIds: string[] | null) {
  if (accessibleDiskIds === null) return {};
  return { diskId: { in: accessibleDiskIds } };
}

export function canAccessDisk(
  accessibleDiskIds: string[] | null,
  diskId: string
) {
  return accessibleDiskIds === null || accessibleDiskIds.includes(diskId);
}
