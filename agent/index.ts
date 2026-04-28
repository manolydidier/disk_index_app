import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import crypto from 'crypto';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { mkdir, readFile, writeFile, lstat, opendir } from 'fs/promises';

type AgentConfig = {
  machineId: string;
  token?: string;
};

type DetectedDevice = {
  remoteDiskKey: string;
  rootPath: string;
  displayName: string;
  isRemovable: boolean;
};

type IndexedEntry = {
  name: string;
  relativePath: string;
  type: 'file' | 'folder';
  extension?: string | null;
  size?: number | null;
  modifiedAt?: string | null;
};

type PowerShellVolume = {
  DriveLetter?: string;
  FileSystemLabel?: string;
  DriveType?: string;
};

const SERVER_URL = String(process.env.AGENT_SERVER_URL ?? '').replace(/\/+$/, '');
const REGISTRATION_SECRET = String(
  process.env.AGENT_REGISTRATION_SECRET ?? ''
).trim();
const SCAN_ROOTS = String(process.env.AGENT_SCAN_ROOTS ?? '').trim();

const CONFIG_DIR = path.join(os.homedir(), '.disk-indexer-agent');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

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

function shouldSkipName(name: string) {
  const blocked = new Set([
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
    'found.005'
  ]);

  return blocked.has(name);
}

function isIgnorableFsError(error: unknown) {
  if (!error || typeof error !== 'object') return false;

  const code = 'code' in error ? String((error as { code?: unknown }).code) : '';
  return ['EPERM', 'EACCES', 'EBUSY', 'ENOENT'].includes(code);
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
    'Get-Volume | Select-Object DriveLetter,FileSystemLabel,DriveType | ConvertTo-Json -Compress';

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
          driveType.includes('cd')
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
  timeoutMs = 20000
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

async function scanFilesystem(rootPath: string): Promise<IndexedEntry[]> {
  const output: IndexedEntry[] = [];
  let scannedCount = 0;

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

        if (dirent.isDirectory()) {
          output.push({
            name: dirent.name,
            relativePath,
            type: 'folder'
          });

          await walk(absolutePath);
        } else {
          const extension =
            path.extname(dirent.name).replace('.', '').toLowerCase() || null;

          output.push({
            name: dirent.name,
            relativePath,
            type: 'file',
            extension,
            size: stats.size,
            modifiedAt: stats.mtime ? new Date(stats.mtime).toISOString() : null
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
    120000
  );

  const data = payload as {
    error?: string;
    indexedEntries?: number;
    code?: string;
    raw?: string;
  };

  if (!response.ok) {
    throw new Error(
      data.error || data.raw || `Impossible d'envoyer l'index. HTTP ${response.status}`
    );
  }

  console.log(
    `[AGENT] ${device.rootPath} -> ${data.code ?? '?'} | ${data.indexedEntries ?? 0} entrées`
  );
}

async function runCycle() {
  assertEnv();

  console.log('[AGENT] SERVER_URL =', SERVER_URL);
  console.log('[AGENT] SCAN_ROOTS =', SCAN_ROOTS || '(auto)');

  const { token } = await ensureRegistered();

  console.log('[AGENT] Envoi heartbeat...');
  await sendHeartbeat(token);

  console.log('[AGENT] Lecture des volumes Windows...');
  const devices = await listWindowsVolumes();
  const selectedDevices = resolveRootsToScan(devices);

  if (selectedDevices.length === 0) {
    console.log('[AGENT] Aucun disque à scanner.');
    return;
  }

  for (const device of selectedDevices) {
    console.log(`[AGENT] Scan de ${device.rootPath} (${device.displayName})...`);
    const entries = await scanFilesystem(device.rootPath);
    await uploadFullIndex(token, device, entries);
  }
}

async function main() {
  try {
    await runCycle();
    console.log('[AGENT] Terminé.');
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