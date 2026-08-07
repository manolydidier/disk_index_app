import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import crypto from 'crypto';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { mkdir, readFile, writeFile, lstat, opendir, unlink } from 'fs/promises';

type AgentConfig = {
  machineId: string;
  token?: string;
};

type DetectedDevice = {
  remoteDiskKey: string;
  rootPath: string;
  displayName: string;
  isRemovable: boolean;
  driveType: string | null;
  totalBytes: number | null;
  freeBytes: number | null;
};

type IndexedEntry = {
  name: string;
  relativePath: string;
  type: 'file' | 'folder';
  extension?: string | null;
  size?: number | null;
  modifiedAt?: string | null;
  contentText?: string | null;
};

type PowerShellVolume = {
  DriveLetter?: string;
  FileSystemLabel?: string;
  DriveType?: string;
  Size?: number;
  SizeRemaining?: number;
};

type AgentCommand = {
  id: string;
  commandType:
    | 'FULL_SCAN'
    | 'DIFFERENTIAL_SCAN'
    | 'REFRESH_AVAILABLE_DISKS'
    | 'DELETE_FILE';
  status:
    | 'PENDING'
    | 'CLAIMED'
    | 'RUNNING'
    | 'COMPLETED'
    | 'FAILED'
    | 'CANCELED';
  payload?: {
    fileEntryId?: string;
    fullPath?: string;
    relativePath?: string;
  } | null;
  disk: {
    id: string;
    code: string;
    name: string;
    rootPath: string;
    remoteDiskKey: string | null;
    sourceType: 'SERVER' | 'AGENT';
  } | null;
};

type ScanProgress = {
  scannedCount: number;
  currentRelativePath: string;
};

const SERVER_URL = String(process.env.AGENT_SERVER_URL ?? '').replace(/\/+$/, '');
const REGISTRATION_SECRET = String(
  process.env.AGENT_REGISTRATION_SECRET ?? ''
).trim();
const SCAN_ROOTS = String(process.env.AGENT_SCAN_ROOTS ?? '').trim();

const CONFIG_DIR = path.join(os.homedir(), '.disk-indexer-agent');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

const HEARTBEAT_INTERVAL_MS = 15_000;
const INVENTORY_INTERVAL_MS = 30_000;
const COMMAND_POLL_INTERVAL_MS = 5_000;
const COMMAND_STATUS_UPDATE_EVERY_ITEMS = 500;

function assertEnv() {
  if (!SERVER_URL) {
    throw new Error('AGENT_SERVER_URL manquant.');
  }

  if (!REGISTRATION_SECRET) {
    throw new Error('AGENT_REGISTRATION_SECRET manquant.');
  }
}

async function ensureConfigDir() {
  await mkdir(CONFIG_DIR, { recursive: true });
}

async function loadConfig(): Promise<AgentConfig | null> {
  try {
    const raw = await readFile(CONFIG_FILE, 'utf8');
    return JSON.parse(raw) as AgentConfig;
  } catch {
    return null;
  }
}

async function saveConfig(config: AgentConfig) {
  await ensureConfigDir();
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
}

function createMachineId() {
  return `${os.hostname()}-${crypto.randomUUID()}`;
}

