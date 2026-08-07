import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDriveLetter } from '@/lib/disk-label';
import { requireSession } from '@/lib/require-session';
import { canAccessDisk, diskIdAccessWhere, getAccessibleDiskIds } from '@/lib/disk-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function jsonSafe<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_, currentValue) =>
      typeof currentValue === 'bigint' ? currentValue.toString() : currentValue
    )
  );
}

function extractAbsolutePath(
  metadata: unknown,
  fallbackRootPath: string,
  relativePath: string
) {
  if (
    metadata &&
    typeof metadata === 'object' &&
    !Array.isArray(metadata) &&
    'absolutePath' in metadata
  ) {
    const value = (metadata as { absolutePath?: unknown }).absolutePath;
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }

  const normalizedRoot = fallbackRootPath.replace(/[\\/]+$/, '');

  if (!relativePath) {
    return normalizedRoot;
  }

  const normalizedRelative = relativePath.replace(/\//g, '\\');
  return `${normalizedRoot}\\${normalizedRelative}`;
}

function buildContentSnippet(content: string, query: string, radius = 80) {
  const index = content.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) return null;

  const start = Math.max(0, index - radius);
  const end = Math.min(content.length, index + query.length + radius);

  const prefix = start > 0 ? '…' : '';
  const suffix = end < content.length ? '…' : '';

  return `${prefix}${content.slice(start, end).trim()}${suffix}`;
}

export async function GET(request: Request) {
  const { session, unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const accessibleDiskIds = await getAccessibleDiskIds(session.user);

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim() ?? '';
  const diskId = searchParams.get('diskId')?.trim() ?? '';

  if (diskId && !canAccessDisk(accessibleDiskIds, diskId)) {
    return NextResponse.json({ error: 'Accès refusé à ce disque.' }, { status: 403 });
  }
  const extensionFilter = searchParams.get('extension')?.trim().replace(/^\./, '').toLowerCase() ?? '';
  const entryTypeFilter = searchParams.get('entryType')?.trim().toUpperCase() ?? '';
  const sizeMinRaw = searchParams.get('sizeMin')?.trim() ?? '';
  const sizeMaxRaw = searchParams.get('sizeMax')?.trim() ?? '';
  const modifiedAfterRaw = searchParams.get('modifiedAfter')?.trim() ?? '';
  const modifiedBeforeRaw = searchParams.get('modifiedBefore')?.trim() ?? '';

  if (!query) {
    return NextResponse.json([], { status: 200 });
  }

  const normalizedExtension = query.replace(/^\./, '').toLowerCase();

  // A trailing backslash makes Postgres' ILIKE pattern end on a dangling
  // escape character and reject the query outright — strip it before
  // building the `contains` filters (Windows paths often end this way).
  const likeSafeQuery = query.replace(/\\+$/, '');

  const sizeMin = sizeMinRaw && !Number.isNaN(Number(sizeMinRaw)) ? BigInt(Math.trunc(Number(sizeMinRaw))) : null;
  const sizeMax = sizeMaxRaw && !Number.isNaN(Number(sizeMaxRaw)) ? BigInt(Math.trunc(Number(sizeMaxRaw))) : null;
  const modifiedAfter = modifiedAfterRaw && !Number.isNaN(Date.parse(modifiedAfterRaw)) ? new Date(modifiedAfterRaw) : null;
  const modifiedBefore = modifiedBeforeRaw && !Number.isNaN(Date.parse(modifiedBeforeRaw)) ? new Date(modifiedBeforeRaw) : null;

  const results = await prisma.fileEntry.findMany({
    where: {
      deletedAt: null,
      ...(diskId ? { diskId } : diskIdAccessWhere(accessibleDiskIds)),
      ...(extensionFilter ? { extension: extensionFilter } : {}),
      ...(entryTypeFilter === 'FILE' || entryTypeFilter === 'FOLDER'
        ? { entryType: entryTypeFilter }
        : {}),
      ...(sizeMin !== null || sizeMax !== null
        ? {
            size: {
              ...(sizeMin !== null ? { gte: sizeMin } : {}),
              ...(sizeMax !== null ? { lte: sizeMax } : {})
            }
          }
        : {}),
      ...(modifiedAfter || modifiedBefore
        ? {
            modifiedAt: {
              ...(modifiedAfter ? { gte: modifiedAfter } : {}),
              ...(modifiedBefore ? { lte: modifiedBefore } : {})
            }
          }
        : {}),
      OR: [
        {
          name: {
            contains: likeSafeQuery,
            mode: 'insensitive'
          }
        },
        {
          fullPath: {
            contains: likeSafeQuery,
            mode: 'insensitive'
          }
        },
        {
          relativePath: {
            contains: likeSafeQuery,
            mode: 'insensitive'
          }
        },
        {
          extension: {
            equals: normalizedExtension
          }
        },
        {
          contentText: {
            contains: likeSafeQuery,
            mode: 'insensitive'
          }
        }
      ]
    },
    select: {
      id: true,
      name: true,
      relativePath: true,
      fullPath: true,
      extension: true,
      entryType: true,
      modifiedAt: true,
      size: true,
      metadata: true,
      contentText: true,
      disk: {
        select: {
          id: true,
          code: true,
          name: true,
          status: true,
          rootPath: true
        }
      }
    },
    orderBy: [
      { modifiedAt: 'desc' },
      { fullPath: 'asc' }
    ],
    take: 250
  });

  const payload = results.map((item) => {
    const absolutePath = extractAbsolutePath(
      item.metadata,
      item.disk.rootPath,
      item.relativePath
    );

    const matchedByMetadata =
      item.name.toLowerCase().includes(likeSafeQuery.toLowerCase()) ||
      item.fullPath.toLowerCase().includes(likeSafeQuery.toLowerCase()) ||
      item.relativePath.toLowerCase().includes(likeSafeQuery.toLowerCase()) ||
      item.extension === normalizedExtension;

    const contentSnippet =
      !matchedByMetadata && item.contentText
        ? buildContentSnippet(item.contentText, likeSafeQuery)
        : null;

    return {
      id: item.id,
      name: item.name,
      relativePath: item.relativePath,
      fullPath: item.fullPath,
      absolutePath,
      extension: item.extension,
      entryType: item.entryType,
      modifiedAt: item.modifiedAt?.toISOString() ?? null,
      size: item.size?.toString() ?? null,
      contentSnippet,
      disk: {
        id: item.disk.id,
        code: item.disk.code,
        name: item.disk.name,
        status: item.disk.status,
        rootPath: item.disk.rootPath,
        driveLetter: getDriveLetter(item.disk.rootPath)
      }
    };
  });

  return NextResponse.json(jsonSafe(payload));
}