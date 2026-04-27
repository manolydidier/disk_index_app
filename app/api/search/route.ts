import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDriveLetter } from '@/lib/disk-label';

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim() ?? '';
  const diskId = searchParams.get('diskId')?.trim() ?? '';

  if (!query) {
    return NextResponse.json([], { status: 200 });
  }

  const normalizedExtension = query.replace(/^\./, '').toLowerCase();

  const results = await prisma.fileEntry.findMany({
    where: {
      deletedAt: null,
      ...(diskId ? { diskId } : {}),
      OR: [
        {
          name: {
            contains: query,
            mode: 'insensitive'
          }
        },
        {
          fullPath: {
            contains: query,
            mode: 'insensitive'
          }
        },
        {
          relativePath: {
            contains: query,
            mode: 'insensitive'
          }
        },
        {
          extension: {
            equals: normalizedExtension
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