import 'server-only';
import {
  AutomationActionState,
  AutomationEventType,
  DiskStatus,
  Prisma,
  ScanStatus,
  ScanType
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { startDiskScan } from '@/lib/scanner';
import { queueAgentScanCommand } from '@/lib/agent/request-scan';
import { sendMail } from '@/lib/email';
import {
  findDiskByRootPathCaseInsensitive,
  generateNextDiskCode
} from '@/lib/disk-code';
import {
  listConnectedDevices,
  type DetectedDevice
} from '@/lib/automation/device-discovery';
import {
  getFs,
  getFsPromises,
  getPath
} from '@/lib/server/node-runtime';

const { access, readdir, statfs } = getFsPromises();
const { watch } = getFs();
const path = getPath();

type NativeWatcher = {
  close: () => void;
  on?: (event: string, listener: (...args: any[]) => void) => any;
};

type AutomationSettingsSnapshot = {
  isEnabled: boolean;
  detectNewDisks: boolean;
  watchIndexedDisks: boolean;
  confirmBeforeUpdate: boolean;
  autoUpdateWithoutPrompt: boolean;
  showSystemNotifications: boolean;
  ignoredRoots: string[];
  ignoredPathPatterns: string[];
  notificationCooldownSeconds: number;
  changeDebounceSeconds: number;
  lowSpacePercentThreshold: number;
  notifyEmailEnabled: boolean;
  notifyEmailRecipients: string[];
};

type DiskPreferenceSnapshot = {
  monitorEnabled: boolean;
  notifyOnConnect: boolean;
  notifyOnChange: boolean;
  autoUpdateWithoutPrompt: boolean;
  muted: boolean;
  ignoredPaths: string[];
  lastPromptAt: Date | null;
};

type BufferedChange = {
  changed: number;
  renamed: number;
  samplePaths: Set<string>;
  timer: NodeJS.Timeout | null;
};

const DEFAULT_SETTINGS_ID = 1;
const STALE_JOB_MS = 10 * 60 * 1000;
const DEVICE_POLL_MS = 10_000;
const WATCHER_REFRESH_MS = 15_000;
const CAPACITY_CHECK_MS = 5 * 60_000;
const SCHEDULED_SCAN_CHECK_MS = 10 * 60_000;

let unhandledHooksRegistered = false;

function registerUnhandledHooks() {
  if (unhandledHooksRegistered) return;
  unhandledHooksRegistered = true;

  process.on('unhandledRejection', (reason) => {
    console.error('[AUTOMATION] unhandledRejection:', reason);
  });

  process.on('uncaughtException', (error) => {
    console.error('[AUTOMATION] uncaughtException:', error);
  });
}

declare global {
  // eslint-disable-next-line no-var
  var __diskIndexerAutomationDaemon:
    | {
        started: boolean;
        stop?: () => void;
      }
    | undefined;
}

function normalizeRoot(input: string) {
  const resolved = path.resolve(input);

  if (process.platform === 'win32') {
    return resolved.replace(/[\\/]+$/, '\\').toLowerCase();
  }

  return resolved.replace(/[\\/]+$/, '').toLowerCase();
}

function normalizeWatchPath(input: string) {
  return input.replace(/\//g, '\\').toLowerCase();
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => String(item).trim())
    .filter(Boolean);
}

function isIgnorableFsError(error: unknown) {
  if (!error || typeof error !== 'object') return false;

  const code =
    'code' in error ? String((error as { code?: unknown }).code) : '';

  return ['EPERM', 'EACCES', 'ENOENT', 'EBUSY'].includes(code);
}

function isBlockedWindowsEntryName(name: string) {
  const normalized = name.trim().toLowerCase();

  if (
    normalized === '$recycle.bin' ||
    normalized === 'system volume information' ||
    normalized === 'config.msi'
  ) {
    return true;
  }

  if (/^found\.\d+$/i.test(name)) {
    return true;
  }

  return false;
}

async function buildSafeDirectoryWatchTargets(rootPath: string) {
  try {
    const entries = await readdir(rootPath, { withFileTypes: true });

    return entries
      .filter((entry: any) => entry.isDirectory?.())
      .filter((entry: any) => !isBlockedWindowsEntryName(entry.name))
      .map((entry: any) => path.join(rootPath, entry.name));
  } catch (error) {
    if (isIgnorableFsError(error)) {
      return [];
    }

    throw error;
  }
}

async function ensureSettingsRow() {
  return prisma.automationSettings.upsert({
    where: { id: DEFAULT_SETTINGS_ID },
    update: {},
    create: {
      id: DEFAULT_SETTINGS_ID
    }
  });
}

async function getSettingsSnapshot(): Promise<AutomationSettingsSnapshot> {
  const settings = await ensureSettingsRow();

  return {
    isEnabled: settings.isEnabled,
    detectNewDisks: settings.detectNewDisks,
    watchIndexedDisks: settings.watchIndexedDisks,
    confirmBeforeUpdate: settings.confirmBeforeUpdate,
    autoUpdateWithoutPrompt: settings.autoUpdateWithoutPrompt,
    showSystemNotifications: settings.showSystemNotifications,
    ignoredRoots: asStringArray(settings.ignoredRoots),
    ignoredPathPatterns: asStringArray(settings.ignoredPathPatterns),
    notificationCooldownSeconds: settings.notificationCooldownSeconds,
    changeDebounceSeconds: settings.changeDebounceSeconds,
    lowSpacePercentThreshold: settings.lowSpacePercentThreshold,
    notifyEmailEnabled: settings.notifyEmailEnabled,
    notifyEmailRecipients: asStringArray(settings.notifyEmailRecipients)
  };
}

async function ensureDiskPreference(diskId: string) {
  const existing = await prisma.diskAutomationPreference.findUnique({
    where: { diskId }
  });

  if (existing) {
    return existing;
  }

  try {
    return await prisma.diskAutomationPreference.create({
      data: { diskId }
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const createdByOther = await prisma.diskAutomationPreference.findUnique({
        where: { diskId }
      });

      if (createdByOther) {
        return createdByOther;
      }
    }

    throw error;
  }
}

async function getDiskPreferenceSnapshot(
  diskId: string
): Promise<DiskPreferenceSnapshot> {
  const pref = await ensureDiskPreference(diskId);

  return {
    monitorEnabled: pref.monitorEnabled,
    notifyOnConnect: pref.notifyOnConnect,
    notifyOnChange: pref.notifyOnChange,
    autoUpdateWithoutPrompt: pref.autoUpdateWithoutPrompt,
    muted: pref.muted,
    ignoredPaths: asStringArray(pref.ignoredPaths),
    lastPromptAt: pref.lastPromptAt
  };
}

async function sendSystemNotification(_title: string, _message: string) {
  // Notifications système désactivées pour éviter les problèmes de bundle
}

class AutomationDaemon {
  private started = false;
  private initializedDeviceSnapshot = false;
  private knownConnectedRoots = new Set<string>();
  private watchers = new Map<string, NativeWatcher[]>();
  private changeBuffers = new Map<string, BufferedChange>();
  private devicePollTimer: NodeJS.Timeout | null = null;
  private watcherRefreshTimer: NodeJS.Timeout | null = null;
  private capacityCheckTimer: NodeJS.Timeout | null = null;
  private scheduledScanTimer: NodeJS.Timeout | null = null;

  async start() {
    if (this.started) return;
    this.started = true;

    registerUnhandledHooks();
    await ensureSettingsRow();

    void this.pollDevices(true).catch((error) => {
      console.error('[AUTOMATION] pollDevices initial error:', error);
    });

    void this.refreshWatchers().catch((error) => {
      console.error('[AUTOMATION] refreshWatchers initial error:', error);
    });

    this.devicePollTimer = setInterval(() => {
      void this.pollDevices(false).catch((error) => {
        console.error('[AUTOMATION] pollDevices error:', error);
      });
    }, DEVICE_POLL_MS);

    this.watcherRefreshTimer = setInterval(() => {
      void this.refreshWatchers().catch((error) => {
        console.error('[AUTOMATION] refreshWatchers error:', error);
      });
    }, WATCHER_REFRESH_MS);

    void this.checkDiskCapacity().catch((error) => {
      console.error('[AUTOMATION] checkDiskCapacity initial error:', error);
    });

    this.capacityCheckTimer = setInterval(() => {
      void this.checkDiskCapacity().catch((error) => {
        console.error('[AUTOMATION] checkDiskCapacity error:', error);
      });
    }, CAPACITY_CHECK_MS);

    void this.runScheduledScans().catch((error) => {
      console.error('[AUTOMATION] runScheduledScans initial error:', error);
    });

    this.scheduledScanTimer = setInterval(() => {
      void this.runScheduledScans().catch((error) => {
        console.error('[AUTOMATION] runScheduledScans error:', error);
      });
    }, SCHEDULED_SCAN_CHECK_MS);

    console.log('[AUTOMATION] daemon démarré');
  }

  stop() {
    for (const watcherList of this.watchers.values()) {
      for (const watcher of watcherList) {
        try {
          watcher.close();
        } catch {
          // ignore
        }
      }
    }

    this.watchers.clear();

    for (const buffer of this.changeBuffers.values()) {
      if (buffer.timer) clearTimeout(buffer.timer);
    }

    this.changeBuffers.clear();

    if (this.devicePollTimer) clearInterval(this.devicePollTimer);
    if (this.watcherRefreshTimer) clearInterval(this.watcherRefreshTimer);
    if (this.capacityCheckTimer) clearInterval(this.capacityCheckTimer);
    if (this.scheduledScanTimer) clearInterval(this.scheduledScanTimer);

    this.devicePollTimer = null;
    this.watcherRefreshTimer = null;
    this.capacityCheckTimer = null;
    this.scheduledScanTimer = null;
    this.started = false;
  }

  private async pollDevices(primeOnly: boolean) {
    const settings = await getSettingsSnapshot();
    const connected = await listConnectedDevices();

    const normalizedRoots = new Set(
      connected.map((device) => normalizeRoot(device.rootPath))
    );

    if (!this.initializedDeviceSnapshot || primeOnly) {
      this.knownConnectedRoots = normalizedRoots;
      this.initializedDeviceSnapshot = true;
      await this.markDisconnectedKnownDisks();
      return;
    }

    for (const device of connected) {
      const normalizedRoot = normalizeRoot(device.rootPath);

      if (!this.knownConnectedRoots.has(normalizedRoot)) {
        await this.handleNewDevice(device, settings);
      }
    }

    await this.markDisconnectedKnownDisks();
    this.knownConnectedRoots = normalizedRoots;
  }

  private async handleNewDevice(
    device: DetectedDevice,
    settings: AutomationSettingsSnapshot
  ) {
    if (!settings.isEnabled || !settings.detectNewDisks) {
      return;
    }

    const normalizedRoot = normalizeRoot(device.rootPath);

    if (
      settings.ignoredRoots.some(
        (item) => normalizeRoot(item) === normalizedRoot
      )
    ) {
      return;
    }

    const disk = await findDiskByRootPathCaseInsensitive(device.rootPath);

    if (disk) {
      const pref = await getDiskPreferenceSnapshot(disk.id);

      if (!pref.monitorEnabled || pref.muted || !pref.notifyOnConnect) {
        return;
      }

      if (disk.status === 'DISCONNECTED') {
        await prisma.disk.update({
          where: { id: disk.id },
          data: { status: DiskStatus.ACTIVE }
        });
      }

      if (settings.autoUpdateWithoutPrompt || pref.autoUpdateWithoutPrompt) {
        await this.markStaleRunningJobsFailed(disk.id);
        await startDiskScan(disk.id, ScanType.DIFFERENTIAL);

        await prisma.automationEvent.create({
          data: {
            diskId: disk.id,
            eventType: AutomationEventType.NEW_DISK_DETECTED,
            title: `Disque reconnecté : ${disk.name}`,
            message: `Le disque ${disk.name} a été détecté et son index a été relancé automatiquement.`,
            requiresAction: false,
            actionState: AutomationActionState.AUTO_STARTED,
            isRead: false,
            isDismissed: false,
            dedupeKey: `disk:${disk.id}:connected:auto`
          }
        });

        if (settings.showSystemNotifications) {
          await sendSystemNotification(
            `Disque détecté : ${disk.name}`,
            `Le disque a été reconnecté et l’indexation a démarré automatiquement.`
          );
        }

        return;
      }

      if (!settings.confirmBeforeUpdate) {
        await this.markStaleRunningJobsFailed(disk.id);
        await startDiskScan(disk.id, ScanType.DIFFERENTIAL);
        return;
      }

      const created = await this.createEventIfAllowed({
        diskId: disk.id,
        eventType: AutomationEventType.NEW_DISK_DETECTED,
        title: `Un disque a été détecté : ${disk.name}`,
        message: `Un nouveau disque a été détecté : ${disk.name}. Voulez-vous mettre à jour son index maintenant ?`,
        payload: {
          rootPath: device.rootPath,
          displayName: disk.name,
          knownDisk: true
        },
        dedupeKey: `disk:${disk.id}:connected`,
        cooldownSeconds: settings.notificationCooldownSeconds,
        updatePromptTimestampForDiskId: disk.id
      });

      if (created && settings.showSystemNotifications) {
        await sendSystemNotification(
          `Disque détecté : ${disk.name}`,
          `Voulez-vous mettre à jour son index maintenant ?`
        );
      }

      return;
    }

    if (settings.autoUpdateWithoutPrompt) {
      const code = await generateNextDiskCode();

      const createdDisk = await prisma.disk.create({
        data: {
          code,
          name: device.displayName || code,
          rootPath: device.rootPath,
          description: 'Disque détecté automatiquement',
          status: DiskStatus.ACTIVE
        }
      });

      await ensureDiskPreference(createdDisk.id);
      await startDiskScan(createdDisk.id, ScanType.FULL);

      await prisma.automationEvent.create({
        data: {
          diskId: createdDisk.id,
          eventType: AutomationEventType.NEW_DISK_DETECTED,
          title: `Nouveau disque détecté : ${createdDisk.name}`,
          message: `Le disque ${createdDisk.name} a été ajouté et l’indexation a démarré automatiquement.`,
          requiresAction: false,
          actionState: AutomationActionState.AUTO_STARTED,
          dedupeKey: `new-root:${normalizedRoot}:auto`
        }
      });

      if (settings.showSystemNotifications) {
        await sendSystemNotification(
          `Nouveau disque détecté`,
          `Le disque ${createdDisk.name} a été indexé automatiquement.`
        );
      }

      return;
    }

    if (!settings.confirmBeforeUpdate) {
      return;
    }

    const created = await this.createEventIfAllowed({
      diskId: null,
      eventType: AutomationEventType.NEW_DISK_DETECTED,
      title: `Un nouveau disque a été détecté : ${device.displayName}`,
      message: `Un nouveau disque a été détecté : ${device.displayName}. Voulez-vous mettre à jour son index maintenant ?`,
      payload: {
        rootPath: device.rootPath,
        displayName: device.displayName,
        knownDisk: false
      },
      dedupeKey: `new-root:${normalizedRoot}`,
      cooldownSeconds: settings.notificationCooldownSeconds,
      updatePromptTimestampForDiskId: null
    });

    if (created && settings.showSystemNotifications) {
      await sendSystemNotification(
        `Nouveau disque détecté`,
        `${device.displayName} a été détecté. Voulez-vous mettre à jour son index ?`
      );
    }
  }

  private async markDisconnectedKnownDisks() {
    const disks = await prisma.disk.findMany({
      where: {
        isEnabled: true
      },
      select: {
        id: true,
        rootPath: true,
        status: true
      }
    });

    for (const disk of disks) {
      let isAccessible = false;

      try {
        await access(disk.rootPath);
        isAccessible = true;
      } catch {
        isAccessible = false;
      }

      if (!isAccessible && disk.status !== 'DISCONNECTED') {
        await prisma.disk.update({
          where: { id: disk.id },
          data: { status: DiskStatus.DISCONNECTED }
        });
      }

      if (isAccessible && disk.status === 'DISCONNECTED') {
        await prisma.disk.update({
          where: { id: disk.id },
          data: { status: DiskStatus.ACTIVE }
        });
      }
    }
  }

  private async checkDiskCapacity() {
    const settings = await getSettingsSnapshot();

    const disks = await prisma.disk.findMany({
      where: {
        isEnabled: true,
        sourceType: 'SERVER',
        status: { not: DiskStatus.DISCONNECTED }
      },
      select: { id: true, name: true, rootPath: true }
    });

    for (const disk of disks) {
      let stats: { blocks: bigint; bavail: bigint; bsize: bigint };

      try {
        stats = await statfs(disk.rootPath, { bigint: true });
      } catch (error) {
        if (isIgnorableFsError(error)) continue;
        console.warn(
          `[AUTOMATION] statfs impossible pour ${disk.rootPath}:`,
          error instanceof Error ? error.message : error
        );
        continue;
      }

      const totalBytes = stats.blocks * stats.bsize;
      const freeBytes = stats.bavail * stats.bsize;

      await prisma.disk.update({
        where: { id: disk.id },
        data: { totalBytes, freeBytes, spaceCheckedAt: new Date() }
      });

      if (totalBytes <= BigInt(0)) continue;

      const freePercent = Number((freeBytes * BigInt(1000)) / totalBytes) / 10;

      if (freePercent > settings.lowSpacePercentThreshold) continue;

      const created = await this.createEventIfAllowed({
        diskId: disk.id,
        eventType: AutomationEventType.LOW_DISK_SPACE,
        title: `Espace disque faible : ${disk.name}`,
        message: `Il reste seulement ${freePercent.toFixed(1)} % d’espace libre sur ${disk.name}.`,
        payload: { freePercent, totalBytes: totalBytes.toString(), freeBytes: freeBytes.toString() },
        dedupeKey: `disk:${disk.id}:low-space`,
        cooldownSeconds: Math.max(settings.notificationCooldownSeconds, 6 * 3600),
        updatePromptTimestampForDiskId: null
      });

      if (created && settings.showSystemNotifications) {
        await sendSystemNotification(
          `Espace disque faible : ${disk.name}`,
          `Il reste ${freePercent.toFixed(1)} % d’espace libre.`
        );
      }
    }
  }

  private async runScheduledScans() {
    const preferences = await prisma.diskAutomationPreference.findMany({
      where: {
        scheduledScanEnabled: true,
        disk: { isEnabled: true }
      },
      include: { disk: true }
    });

    const now = Date.now();

    for (const pref of preferences) {
      const disk = pref.disk;
      if (!disk || disk.status === DiskStatus.DISCONNECTED) continue;

      const intervalMs = Math.max(1, pref.scheduledScanIntervalHours) * 3_600_000;
      const lastRun = pref.lastScheduledScanAt?.getTime() ?? 0;

      if (now - lastRun < intervalMs) continue;

      try {
        if (disk.sourceType === 'SERVER') {
          await this.markStaleRunningJobsFailed(disk.id);
          await startDiskScan(disk.id, ScanType.FULL);
        } else {
          const result = await queueAgentScanCommand(disk.id, 'FULL');
          if (!result.success) {
            console.warn(
              `[AUTOMATION] scan planifié impossible pour ${disk.name}:`,
              result.error
            );
            continue;
          }
        }

        await prisma.diskAutomationPreference.update({
          where: { diskId: disk.id },
          data: { lastScheduledScanAt: new Date() }
        });
      } catch (error) {
        console.error(
          `[AUTOMATION] échec du scan planifié pour ${disk.name}:`,
          error instanceof Error ? error.message : error
        );
      }
    }
  }

  private closeDiskWatchers(diskId: string) {
    const watcherList = this.watchers.get(diskId);

    if (!watcherList) return;

    for (const watcher of watcherList) {
      try {
        watcher.close();
      } catch {
        // ignore
      }
    }

    this.watchers.delete(diskId);
  }

  private createNativeWatcher(
    diskId: string,
    rootPath: string,
    targetPath: string,
    recursive: boolean
  ): NativeWatcher | null {
    try {
      const watcher = watch(
        targetPath,
        {
          persistent: true,
          recursive
        },
        (eventType: string, filename: string | Buffer | null) => {
          const fileNameText = filename ? filename.toString() : '';
          const fullPath = fileNameText
            ? path.join(targetPath, fileNameText)
            : targetPath;

          const normalizedEvent =
            eventType === 'rename' ? 'rename' : 'change';

          void this.handleWatchedChange(diskId, normalizedEvent, fullPath);
        }
      ) as NativeWatcher;

      if (typeof watcher.on === 'function') {
        watcher.on('error', (error: unknown) => {
          console.warn(
            `[AUTOMATION] watcher error on ${rootPath}:`,
            error instanceof Error ? error.message : error
          );
        });
      }

      return watcher;
    } catch (error) {
      console.warn(
        `[AUTOMATION] impossible de watcher ${targetPath}:`,
        error instanceof Error ? error.message : error
      );
      return null;
    }
  }

  private async refreshWatchers() {
    const settings = await getSettingsSnapshot();

    if (!settings.isEnabled || !settings.watchIndexedDisks) {
      for (const diskId of this.watchers.keys()) {
        this.closeDiskWatchers(diskId);
      }
      return;
    }

    const disks = await prisma.disk.findMany({
      where: {
        isEnabled: true,
        status: {
          not: DiskStatus.DISCONNECTED
        }
      },
      include: {
        automationPreference: true
      }
    });

    const validDiskIds = new Set(disks.map((disk) => disk.id));

    for (const diskId of this.watchers.keys()) {
      if (!validDiskIds.has(diskId)) {
        this.closeDiskWatchers(diskId);
      }
    }

    for (const disk of disks) {
      const pref = disk.automationPreference;

      const monitorEnabled = pref ? pref.monitorEnabled : true;
      const muted = pref ? pref.muted : false;

      if (!monitorEnabled || muted) {
        this.closeDiskWatchers(disk.id);
        continue;
      }

      if (this.watchers.has(disk.id)) {
        continue;
      }

      try {
        await access(disk.rootPath);
      } catch {
        continue;
      }

      const childTargets = await buildSafeDirectoryWatchTargets(disk.rootPath);
      const watcherList: NativeWatcher[] = [];

      const rootWatcher = this.createNativeWatcher(
        disk.id,
        disk.rootPath,
        disk.rootPath,
        false
      );

      if (rootWatcher) {
        watcherList.push(rootWatcher);
      }

      for (const target of childTargets) {
        const childWatcher = this.createNativeWatcher(
          disk.id,
          disk.rootPath,
          target,
          true
        );

        if (childWatcher) {
          watcherList.push(childWatcher);
        }
      }

      if (watcherList.length > 0) {
        this.watchers.set(disk.id, watcherList);
      }
    }
  }

  private shouldIgnorePath(
    watchPath: string,
    globalPatterns: string[],
    diskPatterns: string[]
  ) {
    const normalized = normalizeWatchPath(watchPath);

    if (process.platform === 'win32') {
      if (
        normalized.includes('\\$recycle.bin') ||
        normalized.includes('\\system volume information') ||
        normalized.includes('\\config.msi')
      ) {
        return true;
      }

      const baseName = path.basename(normalized).toLowerCase();

      if (baseName.startsWith('found.')) {
        return true;
      }
    }

    const patterns = [...globalPatterns, ...diskPatterns].map((value) =>
      String(value).toLowerCase().trim()
    );

    return patterns.some((pattern) => pattern && normalized.includes(pattern));
  }

  private async handleWatchedChange(
    diskId: string,
    kind: 'change' | 'rename',
    targetPath: string
  ) {
    const settings = await getSettingsSnapshot();
    const pref = await getDiskPreferenceSnapshot(diskId);

    if (!settings.isEnabled || !settings.watchIndexedDisks) return;
    if (!pref.monitorEnabled || pref.muted) return;

    if (
      this.shouldIgnorePath(
        targetPath,
        settings.ignoredPathPatterns,
        pref.ignoredPaths
      )
    ) {
      return;
    }

    const existing = this.changeBuffers.get(diskId) ?? {
      changed: 0,
      renamed: 0,
      samplePaths: new Set<string>(),
      timer: null
    };

    if (kind === 'change') {
      existing.changed += 1;
    } else {
      existing.renamed += 1;
    }

    if (existing.samplePaths.size < 5) {
      existing.samplePaths.add(targetPath);
    }

    if (existing.timer) {
      clearTimeout(existing.timer);
    }

    existing.timer = setTimeout(() => {
      void this.flushBufferedChanges(diskId);
    }, Math.max(3, settings.changeDebounceSeconds) * 1000);

    this.changeBuffers.set(diskId, existing);
  }

  private async flushBufferedChanges(diskId: string) {
    const buffer = this.changeBuffers.get(diskId);
    if (!buffer) return;

    this.changeBuffers.delete(diskId);

    const disk = await prisma.disk.findUnique({
      where: { id: diskId },
      select: {
        id: true,
        name: true,
        code: true,
        rootPath: true,
        status: true
      }
    });

    if (!disk || disk.status === DiskStatus.DISCONNECTED) {
      return;
    }

    const settings = await getSettingsSnapshot();
    const pref = await getDiskPreferenceSnapshot(diskId);

    if (
      !pref.notifyOnChange &&
      !pref.autoUpdateWithoutPrompt &&
      !settings.autoUpdateWithoutPrompt
    ) {
      return;
    }

    const summaryText = [
      buffer.changed ? `${buffer.changed} modification(s)` : null,
      buffer.renamed
        ? `${buffer.renamed} changement(s) structurels / renommage(s)`
        : null
    ]
      .filter(Boolean)
      .join(', ');

    if (settings.autoUpdateWithoutPrompt || pref.autoUpdateWithoutPrompt) {
      await this.markStaleRunningJobsFailed(diskId);
      await startDiskScan(diskId, ScanType.DIFFERENTIAL);

      await prisma.automationEvent.create({
        data: {
          diskId,
          eventType: AutomationEventType.DISK_CHANGED,
          title: `Modifications détectées sur ${disk.name}`,
          message: `Des modifications ont été détectées sur le disque ${disk.name}. La mise à jour de l’index a démarré automatiquement.`,
          payload: {
            summaryText,
            samplePaths: Array.from(buffer.samplePaths)
          },
          requiresAction: false,
          actionState: AutomationActionState.AUTO_STARTED,
          dedupeKey: `disk:${diskId}:changes:auto`
        }
      });

      if (settings.showSystemNotifications) {
        await sendSystemNotification(
          `Modifications détectées sur ${disk.name}`,
          `L’index a été relancé automatiquement.`
        );
      }

      return;
    }

    if (!settings.confirmBeforeUpdate || !pref.notifyOnChange) {
      return;
    }

    const created = await this.createEventIfAllowed({
      diskId,
      eventType: AutomationEventType.DISK_CHANGED,
      title: `Des modifications ont été détectées sur ${disk.name}`,
      message: `Des modifications ont été détectées sur le disque ${disk.name}. Voulez-vous mettre à jour l’index ?`,
      payload: {
        summaryText,
        samplePaths: Array.from(buffer.samplePaths),
        counts: {
          changed: buffer.changed,
          renamed: buffer.renamed
        }
      },
      dedupeKey: `disk:${diskId}:changes`,
      cooldownSeconds: settings.notificationCooldownSeconds,
      updatePromptTimestampForDiskId: diskId
    });

    if (created && settings.showSystemNotifications) {
      await sendSystemNotification(
        `Modifications détectées sur ${disk.name}`,
        `Voulez-vous mettre à jour l’index ?`
      );
    }
  }

  private async createEventIfAllowed(input: {
    diskId: string | null;
    eventType: AutomationEventType;
    title: string;
    message: string;
    payload: Record<string, unknown>;
    dedupeKey: string;
    cooldownSeconds: number;
    updatePromptTimestampForDiskId: string | null;
  }) {
    const recentLimit = new Date(
      Date.now() - Math.max(5, input.cooldownSeconds) * 1000
    );

    const existing = await prisma.automationEvent.findFirst({
      where: {
        dedupeKey: input.dedupeKey,
        isDismissed: false,
        createdAt: {
          gte: recentLimit
        }
      }
    });

    if (existing) {
      return null;
    }

    const event = await prisma.automationEvent.create({
      data: {
        diskId: input.diskId,
        eventType: input.eventType,
        title: input.title,
        message: input.message,
        payload: input.payload as Prisma.InputJsonValue,
        dedupeKey: input.dedupeKey,
        requiresAction: true,
        actionState: AutomationActionState.PENDING
      }
    });

    if (input.updatePromptTimestampForDiskId) {
      try {
        await prisma.diskAutomationPreference.update({
          where: { diskId: input.updatePromptTimestampForDiskId },
          data: { lastPromptAt: new Date() }
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2025'
        ) {
          await ensureDiskPreference(input.updatePromptTimestampForDiskId);
          await prisma.diskAutomationPreference.update({
            where: { diskId: input.updatePromptTimestampForDiskId },
            data: { lastPromptAt: new Date() }
          });
        } else {
          throw error;
        }
      }
    }

    const settings = await getSettingsSnapshot();
    if (settings.notifyEmailEnabled && settings.notifyEmailRecipients.length > 0) {
      void sendMail({
        to: settings.notifyEmailRecipients,
        subject: input.title,
        text: input.message
      }).catch((error) => {
        console.error('[AUTOMATION] envoi email échoué:', error);
      });
    }

    return event;
  }

  private async markStaleRunningJobsFailed(diskId: string) {
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
        errorMessage:
          'Job interrompu ou bloqué, marqué automatiquement comme échoué.'
      }
    });
  }
}

export async function startAutomationDaemon() {
  if (globalThis.__diskIndexerAutomationDaemon?.started) {
    return;
  }

  const daemon = new AutomationDaemon();

  globalThis.__diskIndexerAutomationDaemon = {
    started: true,
    stop: () => daemon.stop()
  };

  try {
    await daemon.start();
  } catch (error) {
    console.error('[AUTOMATION] échec du démarrage du daemon:', error);

    globalThis.__diskIndexerAutomationDaemon = {
      started: false,
      stop: () => daemon.stop()
    };
  }
}