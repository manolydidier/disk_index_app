import crypto from 'crypto';
import path from 'path';
import { NextResponse } from 'next/server';
import {
  ActivityType,
  DiskSourceType,
  DiskStatus,
  EntryType,
  type FileEntry,
  type Prisma
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { generateNextDiskCode } from '@/lib/disk-code';
import { authenticateAgentRequest } from '@/lib/agent/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type IndexedEntry = {
  name: string;
  relativePath: string;
  type: 'file' | 'folder';
  extension?: string | null;
  size?: number | null;
  modifiedAt?: string | null;
  contentText?: string | null;
};

type PreparedEntry = {
  diskId: string;
  name: string;
  entryType: EntryType;
  relativePath: string;
  fullPath: string;
  extension: string | null;
  size: bigint | null;
  modifiedAt: Date | null;
  inode: string | null;
  fingerprint: string;
  contentText: string | null;
  metadata: {
    importedBy: string;
    agentDeviceId: string;
    agentHostName: string;
  };
  parentRelativePath: string | null;
};

function normalizeRelativePath(value: string) {
  return String(value ?? '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .trim();
}

function getParentRelativePath(relativePath: string) {
  const normalized = normalizeRelativePath(relativePath);

  if (!normalized.includes('/')) {
    return null;
  }

  return normalized.split('/').slice(0, -1).join('/');
}

function getExtension(
  name: string,
  type: 'file' | 'folder',
  fallback?: string | null
) {
  if (type !== 'file') return null;
  if (fallback) return fallback.toLowerCase();

  const ext = path.extname(name).replace('.', '').toLowerCase();
  return ext || null;
}

function buildFingerprint(
  entry: IndexedEntry & { relativePath: string; extension: string | null }
) {
  return crypto
    .createHash('sha1')
    .update(
      [
        entry.type,
        entry.name.toLowerCase(),
        entry.relativePath.toLowerCase(),
        entry.extension ?? '',
        entry.size ?? '',
        entry.modifiedAt ?? ''
      ].join('|')
    )
    .digest('hex');
}

function hasEntryChanged(existing: FileEntry, entry: PreparedEntry) {
  return (
    existing.name !== entry.name ||
    existing.entryType !== entry.entryType ||
    existing.extension !== entry.extension ||
    String(existing.size ?? '') !== String(entry.size ?? '') ||
    existing.modifiedAt?.getTime() !== entry.modifiedAt?.getTime() ||
    existing.fingerprint !== entry.fingerprint
  );
}

function chunkArray<T>(items: T[], chunkSize: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
}

export async function POST(request: Request) {
  try {
    const agent = await authenticateAgentRequest(request);
    const body = await request.json().catch(() => ({}));

    const remoteDiskKey = String(body.remoteDiskKey ?? '').trim();
    const diskName = String(body.diskName ?? '').trim();
    const rootPath = String(body.rootPath ?? '').trim();
    const isConnected = body.isConnected !== false;
    const description = String(body.description ?? '').trim() || null;
    const entries = Array.isArray(body.entries)
      ? (body.entries as IndexedEntry[])
      : [];

    if (!remoteDiskKey || !diskName || !rootPath) {
      return NextResponse.json(
        { error: 'remoteDiskKey, diskName et rootPath sont requis.' },
        { status: 400 }
      );
    }

    let disk = await prisma.disk.findFirst({
      where: {
        agentDeviceId: agent.id,
        remoteDiskKey
      }
    });

    if (!disk) {
      disk = await prisma.disk.create({
        data: {
          code: await generateNextDiskCode(),
          name: diskName,
          rootPath,
          description,
          status: isConnected ? DiskStatus.ACTIVE : DiskStatus.DISCONNECTED,
          sourceType: DiskSourceType.AGENT,
          agentDeviceId: agent.id,
          sourceLabel: agent.userLabel || agent.hostName,
          remoteDiskKey,
          lastSeenAt: new Date()
        }
      });
    } else {
      disk = await prisma.disk.update({
        where: { id: disk.id },
        data: {
          name: diskName,
          rootPath,
          description,
          status: isConnected ? DiskStatus.ACTIVE : DiskStatus.DISCONNECTED,
          sourceType: DiskSourceType.AGENT,
          sourceLabel: agent.userLabel || agent.hostName,
          remoteDiskKey,
          lastSeenAt: new Date()
        }
      });
    }

    if (!isConnected) {
      return NextResponse.json({
        success: true,
        diskId: disk.id,
        code: disk.code,
        indexedEntries: 0
      });
    }

    const preparedEntries: PreparedEntry[] = entries.map((entry) => {
      const relativePath = normalizeRelativePath(entry.relativePath);
      const extension = getExtension(entry.name, entry.type, entry.extension);
      const parentRelativePath = getParentRelativePath(relativePath);
      const fullPath = relativePath ? `${disk.code}/${relativePath}` : disk.code;

      return {
        diskId: disk.id,
        name: entry.name,
        entryType: entry.type === 'folder' ? EntryType.FOLDER : EntryType.FILE,
        relativePath,
        fullPath,
        extension,
        size:
          entry.type === 'file' && typeof entry.size === 'number'
            ? BigInt(entry.size)
            : null,
        modifiedAt: entry.modifiedAt ? new Date(entry.modifiedAt) : null,
        inode: null,
        contentText: entry.type === 'file' ? entry.contentText ?? null : null,
        fingerprint: buildFingerprint({
          ...entry,
          relativePath,
          extension
        }),
        metadata: {
          importedBy: 'agent',
          agentDeviceId: agent.id,
          agentHostName: agent.hostName
        },
        parentRelativePath
      };
    });

    // Diff against what's already indexed instead of wiping and re-creating
    // everything on every scan — on a mostly-unchanged drive this turns a
    // rescan's DB cost from "proportional to every file" into "proportional
    // to what actually changed" (the main reason agent rescans were slow).
    const existingEntries = await prisma.fileEntry.findMany({
      where: { diskId: disk.id, deletedAt: null }
    });

    const existingByPath = new Map(
      existingEntries.map((entry) => [entry.relativePath, entry])
    );

    const matchedIds = new Set<string>();
    const toCreate: PreparedEntry[] = [];
    const toUpdate: Array<{ id: string; entry: PreparedEntry }> = [];

    for (const entry of preparedEntries) {
      const existing = existingByPath.get(entry.relativePath);

      if (!existing) {
        toCreate.push(entry);
        continue;
      }

      matchedIds.add(existing.id);

      if (hasEntryChanged(existing, entry)) {
        toUpdate.push({ id: existing.id, entry });
      }
    }

    const toDelete = existingEntries.filter((entry) => !matchedIds.has(entry.id));

    if (toCreate.length > 0) {
      for (const chunk of chunkArray(toCreate, 1000)) {
        await prisma.fileEntry.createMany({
          data: chunk.map(({ parentRelativePath: _parentRelativePath, ...entry }) => entry),
          skipDuplicates: true
        });
      }
    }

    if (toUpdate.length > 0) {
      for (const chunk of chunkArray(toUpdate, 200)) {
        await Promise.all(
          chunk.map(({ id, entry }) =>
            prisma.fileEntry.update({
              where: { id },
              data: {
                name: entry.name,
                entryType: entry.entryType,
                extension: entry.extension,
                size: entry.size,
                modifiedAt: entry.modifiedAt,
                fingerprint: entry.fingerprint,
                contentText: entry.contentText,
                metadata: entry.metadata,
                deletedAt: null
              }
            })
          )
        );
      }
    }

    if (toDelete.length > 0) {
      await prisma.fileEntry.updateMany({
        where: { id: { in: toDelete.map((entry) => entry.id) } },
        data: { deletedAt: new Date() }
      });
    }

    // Link every entry to its parent folder in one set-based statement
    // instead of one UPDATE per file — for a large drive that was
    // thousands of individual round trips (the other main cost behind
    // slow agent scans), now a single query regardless of entry count.
    await prisma.$executeRaw`
      UPDATE "FileEntry" AS child
      SET "parentId" = parent.id
      FROM "FileEntry" AS parent
      WHERE child."diskId" = ${disk.id}
        AND parent."diskId" = ${disk.id}
        AND child."deletedAt" IS NULL
        AND parent."deletedAt" IS NULL
        AND child."relativePath" LIKE '%/%'
        AND parent."relativePath" = regexp_replace(child."relativePath", '/[^/]+$', '')
    `;

    const activities: Prisma.DiskActivityCreateManyInput[] = [
      ...toCreate.map((entry) => ({
        diskId: disk.id,
        activityType: ActivityType.ADDED,
        path: entry.fullPath,
        details: {
          name: entry.name,
          entryType: entry.entryType,
          size: entry.size?.toString() ?? null,
          modifiedAt: entry.modifiedAt?.toISOString() ?? null
        }
      })),
      ...toUpdate.map(({ entry }) => ({
        diskId: disk.id,
        activityType: ActivityType.MODIFIED,
        path: entry.fullPath,
        details: {
          modifiedAt: entry.modifiedAt?.toISOString() ?? null,
          size: entry.size?.toString() ?? null
        }
      })),
      ...toDelete.map((entry) => ({
        diskId: disk.id,
        activityType: ActivityType.DELETED,
        path: entry.fullPath,
        details: {
          name: entry.name,
          entryType: entry.entryType
        }
      }))
    ];

    if (activities.length > 0) {
      await prisma.diskActivity.createMany({ data: activities });
    }

    await prisma.disk.update({
      where: { id: disk.id },
      data: {
        lastScanAt: new Date(),
        status: DiskStatus.ACTIVE,
        lastSeenAt: new Date(),
        lastActivityAt: activities.length > 0 ? new Date() : undefined
      }
    });

    return NextResponse.json({
      success: true,
      diskId: disk.id,
      code: disk.code,
      indexedEntries: preparedEntries.length,
      added: toCreate.length,
      modified: toUpdate.length,
      deleted: toDelete.length
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Impossible d'importer l'index de l'agent."
      },
      { status: 500 }
    );
  }
}