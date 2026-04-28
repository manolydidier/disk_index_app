import 'server-only';
import {
  ActivityType,
  DiskStatus,
  EntryType,
  type FileEntry,
  type Prisma,
  ScanStatus,
  ScanType
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { buildDiskTreeResponse } from '@/lib/tree';
import { getFsPromises, getPath } from '@/lib/server/node-runtime';

const { access, lstat, opendir } = getFsPromises();
const path = getPath();

type DiskRecord = {
  id: string;
  code: string;
  name: string;
  rootPath: string;
  status: DiskStatus;
};

type ScannedNode = {
  entryType: EntryType;
  name: string;
  relativePath: string;
  fullPath: string;
  extension: string | null;
  size: bigint | null;
  modifiedAt: Date | null;
  inode: string | null;
  fingerprint: string | null;
  metadata: Prisma.InputJsonValue;
  parentRelativePath: string | null;
};

type ScanDiff = {
  added: ScannedNode[];
  modified: Array<{ before: FileEntry; after: ScannedNode }>;
  renamed: Array<{ before: FileEntry; after: ScannedNode }>;
  deleted: FileEntry[];
  current: ScannedNode[];
};

type ScanSummary = {
  added: number;
  modified: number;
  renamed: number;
  deleted: number;
  totalIndexed: number;
};

type ScanOptions = {
  maxDepth?: number;
  excludeHidden?: boolean;
  excludedNames?: string[];
  excludedExtensions?: string[];
};

type ResolvedScanOptions = {
  maxDepth: number;
  excludeHidden: boolean;
  excludedNames: Set<string>;
  excludedExtensions: Set<string>;
};

const CREATE_BATCH_SIZE = 500;
const UPDATE_BATCH_SIZE = 100;
const PROGRESS_FLUSH_MS = 800;
const PROGRESS_FLUSH_ITEMS = 250;
const STALE_JOB_MS = 10 * 60 * 1000;
const SNAPSHOT_MAX_ENTRIES = 5000;

export async function startDiskScan(
  diskId: string,
  scanType: ScanType = ScanType.DIFFERENTIAL,
  options?: ScanOptions
) {
  const disk = await prisma.disk.findUnique({
    where: { id: diskId },
    select: { id: true }
  });

  if (!disk) {
    throw new Error('Disque introuvable.');
  }

  await markStaleRunningJobsFailed(diskId);

  const runningJob = await prisma.scanJob.findFirst({
    where: {
      diskId,
      status: ScanStatus.RUNNING
    },
    orderBy: { startedAt: 'desc' }
  });

  if (runningJob) {
    return runningJob;
  }

  const job = await prisma.scanJob.create({
    data: {
      diskId,
      scanType,
      status: ScanStatus.RUNNING,
      startedAt: new Date(),
      progressPercent: 0,
      processedItems: 0,
      totalItems: 0,
      phase: 'INITIALISATION',
      currentPath: null
    }
  });

  setImmediate(() => {
    executeDiskScan(job.id, diskId, scanType, options).catch((error) => {
      console.error('SCAN BACKGROUND ERROR:', error);
    });
  });

  return job;
}

export async function runDiskScan(
  diskId: string,
  scanType: ScanType = ScanType.DIFFERENTIAL
) {
  return startDiskScan(diskId, scanType);
}

export async function runDiskScanSync(
  diskId: string,
  scanType: ScanType = ScanType.DIFFERENTIAL,
  options?: ScanOptions
) {
  const disk = await prisma.disk.findUnique({
    where: { id: diskId },
    select: { id: true }
  });

  if (!disk) {
    throw new Error('Disque introuvable.');
  }

  await markStaleRunningJobsFailed(diskId);

  const runningJob = await prisma.scanJob.findFirst({
    where: {
      diskId,
      status: ScanStatus.RUNNING
    },
    orderBy: { startedAt: 'desc' }
  });

  if (runningJob) {
    throw new Error('Un scan est déjà en cours sur ce disque.');
  }

  const job = await prisma.scanJob.create({
    data: {
      diskId,
      scanType,
      status: ScanStatus.RUNNING,
      startedAt: new Date(),
      progressPercent: 0,
      processedItems: 0,
      totalItems: 0,
      phase: 'INITIALISATION',
      currentPath: null
    }
  });

  const summary = await executeDiskScan(job.id, diskId, scanType, options);

  return {
    jobId: job.id,
    ...summary
  };
}

async function markStaleRunningJobsFailed(diskId: string) {
  const cutoff = new Date(Date.now() - STALE_JOB_MS);

  await prisma.scanJob.updateMany({
    where: {
      diskId,
      status: ScanStatus.RUNNING,
      startedAt: { lt: cutoff }
    },
    data: {
      status: ScanStatus.FAILED,
      finishedAt: new Date(),
      phase: 'ERREUR',
      errorMessage:
        'Job interrompu ou bloqué, marqué automatiquement comme échoué.'
    }
  });
}

async function runDiskScanJob(
  scanJobId: string,
  diskId: string,
  scanType: ScanType,
  options?: ScanOptions
) {
  try {
    await executeDiskScan(scanJobId, diskId, scanType, options);
  } catch (error) {
    console.error('SCAN BACKGROUND ERROR:', error);
  }
}

async function executeDiskScan(
  scanJobId: string,
  diskId: string,
  scanType: ScanType,
  options?: ScanOptions
): Promise<ScanSummary> {
  const disk = await prisma.disk.findUnique({
    where: { id: diskId },
    select: {
      id: true,
      code: true,
      name: true,
      rootPath: true,
      status: true
    }
  });

  if (!disk) {
    await markJobFailed(scanJobId, 'Disque introuvable.');
    throw new Error('Disque introuvable.');
  }

  try {
    console.log(
      `[SCAN ${scanJobId}] Démarrage sur ${disk.code} (${disk.rootPath})`
    );

    await ensureDiskAccessible(disk);

    await updateJob(scanJobId, {
      phase: 'INDEXATION',
      progressPercent: 2,
      currentPath: disk.code,
      processedItems: 0,
      totalItems: 0
    });

    const scanOptions = resolveScanOptions(options);
    const scannedNodes = await scanFilesystem(disk, scanJobId, scanOptions);

    await updateJob(scanJobId, {
      phase: 'COMPARAISON',
      progressPercent: 96,
      currentPath: disk.code
    });

    const existingEntries = await prisma.fileEntry.findMany({
      where: { diskId, deletedAt: null },
      orderBy: { relativePath: 'asc' }
    });

    const diff = computeDiff(existingEntries, scannedNodes);

    await updateJob(scanJobId, {
      phase: 'ENREGISTREMENT',
      progressPercent: 98,
      currentPath: disk.code
    });

    const summary = await persistScanResult({
      disk,
      diff,
      scanJobId,
      scanType
    });

    await prisma.scanJob.update({
      where: { id: scanJobId },
      data: {
        status: ScanStatus.COMPLETED,
        finishedAt: new Date(),
        phase: 'TERMINÉ',
        progressPercent: 100,
        processedItems: scannedNodes.length,
        totalItems: scannedNodes.length,
        currentPath: null,
        summary: toJsonSafe(summary)
      }
    });

    console.log(
      `[SCAN ${scanJobId}] Terminé - total=${summary.totalIndexed}, ajoutés=${summary.added}, modifiés=${summary.modified}, supprimés=${summary.deleted}`
    );

    return summary;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Erreur de scan inconnue';

    console.error(`[SCAN ${scanJobId}] ERREUR:`, error);

    if (
      message.toLowerCase().includes('inaccessible') ||
      message.toLowerCase().includes('non connecté') ||
      message.toLowerCase().includes('not connected')
    ) {
      await prisma.disk.update({
        where: { id: disk.id },
        data: { status: DiskStatus.DISCONNECTED }
      });

      await prisma.diskActivity.create({
        data: {
          diskId: disk.id,
          scanJobId,
          activityType: ActivityType.DISK_STATUS,
          path: disk.code,
          details: {
            status: 'DISCONNECTED',
            message
          }
        }
      });
    }

    await markJobFailed(scanJobId, message);
    throw new Error(message);
  }
}
async function markJobFailed(scanJobId: string, message: string) {
  await prisma.scanJob.update({
    where: { id: scanJobId },
    data: {
      status: ScanStatus.FAILED,
      finishedAt: new Date(),
      phase: 'ERREUR',
      errorMessage: message
    }
  });
}

async function updateJob(
  scanJobId: string,
  data: Prisma.ScanJobUncheckedUpdateInput
) {
  await prisma.scanJob.update({
    where: { id: scanJobId },
    data
  });
}

async function ensureDiskAccessible(disk: DiskRecord) {
  try {
    await access(disk.rootPath);
  } catch {
    throw new Error(`Le disque ${disk.code} est inaccessible ou non connecté.`);
  }
}

function resolveScanOptions(options?: ScanOptions): ResolvedScanOptions {
  const defaultExcludedNames = [
    'System Volume Information',
    '$RECYCLE.BIN',
    'pagefile.sys',
    'hiberfil.sys',
    'swapfile.sys',
    'node_modules',
    '.git',
    '.next',
    '.cache',
    'AppData'
  ];

  const defaultExcludedExtensions = ['sys', 'tmp', 'log', 'etl'];

  return {
    maxDepth: options?.maxDepth ?? 99,
    excludeHidden: options?.excludeHidden ?? true,
    excludedNames: new Set([
      ...defaultExcludedNames,
      ...(options?.excludedNames ?? [])
    ]),
    excludedExtensions: new Set(
      [...defaultExcludedExtensions, ...(options?.excludedExtensions ?? [])].map(
        (value) => value.replace(/^\./, '').toLowerCase()
      )
    )
  };
}

async function scanFilesystem(
  disk: DiskRecord,
  scanJobId: string,
  scanOptions: ResolvedScanOptions
) {
  const output: ScannedNode[] = [];

  let processedItems = 0;
  let estimatedTotal = 100;
  let pendingDirectories = 1;
  let completedDirectories = 0;
  let lastProgressUpdate = 0;
  let lastFlushedItems = 0;

  function recomputeEstimate() {
    const averageEntriesPerDirectory =
      completedDirectories > 0
        ? Math.max(8, Math.round(processedItems / completedDirectories))
        : 32;

    estimatedTotal = Math.max(
      processedItems + pendingDirectories * averageEntriesPerDirectory,
      processedItems + 1,
      50
    );
  }

  async function flushProgress(currentPath: string, force = false) {
    recomputeEstimate();

    const percent =
      estimatedTotal > 0
        ? Math.min(
            95,
            Math.max(3, Math.round((processedItems / estimatedTotal) * 95))
          )
        : 95;

    const now = Date.now();
    const enoughTimePassed = now - lastProgressUpdate >= PROGRESS_FLUSH_MS;
    const enoughItemsPassed =
      processedItems - lastFlushedItems >= PROGRESS_FLUSH_ITEMS;

    if (!force && !enoughTimePassed && !enoughItemsPassed) {
      return;
    }

    lastProgressUpdate = now;
    lastFlushedItems = processedItems;

    await prisma.scanJob.update({
      where: { id: scanJobId },
      data: {
        processedItems,
        totalItems: estimatedTotal,
        progressPercent: percent,
        currentPath
      }
    });
  }

  async function walk(
    currentAbsolutePath: string,
    parentRelativePath: string | null,
    depth: number
  ) {
    let directory: Awaited<ReturnType<typeof opendir>>;

    try {
      directory = await opendir(currentAbsolutePath);
    } catch (error) {
      if (isIgnorableFsError(error)) {
        pendingDirectories = Math.max(0, pendingDirectories - 1);
        completedDirectories += 1;
        return;
      }
      throw error;
    }

    for await (const dirent of directory) {
      const absolutePath = path.join(currentAbsolutePath, dirent.name);

      if (dirent.isSymbolicLink()) {
        continue;
      }

      if (shouldSkipEntry(dirent.name, absolutePath, scanOptions)) {
        continue;
      }

      try {
        const isDirectory = dirent.isDirectory();
        const extension = dirent.isFile()
          ? path.extname(dirent.name).replace('.', '').toLowerCase() || null
          : null;

        if (shouldSkipExtension(extension, scanOptions)) {
          continue;
        }

        const nextDepth = depth + 1;

        if (nextDepth > scanOptions.maxDepth) {
          continue;
        }

        const stats = await lstat(absolutePath);
        const relativeFromRoot = path.relative(disk.rootPath, absolutePath);
        const normalizedRelative = normalizePath(relativeFromRoot);
        const fullPath = normalizedRelative
          ? `${disk.code}/${normalizedRelative}`
          : disk.code;

        const entryType = isDirectory ? EntryType.FOLDER : EntryType.FILE;

        const currentParentRelative = normalizedRelative.includes('/')
          ? normalizedRelative.split('/').slice(0, -1).join('/')
          : parentRelativePath;

        output.push({
          entryType,
          name: dirent.name,
          relativePath: normalizedRelative,
          fullPath,
          extension,
          size: dirent.isFile() ? BigInt(stats.size) : null,
          modifiedAt: stats.mtime ? new Date(stats.mtime) : null,
          inode:
            typeof stats.ino === 'number' && stats.ino > 0
              ? String(stats.ino)
              : null,
          fingerprint: buildFingerprint({
            entryType,
            extension,
            size: dirent.isFile() ? BigInt(stats.size) : null,
            modifiedAt: stats.mtime ? new Date(stats.mtime) : null,
            name: dirent.name
          }),
          metadata: {
            absolutePath,
            birthtime: stats.birthtime?.toISOString?.() ?? null,
            mode: stats.mode,
            isSymbolicLink: dirent.isSymbolicLink(),
            depth: nextDepth
          },
          parentRelativePath: currentParentRelative ?? null
        });

        processedItems += 1;
        await flushProgress(fullPath);

        if (isDirectory && nextDepth < scanOptions.maxDepth) {
          pendingDirectories += 1;
          await walk(absolutePath, normalizedRelative, nextDepth);
        }
      } catch (error) {
        if (isIgnorableFsError(error)) {
          continue;
        }
        throw error;
      }
    }

    pendingDirectories = Math.max(0, pendingDirectories - 1);
    completedDirectories += 1;

    const relativeCurrent = normalizePath(
      path.relative(disk.rootPath, currentAbsolutePath)
    );
    const currentPath = relativeCurrent
      ? `${disk.code}/${relativeCurrent}`
      : disk.code;

    await flushProgress(currentPath, true);
  }

  await walk(disk.rootPath, null, 0);
  await flushProgress(disk.code, true);

  return output.sort((a, b) =>
    a.relativePath.localeCompare(b.relativePath, 'fr')
  );
}

function computeDiff(
  existingEntries: FileEntry[],
  scannedNodes: ScannedNode[]
): ScanDiff {
  const existingByPath = new Map(
    existingEntries.map((entry) => [entry.relativePath, entry])
  );

  const existingByInode = buildUniqueLookup(existingEntries, (entry) => entry.inode);
  const existingByFingerprint = buildUniqueLookup(
    existingEntries,
    (entry) => entry.fingerprint
  );

  const matchedExistingIds = new Set<string>();
  const added: ScannedNode[] = [];
  const modified: Array<{ before: FileEntry; after: ScannedNode }> = [];
  const renamed: Array<{ before: FileEntry; after: ScannedNode }> = [];

  for (const node of scannedNodes) {
    const exactMatch = existingByPath.get(node.relativePath);

    if (exactMatch) {
      matchedExistingIds.add(exactMatch.id);

      if (hasEntryChanged(exactMatch, node)) {
        modified.push({ before: exactMatch, after: node });
      }

      continue;
    }

    const renameCandidate =
      (node.inode ? existingByInode.get(node.inode) : undefined) ??
      (node.fingerprint ? existingByFingerprint.get(node.fingerprint) : undefined);

    if (renameCandidate && !matchedExistingIds.has(renameCandidate.id)) {
      matchedExistingIds.add(renameCandidate.id);
      renamed.push({ before: renameCandidate, after: node });
      continue;
    }

    added.push(node);
  }

  const deleted = existingEntries.filter(
    (entry) => !matchedExistingIds.has(entry.id)
  );

  return {
    added,
    modified,
    renamed,
    deleted,
    current: scannedNodes
  };
}

async function persistScanResult(params: {
  disk: DiskRecord;
  diff: ScanDiff;
  scanJobId: string;
  scanType: ScanType;
}) {
  const { disk, diff, scanJobId, scanType } = params;
  const now = new Date();

  if (diff.added.length > 0) {
    for (const batch of chunkArray(diff.added, CREATE_BATCH_SIZE)) {
      await prisma.fileEntry.createMany({
        data: batch.map((node) => mapNodeToCreate(disk.id, node))
      });
    }
  }

  for (const batch of chunkArray(diff.modified, UPDATE_BATCH_SIZE)) {
    await Promise.all(
      batch.map((change) =>
        prisma.fileEntry.update({
          where: { id: change.before.id },
          data: mapNodeToUpdate(nodeWithoutParent(change.after))
        })
      )
    );
  }

  for (const batch of chunkArray(diff.renamed, UPDATE_BATCH_SIZE)) {
    await Promise.all(
      batch.map((change) =>
        prisma.fileEntry.update({
          where: { id: change.before.id },
          data: mapNodeToUpdate(nodeWithoutParent(change.after))
        })
      )
    );
  }

  if (diff.deleted.length > 0) {
    await prisma.fileEntry.updateMany({
      where: {
        id: { in: diff.deleted.map((entry) => entry.id) }
      },
      data: {
        deletedAt: now
      }
    });
  }

  const activeEntries = await prisma.fileEntry.findMany({
    where: { diskId: disk.id, deletedAt: null },
    select: { id: true, relativePath: true }
  });

  const idByRelativePath = new Map(
    activeEntries.map((entry) => [entry.relativePath, entry.id])
  );

  const parentUpdates: Array<{ id: string; parentId: string | null }> = [];

  for (const node of diff.current) {
    const entryId = idByRelativePath.get(node.relativePath);
    if (!entryId) continue;

    parentUpdates.push({
      id: entryId,
      parentId: node.parentRelativePath
        ? (idByRelativePath.get(node.parentRelativePath) ?? null)
        : null
    });
  }

  for (const batch of chunkArray(parentUpdates, UPDATE_BATCH_SIZE)) {
    await Promise.all(
      batch.map((item) =>
        prisma.fileEntry.update({
          where: { id: item.id },
          data: {
            parentId: item.parentId,
            deletedAt: null
          }
        })
      )
    );
  }

  const freshEntries = await prisma.fileEntry.findMany({
    where: { diskId: disk.id, deletedAt: null },
    orderBy: { relativePath: 'asc' }
  });

  let snapshot: Prisma.InputJsonValue | null = null;

  if (freshEntries.length <= SNAPSHOT_MAX_ENTRIES) {
    const tree = buildDiskTreeResponse({
      diskId: disk.code,
      diskName: disk.name,
      rootPath: disk.rootPath,
      status: DiskStatus.ACTIVE,
      lastScan: now,
      entries: freshEntries
    });

    snapshot = toJsonSafe(tree);
  }

  console.log(
    `[SCAN ${scanJobId}] snapshot entries=${freshEntries.length}, saved=${freshEntries.length <= SNAPSHOT_MAX_ENTRIES}`
  );

  const activities = buildActivities(diff, disk.id, scanJobId);

  if (activities.length > 0) {
    await prisma.diskActivity.createMany({ data: activities });
  }

  await prisma.disk.update({
    where: { id: disk.id },
    data: {
      status: DiskStatus.ACTIVE,
      lastScanAt: now,
      lastFullScanAt: scanType === ScanType.FULL ? now : undefined,
      lastDiffScanAt: scanType === ScanType.DIFFERENTIAL ? now : undefined,
      lastActivityAt: activities.length > 0 ? now : undefined,
      lastTreeSnapshot: snapshot
    }
  });

  const summary: ScanSummary = {
    added: diff.added.length,
    modified: diff.modified.length,
    renamed: diff.renamed.length,
    deleted: diff.deleted.length,
    totalIndexed: diff.current.length
  };

  return summary;
}

function buildActivities(
  diff: ScanDiff,
  diskId: string,
  scanJobId: string
): Prisma.DiskActivityCreateManyInput[] {
  return [
    ...diff.added.map((node) => ({
      diskId,
      scanJobId,
      activityType: ActivityType.ADDED,
      path: node.fullPath,
      details: {
        name: node.name,
        entryType: node.entryType,
        size: node.size?.toString() ?? null,
        modifiedAt: node.modifiedAt?.toISOString() ?? null
      }
    })),
    ...diff.modified.map((change) => ({
      diskId,
      scanJobId,
      activityType: ActivityType.MODIFIED,
      path: change.after.fullPath,
      details: {
        previousModifiedAt: change.before.modifiedAt?.toISOString() ?? null,
        modifiedAt: change.after.modifiedAt?.toISOString() ?? null,
        previousSize: change.before.size?.toString() ?? null,
        size: change.after.size?.toString() ?? null
      }
    })),
    ...diff.renamed.map((change) => ({
      diskId,
      scanJobId,
      activityType: ActivityType.RENAMED,
      path: change.after.fullPath,
      previousPath: change.before.fullPath,
      details: {
        inode: change.after.inode,
        fingerprint: change.after.fingerprint
      }
    })),
    ...diff.deleted.map((entry) => ({
      diskId,
      scanJobId,
      activityType: ActivityType.DELETED,
      path: entry.fullPath,
      details: {
        name: entry.name,
        entryType: entry.entryType
      }
    }))
  ];
}

function mapNodeToCreate(
  diskId: string,
  node: ScannedNode
): Prisma.FileEntryCreateManyInput {
  return {
    diskId,
    entryType: node.entryType,
    name: node.name,
    relativePath: node.relativePath,
    fullPath: node.fullPath,
    extension: node.extension,
    size: node.size,
    modifiedAt: node.modifiedAt,
    inode: node.inode,
    fingerprint: node.fingerprint,
    metadata: node.metadata,
    deletedAt: null,
    parentId: null
  };
}

function mapNodeToUpdate(
  node: Omit<ScannedNode, 'parentRelativePath'>
): Prisma.FileEntryUncheckedUpdateInput {
  return {
    entryType: node.entryType,
    name: node.name,
    relativePath: node.relativePath,
    fullPath: node.fullPath,
    extension: node.extension,
    size: node.size,
    modifiedAt: node.modifiedAt,
    inode: node.inode,
    fingerprint: node.fingerprint,
    metadata: node.metadata,
    deletedAt: null,
    parentId: null
  };
}

function nodeWithoutParent(node: ScannedNode) {
  const { parentRelativePath: _parentRelativePath, ...rest } = node;
  return rest;
}

function hasEntryChanged(existing: FileEntry, node: ScannedNode) {
  return (
    existing.name !== node.name ||
    existing.entryType !== node.entryType ||
    existing.extension !== node.extension ||
    String(existing.size ?? '') !== String(node.size ?? '') ||
    existing.modifiedAt?.getTime() !== node.modifiedAt?.getTime() ||
    existing.fingerprint !== node.fingerprint
  );
}

function buildUniqueLookup<T>(
  entries: T[],
  accessor: (value: T) => string | null | undefined
) {
  const counts = new Map<string, number>();

  for (const entry of entries) {
    const key = accessor(entry);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const unique = new Map<string, T>();

  for (const entry of entries) {
    const key = accessor(entry);
    if (!key) continue;
    if (counts.get(key) === 1) {
      unique.set(key, entry);
    }
  }

  return unique;
}

function buildFingerprint(params: {
  entryType: EntryType;
  extension: string | null;
  size: bigint | null;
  modifiedAt: Date | null;
  name: string;
}) {
  if (params.entryType === EntryType.FILE) {
    return [
      params.entryType,
      params.extension ?? '',
      params.size?.toString() ?? '',
      params.modifiedAt?.getTime() ?? ''
    ].join(':');
  }

  return [
    params.entryType,
    params.name.toLowerCase(),
    params.modifiedAt?.getTime() ?? ''
  ].join(':');
}

function normalizePath(value: string) {
  return value.split(path.sep).filter(Boolean).join('/');
}

function isIgnorableFsError(error: unknown) {
  if (!error || typeof error !== 'object') return false;

  const code =
    'code' in error ? String((error as { code?: unknown }).code) : '';

  return ['EPERM', 'EACCES', 'EBUSY', 'ENOENT'].includes(code);
}

function shouldSkipEntry(
  name: string,
  absolutePath: string,
  options: ResolvedScanOptions
) {
  if (options.excludedNames.has(name)) {
    return true;
  }

  if (options.excludeHidden && name.startsWith('.')) {
    return true;
  }

  const lowerPath = absolutePath.toLowerCase();

  if (
    lowerPath.includes('\\$recycle.bin') ||
    lowerPath.includes('\\system volume information') ||
    lowerPath.includes('\\windows\\temp') ||
    lowerPath.includes('\\programdata\\microsoft\\search')
  ) {
    return true;
  }

  return false;
}

function shouldSkipExtension(
  extension: string | null,
  options: ResolvedScanOptions
) {
  if (!extension) return false;
  return options.excludedExtensions.has(extension.toLowerCase());
}

function toJsonSafe<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_, currentValue) =>
      typeof currentValue === 'bigint'
        ? currentValue.toString()
        : currentValue
    )
  );
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}