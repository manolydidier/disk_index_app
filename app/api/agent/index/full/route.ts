import crypto from 'crypto';
import path from 'path';
import { NextResponse } from 'next/server';
import { DiskSourceType, DiskStatus, EntryType } from '@prisma/client';
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

    await prisma.fileEntry.deleteMany({
      where: {
        diskId: disk.id
      }
    });

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

    for (const chunk of chunkArray(preparedEntries, 1000)) {
      await prisma.fileEntry.createMany({
        data: chunk.map(({ parentRelativePath: _parentRelativePath, ...entry }) => entry),
        skipDuplicates: true
      });
    }

    const createdEntries = await prisma.fileEntry.findMany({
      where: {
        diskId: disk.id,
        deletedAt: null
      },
      select: {
        id: true,
        relativePath: true
      }
    });

    const idByRelativePath = new Map(
      createdEntries.map((entry) => [entry.relativePath, entry.id])
    );

    for (const chunk of chunkArray(preparedEntries, 500)) {
      await Promise.all(
        chunk.map((entry) => {
          const entryId = idByRelativePath.get(entry.relativePath);
          const parentId = entry.parentRelativePath
            ? (idByRelativePath.get(entry.parentRelativePath) ?? null)
            : null;

          if (!entryId) {
            return Promise.resolve();
          }

          return prisma.fileEntry.update({
            where: { id: entryId },
            data: { parentId }
          });
        })
      );
    }

    await prisma.disk.update({
      where: { id: disk.id },
      data: {
        lastScanAt: new Date(),
        status: DiskStatus.ACTIVE,
        lastSeenAt: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      diskId: disk.id,
      code: disk.code,
      indexedEntries: preparedEntries.length
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