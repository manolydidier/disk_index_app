import 'server-only';
import { getChildProcess } from '@/lib/server/node-runtime';

const { spawn } = getChildProcess();

export type DetectedDevice = {
  rootPath: string;
  displayName: string;
  isRemovable: boolean;
};

type PowerShellDisk = {
  DeviceID?: string;
  VolumeName?: string;
  DriveType?: number;
};

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

    child.stdout.on('data', (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);

    child.on('close', (code: number) => {
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

async function listWindowsDisks(): Promise<DetectedDevice[]> {
  const command =
    'Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID,VolumeName,DriveType | ConvertTo-Json -Compress';

  const raw = await runPowerShell(command);
  const parsed = JSON.parse(raw) as PowerShellDisk | PowerShellDisk[];

  const disks = Array.isArray(parsed) ? parsed : [parsed];

  return disks
    .filter((disk) => disk?.DeviceID)
    .map((disk) => {
      const deviceId = String(disk.DeviceID).trim().toUpperCase();
      const rootPath = `${deviceId}\\`;
      const label = String(disk.VolumeName ?? '').trim();
      const driveType = Number(disk.DriveType ?? 0);

      return {
        rootPath,
        displayName: label || rootPath,
        isRemovable: driveType === 2
      };
    })
    .filter((disk) => disk.rootPath !== 'C:\\');
}

export async function listConnectedDevices(): Promise<DetectedDevice[]> {
  if (process.platform === 'win32') {
    return listWindowsDisks();
  }

  return [];
}