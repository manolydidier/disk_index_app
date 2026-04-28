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
  if (fallback) return fallback.toLowerCase().trim() || null;

  const ext = path.extname(name).replace('.', '').toLowerCase();
  return ext || null;
}

function buildFingerprint(entry: {
  name: string;
  relativePath: string;
  type: 'file' | 'folder';
  extension?: string | null;
  size?: number | null;
  modifiedAt?: string | null;
}) {
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

function isValidEntry(entry: unknown): entry is IndexedEntry {
  if (!entry || typeof entry !== 'object') return false;

  const data = entry as Partial<IndexedEntry>;

  return (
    typeof data.name === 'string' &&
    typeof data.relativePath === 'string' &&
    (data.type === 'file' || data.type === 'folder')
  );
}

function normalizeEntry(entry: IndexedEntry) {
  const name = String(entry.name ?? '').trim();
  const relativePath = normalizeRelativePath(entry.relativePath);

  if (!name || !relativePath) {
    return null;
  }

  const type = entry.type === 'folder' ? 'folder' : 'file';
  const extension = getExtension(name, type, entry.extension);
  const parentRelativePath = getParentRelativePath(relativePath);

  return {
    name,
    relativePath,
    type,
    extension,
    size:
      type === 'file' && typeof entry.size === 'number' && Number.isFinite(entry.size)
        ? Math.max(0, Math.floor(entry.size))
        : null,
    modifiedAt:
      typeof entry.modifiedAt === 'string' && entry.modifiedAt.trim()
        ? entry.modifiedAt
        : null,
    parentRelativePath
  };
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

    const rawEntries = Array.isArray(body.entries) ? body.entries : [];
    const validEntries = rawEntries.filter(isValidEntry);
    const normalizedEntries = validEntries
      .map(normalizeEntry)
      .filter(Boolean) as Array<{
      name: string;
      relativePath: string;
      type: 'file' | 'folder';
      extension: string | null;
      size: number | null;
      modifiedAt: string | null;
      parentRelativePath: string | null;
    }>;

    if (!remoteDiskKey || !diskName || !rootPath) {
      return NextResponse.json(
        { error: 'remoteDiskKey, diskName et rootPath sont requis.' },
        { status: 400 }
      );
    }

    console.log('[AGENT INDEX FULL] Début import:', {
      agentId: agent.id,
      machineId: agent.machineId,
      hostName: agent.hostName,
      remoteDiskKey,
      diskName,
      rootPath,
      isConnected,
      receivedEntries: rawEntries.length,
      validEntries: normalizedEntries.length
    });

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

      console.log('[AGENT INDEX FULL] Nouveau disque créé:', {
        diskId: disk.id,
        code: disk.code
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

      console.log('[AGENT INDEX FULL] Disque existant mis à jour:', {
        diskId: disk.id,
        code: disk.code
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

    const preparedEntries = normalizedEntries.map((entry) => {
      const fullPath = entry.relativePath
        ? `${disk.code}/${entry.relativePath}`
        : disk.code;

      return {
        diskId: disk.id,
        name: entry.name,
        entryType: entry.type === 'folder' ? EntryType.FOLDER : EntryType.FILE,
        relativePath: entry.relativePath,
        fullPath,
        extension: entry.extension,
        size:
          entry.type === 'file' && entry.size !== null
            ? BigInt(entry.size)
            : null,
        modifiedAt: entry.modifiedAt ? new Date(entry.modifiedAt) : null,
        inode: null,
        fingerprint: buildFingerprint({
          name: entry.name,
          relativePath: entry.relativePath,
          type: entry.type,
          extension: entry.extension,
          size: entry.size,
          modifiedAt: entry.modifiedAt
        }),
        metadata: {
          importedBy: 'agent',
          agentDeviceId: agent.id,
          agentHostName: agent.hostName,
          machineId: agent.machineId
        },
        parentRelativePath: entry.parentRelativePath
      };
    });

    for (const chunk of chunkArray(preparedEntries, 1000)) {
      await prisma.fileEntry.createMany({
        data: chunk,
        skipDuplicates: true
      });
    }

    await prisma.disk.update({
      where: { id: disk.id },
      data: {
        lastScanAt: new Date(),
        status: DiskStatus.ACTIVE,
        lastSeenAt: new Date()
      }
    });

    console.log('[AGENT INDEX FULL] Import terminé:', {
      diskId: disk.id,
      code: disk.code,
      indexedEntries: preparedEntries.length
    });

    return NextResponse.json({
      success: true,
      diskId: disk.id,
      code: disk.code,
      indexedEntries: preparedEntries.length
    });
  } catch (error) {
    console.error('[AGENT INDEX FULL] ERREUR:', error);

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