function normalizeRootPath(input: string) {
  let value = input.trim().replace(/\//g, '\\');

  if (/^[a-zA-Z]$/.test(value)) {
    value = `${value.toUpperCase()}:\\`;
  } else if (/^[a-zA-Z]:$/.test(value)) {
    value = `${value.toUpperCase()}\\`;
  } else if (/^[a-zA-Z]:\\/.test(value)) {
    value = `${value[0].toUpperCase()}${value.slice(1)}`;
  }

  return value;
}

function normalizeRelativePath(value: string) {
  return value.replace(/\\/g, '/').replace(/^\/+/, '').trim();
}

// Recreated per call before, which meant rebuilding this Set on every single
// directory entry during a scan — hoisted to module scope since it's static.
const BLOCKED_NAMES = new Set([
  'System Volume Information',
  '$RECYCLE.BIN',
  'pagefile.sys',
  'hiberfil.sys',
  'swapfile.sys',
  'Config.Msi',
  'found.000',
  'found.001',
  'found.002',
  'found.003',
  'found.004',
  'found.005',
  // Mirrors the server-side scanner's defaults (lib/scanner.ts) — these
  // folders dominate item counts (npm caches, build output, VCS metadata)
  // without adding useful index data, and were previously walked in full.
  'node_modules',
  '.git',
  '.next',
  '.cache',
  'AppData'
]);

const BLOCKED_EXTENSIONS = new Set(['sys', 'tmp', 'log', 'etl']);

function shouldSkipName(name: string) {
  if (BLOCKED_NAMES.has(name)) return true;
  return name.startsWith('.');
}

function shouldSkipExtension(extension: string | null) {
  if (!extension) return false;
  return BLOCKED_EXTENSIONS.has(extension);
}

function isIgnorableFsError(error: unknown) {
  if (!error || typeof error !== 'object') return false;

  const code = 'code' in error ? String((error as { code?: unknown }).code) : '';
  return ['EPERM', 'EACCES', 'EBUSY', 'ENOENT'].includes(code);
}

// MVP content search: only plain-text-ish files under a size cap get their
// content read and uploaded for full-text matching in /api/search. No PDF/
// Office extraction — that's a separate, heavier feature. Kept in sync with
// the same allow-list in lib/scanner.ts (server-side scanning).
const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'json', 'csv', 'tsv', 'log', 'xml', 'yaml', 'yml',
  'ini', 'conf', 'cfg', 'env', 'toml',
  'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'py', 'java', 'c', 'h', 'cpp', 'hpp',
  'cs', 'go', 'rs', 'php', 'rb', 'css', 'scss', 'less', 'html', 'htm', 'sql',
  'sh', 'ps1', 'bat'
]);
const MAX_CONTENT_READ_BYTES = 512 * 1024;
const MAX_STORED_CONTENT_CHARS = 200_000;

function shouldExtractContent(extension: string | null, size: number) {
  return Boolean(
    extension && TEXT_EXTENSIONS.has(extension) && size > 0 && size <= MAX_CONTENT_READ_BYTES
  );
}

async function readTextContent(absolutePath: string): Promise<string | null> {
  try {
    const raw = await readFile(absolutePath, 'utf8');
    if (raw.indexOf(String.fromCharCode(0)) !== -1) return null;
    return raw.length > MAX_STORED_CONTENT_CHARS
      ? raw.slice(0, MAX_STORED_CONTENT_CHARS)
      : raw;
  } catch {
    return null;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runPowerShell(command: string) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command],
      {
        windowsHide: true
      }
    );

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);

    child.on('close', (code) => {
      if (code !== 0) {
        reject(
          new Error(stderr || `PowerShell a échoué avec le code ${code}.`)
        );
        return;
      }

      resolve(stdout);
    });
  });
}

async function listWindowsVolumes(): Promise<DetectedDevice[]> {
  const command =
    'Get-Volume | Select-Object DriveLetter,FileSystemLabel,DriveType,Size,SizeRemaining | ConvertTo-Json -Compress';

  const raw = await runPowerShell(command);
  const parsed = JSON.parse(raw) as PowerShellVolume | PowerShellVolume[];
  const volumes = Array.isArray(parsed) ? parsed : [parsed];

  return volumes
    .filter((volume) => volume?.DriveLetter)
    .map((volume) => {
      const driveLetter = String(volume.DriveLetter ?? '').trim().toUpperCase();
      const rootPath = `${driveLetter}:\\`;
      const label = String(volume.FileSystemLabel ?? '').trim();
      const driveType = String(volume.DriveType ?? '').trim().toLowerCase();

      return {
        remoteDiskKey: rootPath,
        rootPath,
        displayName: label || rootPath,
        isRemovable:
          driveType.includes('removable') ||
          driveType.includes('usb') ||
          driveType.includes('cd'),
        driveType: driveType || null,
        totalBytes: typeof volume.Size === 'number' ? volume.Size : null,
        freeBytes:
          typeof volume.SizeRemaining === 'number' ? volume.SizeRemaining : null
      };
    });
}

function resolveRootsToScan(devices: DetectedDevice[]) {
  const manualRoots = SCAN_ROOTS
    ? SCAN_ROOTS.split(/[;,]/)
        .map((item) => normalizeRootPath(item))
        .filter(Boolean)
    : [];

  if (manualRoots.length > 0) {
    return devices.filter((device) => manualRoots.includes(device.rootPath));
  }

  return devices.filter((device) => device.rootPath !== 'C:\\');
}

