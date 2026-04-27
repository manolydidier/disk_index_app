import { access, stat } from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type OpenPathAction = 'open-folder' | 'open-item' | 'reveal-item';

type OpenPathPayload = {
  absolutePath?: string;
  entryType?: 'FILE' | 'FOLDER';
  action?: OpenPathAction;
};

function normalizeForComparison(value: string) {
  return path.resolve(value).toLowerCase();
}

function isPathInsideRoot(targetPath: string, rootPath: string) {
  const normalizedTarget = normalizeForComparison(targetPath);
  const normalizedRoot = normalizeForComparison(rootPath);

  return (
    normalizedTarget === normalizedRoot ||
    normalizedTarget.startsWith(`${normalizedRoot}${path.sep}`) ||
    normalizedTarget.startsWith(`${normalizedRoot}/`) ||
    normalizedTarget.startsWith(`${normalizedRoot}\\`)
  );
}

async function openFolderOnHost(targetFolderPath: string) {
  const platform = process.platform;

  if (platform === 'win32') {
    const child = spawn('explorer.exe', [targetFolderPath], {
      detached: true,
      stdio: 'ignore'
    });
    child.unref();
    return;
  }

  if (platform === 'darwin') {
    const child = spawn('open', [targetFolderPath], {
      detached: true,
      stdio: 'ignore'
    });
    child.unref();
    return;
  }

  const child = spawn('xdg-open', [targetFolderPath], {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
}

async function openItemOnHost(targetPath: string) {
  const platform = process.platform;

  if (platform === 'win32') {
    const child = spawn('cmd', ['/c', 'start', '', targetPath], {
      detached: true,
      stdio: 'ignore'
    });
    child.unref();
    return;
  }

  if (platform === 'darwin') {
    const child = spawn('open', [targetPath], {
      detached: true,
      stdio: 'ignore'
    });
    child.unref();
    return;
  }

  const child = spawn('xdg-open', [targetPath], {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
}

async function revealItemOnHost(targetPath: string) {
  const platform = process.platform;

  if (platform === 'win32') {
    const child = spawn('explorer.exe', ['/select,', targetPath], {
      detached: true,
      stdio: 'ignore'
    });
    child.unref();
    return;
  }

  if (platform === 'darwin') {
    const child = spawn('open', ['-R', targetPath], {
      detached: true,
      stdio: 'ignore'
    });
    child.unref();
    return;
  }

  const child = spawn('xdg-open', [path.dirname(targetPath)], {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as OpenPathPayload;
    const absolutePath = payload.absolutePath?.trim();
    const action = payload.action ?? 'open-folder';

    if (!absolutePath) {
      return NextResponse.json(
        { error: 'Le chemin absolu est requis.' },
        { status: 400 }
      );
    }

    const disks = await prisma.disk.findMany({
      where: {
        isEnabled: true
      },
      select: {
        id: true,
        code: true,
        name: true,
        status: true,
        rootPath: true
      }
    });

    const matchingDisk = disks
      .filter((disk) => isPathInsideRoot(absolutePath, disk.rootPath))
      .sort((a, b) => b.rootPath.length - a.rootPath.length)[0];

    if (!matchingDisk) {
      return NextResponse.json(
        {
          error:
            "Ce chemin ne correspond à aucun disque géré par l'application."
        },
        { status: 403 }
      );
    }

    if (matchingDisk.status === 'DISCONNECTED') {
      return NextResponse.json(
        {
          error: 'Le disque associé est marqué comme non connecté.'
        },
        { status: 409 }
      );
    }

    await access(absolutePath);

    const stats = await stat(absolutePath);
    const isFile = payload.entryType === 'FILE' || stats.isFile();

    if (action === 'open-folder') {
      const folderToOpen = isFile ? path.dirname(absolutePath) : absolutePath;
      await openFolderOnHost(folderToOpen);

      return NextResponse.json({
        message: `Le dossier a été ouvert : ${folderToOpen}`
      });
    }

    if (action === 'open-item') {
      await openItemOnHost(absolutePath);

      return NextResponse.json({
        message: `L'élément a été ouvert : ${absolutePath}`
      });
    }

    if (action === 'reveal-item') {
      await revealItemOnHost(absolutePath);

      return NextResponse.json({
        message: `L'élément a été révélé : ${absolutePath}`
      });
    }

    return NextResponse.json(
      { error: 'Action non supportée.' },
      { status: 400 }
    );
  } catch (error) {
    console.error('OPEN PATH ERROR:', error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Impossible d'ouvrir l'élément."
      },
      { status: 500 }
    );
  }
}