async function fetchJsonWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 20_000
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal
    });

    const text = await response.text();
    let payload: unknown = {};

    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = { raw: text };
    }

    return { response, payload };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Erreur réseau vers ${url}: ${error.message}`);
    }

    throw new Error(`Erreur réseau inconnue vers ${url}.`);
  } finally {
    clearTimeout(timeout);
  }
}

async function registerAgent(machineId: string) {
  const { response, payload } = await fetchJsonWithTimeout(
    `${SERVER_URL}/api/agent/register`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        registrationSecret: REGISTRATION_SECRET,
        machineId,
        hostName: os.hostname(),
        userLabel: os.userInfo().username,
        osName: `${os.platform()} ${os.release()}`,
        appVersion: '1.0.0'
      })
    }
  );

  const data = payload as { token?: string; error?: string; raw?: string };

  if (!response.ok || !data.token) {
    throw new Error(
      data.error ||
        data.raw ||
        `Impossible d'enregistrer l'agent. HTTP ${response.status}`
    );
  }

  return data.token;
}

async function ensureRegistered() {
  const existing = await loadConfig();
  const machineId = existing?.machineId || createMachineId();
  let token = existing?.token;

  if (!token) {
    console.log('[AGENT] Enregistrement initial...');
    token = await registerAgent(machineId);
    await saveConfig({ machineId, token });
    console.log('[AGENT] Agent enregistré avec succès.');
  }

  return { machineId, token };
}

async function sendHeartbeat(token: string) {
  const { response, payload } = await fetchJsonWithTimeout(
    `${SERVER_URL}/api/agent/heartbeat`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-token': token
      },
      body: JSON.stringify({
        hostName: os.hostname(),
        userLabel: os.userInfo().username,
        osName: `${os.platform()} ${os.release()}`,
        appVersion: '1.0.0'
      })
    }
  );

  const data = payload as { error?: string; raw?: string };

  if (!response.ok) {
    throw new Error(
      data.error || data.raw || `Heartbeat impossible. HTTP ${response.status}`
    );
  }
}

async function syncAvailableDisks(
  token: string,
  devices: DetectedDevice[]
) {
  const { response, payload } = await fetchJsonWithTimeout(
    `${SERVER_URL}/api/agent/disks/sync-available`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-token': token
      },
      body: JSON.stringify({
        disks: devices.map((device) => ({
          remoteDiskKey: device.remoteDiskKey,
          rootPath: device.rootPath,
          displayName: device.displayName,
          driveType: device.driveType,
          isRemovable: device.isRemovable,
          isConnected: true,
          totalBytes: device.totalBytes,
          freeBytes: device.freeBytes
        }))
      })
    }
  );

  const data = payload as { error?: string; raw?: string; count?: number };

  if (!response.ok) {
    throw new Error(
      data.error ||
        data.raw ||
        'Impossible de synchroniser les disques disponibles.'
    );
  }

  console.log(
    `[AGENT] Disques disponibles synchronisés : ${data.count ?? devices.length}`
  );
}

async function fetchNextCommand(token: string) {
  const { response, payload } = await fetchJsonWithTimeout(
    `${SERVER_URL}/api/agent/commands/next`,
    {
      method: 'GET',
      headers: {
        'x-agent-token': token
      }
    }
  );

  const data = payload as {
    error?: string;
    command?: AgentCommand | null;
  };

  if (!response.ok) {
    throw new Error(data.error || 'Impossible de récupérer la prochaine commande.');
  }

  return data.command ?? null;
}

async function updateCommandStatus(
  token: string,
  commandId: string,
  body: {
    status?: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELED';
    progressPercent?: number;
    phase?: string;
    currentPath?: string;
    errorMessage?: string;
    result?: unknown;
  }
) {
  const { response, payload } = await fetchJsonWithTimeout(
    `${SERVER_URL}/api/agent/commands/${commandId}/status`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-token': token
      },
      body: JSON.stringify(body)
    }
  );

  const data = payload as { error?: string; raw?: string };

  if (!response.ok) {
    throw new Error(
      data.error || data.raw || 'Impossible de mettre à jour la commande.'
    );
  }
}

async function scanFilesystem(
  rootPath: string,
  onProgress?: (progress: ScanProgress) => Promise<void> | void
): Promise<IndexedEntry[]> {
  const output: IndexedEntry[] = [];
  let scannedCount = 0;
  let lastProgressNotified = 0;

  async function walk(currentAbsolutePath: string) {
    let directory: Awaited<ReturnType<typeof opendir>>;

    try {
      directory = await opendir(currentAbsolutePath);
    } catch (error) {
      if (isIgnorableFsError(error)) {
        return;
      }
      throw error;
    }

    for await (const dirent of directory) {
      if (dirent.isSymbolicLink()) {
        continue;
      }

      if (shouldSkipName(dirent.name)) {
        continue;
      }

      const absolutePath = path.join(currentAbsolutePath, dirent.name);

      const extension = dirent.isFile()
        ? path.extname(dirent.name).replace('.', '').toLowerCase() || null
        : null;

      if (shouldSkipExtension(extension)) {
        continue;
      }

      try {
        const stats = await lstat(absolutePath);
        const relativeFromRoot = path.relative(rootPath, absolutePath);
        const relativePath = normalizeRelativePath(relativeFromRoot);

        if (!relativePath) {
          continue;
        }

        scannedCount += 1;

        if (scannedCount % 500 === 0) {
          console.log(
            `[AGENT] ${rootPath} : ${scannedCount} éléments scannés... dernier = ${relativePath}`
          );
        }

        if (
          onProgress &&
          scannedCount - lastProgressNotified >= COMMAND_STATUS_UPDATE_EVERY_ITEMS
        ) {
          lastProgressNotified = scannedCount;
          await onProgress({
            scannedCount,
            currentRelativePath: relativePath
          });
        }

        if (dirent.isDirectory()) {
          output.push({
            name: dirent.name,
            relativePath,
            type: 'folder'
          });

          await walk(absolutePath);
        } else {
          const contentText = shouldExtractContent(extension, stats.size)
            ? await readTextContent(absolutePath)
            : null;

          output.push({
            name: dirent.name,
            relativePath,
            type: 'file',
            extension,
            size: stats.size,
            modifiedAt: stats.mtime ? new Date(stats.mtime).toISOString() : null,
            contentText
          });
        }
      } catch (error) {
        if (isIgnorableFsError(error)) {
          continue;
        }
        throw error;
      }
    }
  }

  await walk(rootPath);

  if (onProgress) {
    await onProgress({
      scannedCount,
      currentRelativePath: ''
    });
  }

  console.log(`[AGENT] Scan terminé pour ${rootPath} : ${scannedCount} éléments.`);
  return output.sort((a, b) =>
    a.relativePath.localeCompare(b.relativePath, 'fr')
  );
}

async function uploadFullIndex(
  token: string,
  device: DetectedDevice,
  entries: IndexedEntry[]
) {
  const { response, payload } = await fetchJsonWithTimeout(
    `${SERVER_URL}/api/agent/index/full`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-token': token
      },
      body: JSON.stringify({
        remoteDiskKey: device.remoteDiskKey,
        diskName: device.displayName,
        rootPath: device.rootPath,
        description: device.isRemovable
          ? 'Disque détecté par agent local (amovible)'
          : 'Disque détecté par agent local',
        isConnected: true,
        entries
      })
    },
    120_000
  );

  const data = payload as {
    error?: string;
    indexedEntries?: number;
    code?: string;
    raw?: string;
  };

  if (!response.ok) {
    throw new Error(
      data.error ||
        data.raw ||
        `Impossible d'envoyer l'index. HTTP ${response.status}`
    );
  }

  console.log(
    `[AGENT] ${device.rootPath} -> ${data.code ?? '?'} | ${data.indexedEntries ?? 0} entrées`
  );
}

async function executeAgentCommand(token: string, command: AgentCommand) {
  if (command.commandType === 'DELETE_FILE') {
    const fullPath = command.payload?.fullPath;

    if (!fullPath) {
      await updateCommandStatus(token, command.id, {
        status: 'FAILED',
        phase: 'ERREUR',
        errorMessage: 'Chemin du fichier manquant dans la commande.'
      });
      return;
    }

    await updateCommandStatus(token, command.id, {
      status: 'RUNNING',
      phase: 'SUPPRESSION',
      currentPath: fullPath,
      progressPercent: 50
    });

    try {
      await unlink(fullPath);
    } catch (error) {
      const code = (error as { code?: string })?.code;

      if (code !== 'ENOENT') {
        await updateCommandStatus(token, command.id, {
          status: 'FAILED',
          phase: 'ERREUR',
          currentPath: fullPath,
          errorMessage:
            error instanceof Error ? error.message : 'Suppression impossible.'
        });
        return;
      }
      // Already gone — treat as success, the index still needs updating.
    }

    await updateCommandStatus(token, command.id, {
      status: 'COMPLETED',
      phase: 'TERMINÉ',
      currentPath: fullPath,
      progressPercent: 100
    });

    return;
  }

  if (command.commandType === 'REFRESH_AVAILABLE_DISKS') {
    await updateCommandStatus(token, command.id, {
      status: 'RUNNING',
      phase: 'ACTUALISATION',
      progressPercent: 10
    });

    const devices = await listWindowsVolumes();
    await syncAvailableDisks(token, devices);

    await updateCommandStatus(token, command.id, {
      status: 'COMPLETED',
      phase: 'TERMINÉ',
      progressPercent: 100,
      result: {
        refreshed: devices.length
      }
    });

    return;
  }

  if (!command.disk?.remoteDiskKey) {
    await updateCommandStatus(token, command.id, {
      status: 'FAILED',
      phase: 'ERREUR',
      errorMessage: 'Disque ou remoteDiskKey introuvable.'
    });
    return;
  }

  const devices = await listWindowsVolumes();
  await syncAvailableDisks(token, devices);

  const scannableDevices = resolveRootsToScan(devices);
  const device = scannableDevices.find(
    (item) => item.remoteDiskKey === command.disk?.remoteDiskKey
  );

  if (!device) {
    await updateCommandStatus(token, command.id, {
      status: 'FAILED',
      phase: 'ERREUR',
      errorMessage:
        `Le disque ${command.disk.name} n'est pas disponible ou n'est pas autorisé par AGENT_SCAN_ROOTS.`
    });
    return;
  }

  await updateCommandStatus(token, command.id, {
    status: 'RUNNING',
    phase: 'INDEXATION',
    currentPath: device.rootPath,
    progressPercent: 5
  });

  const entries = await scanFilesystem(device.rootPath, async (progress) => {
    const progressPercent = Math.min(
      75,
      5 + Math.floor(progress.scannedCount / COMMAND_STATUS_UPDATE_EVERY_ITEMS) * 3
    );

    await updateCommandStatus(token, command.id, {
      status: 'RUNNING',
      phase: 'INDEXATION',
      currentPath: progress.currentRelativePath
        ? `${device.rootPath}${progress.currentRelativePath.replace(/\//g, '\\')}`
        : device.rootPath,
      progressPercent
    });
  });

  await updateCommandStatus(token, command.id, {
    status: 'RUNNING',
    phase: 'ENVOI',
    currentPath: device.rootPath,
    progressPercent: 90
  });

  await uploadFullIndex(token, device, entries);

  await updateCommandStatus(token, command.id, {
    status: 'COMPLETED',
    phase: 'TERMINÉ',
    currentPath: device.rootPath,
    progressPercent: 100,
    result: {
      indexedEntries: entries.length,
      // The agent always walks the full drive (there's no cheap way to know
      // what changed without walking it), but the server now diffs the
      // upload against what's indexed and only writes real changes — so a
      // DIFFERENTIAL_SCAN command is a genuine differential from the DB's
      // point of view even though the filesystem walk itself is a full one.
      mode: command.commandType === 'FULL_SCAN' ? 'FULL' : 'DIFFERENTIAL'
    }
  });
}

async function runPersistentLoop() {
  assertEnv();

  const registration = await ensureRegistered();
  const token = registration.token;

  let lastInventoryAt = 0;

  console.log('[AGENT] Mode persistant démarré.');

  while (true) {
    try {
      const now = Date.now();

      await sendHeartbeat(token);

      if (now - lastInventoryAt >= INVENTORY_INTERVAL_MS) {
        const devices = await listWindowsVolumes();
        console.log('[AGENT] Synchronisation des disques disponibles...');
        await syncAvailableDisks(token, devices);
        lastInventoryAt = now;
      }

      const command = await fetchNextCommand(token);

      if (command) {
        console.log(
          `[AGENT] Commande reçue: ${command.commandType} (${command.id})`
        );

        try {
          await executeAgentCommand(token, command);
        } catch (error) {
          await updateCommandStatus(token, command.id, {
            status: 'FAILED',
            phase: 'ERREUR',
            errorMessage:
              error instanceof Error
                ? error.message
                : 'Erreur inconnue pendant la commande.'
          });
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error('[AGENT] ERREUR BOUCLE:', error.message);
      } else {
        console.error('[AGENT] ERREUR BOUCLE:', error);
      }
    }

    await sleep(Math.min(HEARTBEAT_INTERVAL_MS, COMMAND_POLL_INTERVAL_MS));
  }
}

async function main() {
  try {
    console.log('[AGENT] SERVER_URL =', SERVER_URL);
    console.log('[AGENT] SCAN_ROOTS =', SCAN_ROOTS || '(auto)');
    await runPersistentLoop();
  } catch (error) {
    if (error instanceof Error) {
      console.error('[AGENT] ERREUR:', error.message);
      console.error('[AGENT] STACK:', error.stack);
    } else {
      console.error('[AGENT] ERREUR:', error);
    }

    process.exit(1);
  }
}

void main();