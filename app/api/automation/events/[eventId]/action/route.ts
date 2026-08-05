import path from 'path';
import { NextResponse } from 'next/server';
import {
  AutomationActionState,
  AutomationEventType,
  DiskStatus,
  ScanType
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { startDiskScan } from '@/lib/scanner';
import {
  findDiskByRootPathCaseInsensitive,
  generateNextDiskCode
} from '@/lib/disk-code';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type EventAction =
  | 'update-now'
  | 'later'
  | 'ignore'
  | 'mute-disk'
  | 'never-ask';

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? '') as EventAction;

  const event = await prisma.automationEvent.findUnique({
    where: { id: eventId },
    include: {
      disk: true
    }
  });

  if (!event) {
    return NextResponse.json(
      { error: 'Notification introuvable.' },
      { status: 404 }
    );
  }

  const payload =
    event.payload && typeof event.payload === 'object' && !Array.isArray(event.payload)
      ? (event.payload as Record<string, unknown>)
      : {};

  if (action === 'later' || action === 'ignore') {
    await prisma.automationEvent.update({
      where: { id: event.id },
      data: {
        isRead: true,
        isDismissed: true,
        actedAt: new Date(),
        actionState: AutomationActionState.DISMISSED
      }
    });

    return NextResponse.json({ success: true, message: 'Notification ignorée.' });
  }

  if (action === 'mute-disk') {
    if (!event.diskId) {
      return NextResponse.json(
        { error: 'Aucun disque associé à cette notification.' },
        { status: 400 }
      );
    }

    await prisma.diskAutomationPreference.upsert({
      where: { diskId: event.diskId },
      update: {
        notifyOnChange: false,
        muted: true
      },
      create: {
        diskId: event.diskId,
        notifyOnChange: false,
        muted: true
      }
    });

    await prisma.automationEvent.update({
      where: { id: event.id },
      data: {
        isRead: true,
        isDismissed: true,
        actedAt: new Date(),
        actionState: AutomationActionState.MUTED
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Les notifications ont été désactivées pour ce disque.'
    });
  }

  if (action === 'never-ask') {
    if (event.diskId) {
      await prisma.diskAutomationPreference.upsert({
        where: { diskId: event.diskId },
        update: {
          notifyOnConnect: false,
          muted: true
        },
        create: {
          diskId: event.diskId,
          notifyOnConnect: false,
          muted: true
        }
      });
    } else {
      const settings = await prisma.automationSettings.upsert({
        where: { id: 1 },
        update: {},
        create: { id: 1 }
      });

      const ignoredRoots = asStringArray(settings.ignoredRoots);
      const rootPath = String(payload.rootPath ?? '').trim();

      if (rootPath && !ignoredRoots.includes(rootPath)) {
        ignoredRoots.push(rootPath);
      }

      await prisma.automationSettings.update({
        where: { id: 1 },
        data: {
          ignoredRoots
        }
      });
    }

    await prisma.automationEvent.update({
      where: { id: event.id },
      data: {
        isRead: true,
        isDismissed: true,
        actedAt: new Date(),
        actionState: AutomationActionState.MUTED
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Ce disque ne demandera plus de confirmation.'
    });
  }

  if (action === 'update-now') {
    let diskId = event.diskId;

    if (!diskId) {
      const rootPath = String(payload.rootPath ?? '').trim();
      const displayName =
        String(payload.displayName ?? '').trim() ||
        path.basename(rootPath) ||
        'Disque détecté';

      if (!rootPath) {
        return NextResponse.json(
          { error: 'Chemin du disque manquant.' },
          { status: 400 }
        );
      }

      const existingDisk = await findDiskByRootPathCaseInsensitive(rootPath);

      if (existingDisk) {
        diskId = existingDisk.id;
      } else {
        const code = await generateNextDiskCode();

        const createdDisk = await prisma.disk.create({
          data: {
            code,
            name: displayName,
            rootPath,
            description: 'Disque ajouté automatiquement depuis une notification',
            status: DiskStatus.ACTIVE
          }
        });

        await prisma.diskAutomationPreference.upsert({
          where: { diskId: createdDisk.id },
          update: {},
          create: { diskId: createdDisk.id }
        });

        diskId = createdDisk.id;
      }
    }

    await startDiskScan(
      diskId,
      event.eventType === AutomationEventType.NEW_DISK_DETECTED
        ? ScanType.FULL
        : ScanType.DIFFERENTIAL
    );

    await prisma.automationEvent.update({
      where: { id: event.id },
      data: {
        isRead: true,
        isDismissed: true,
        actedAt: new Date(),
        actionState: AutomationActionState.ACCEPTED
      }
    });

    return NextResponse.json({
      success: true,
      message: 'La mise à jour de l’index a démarré en arrière-plan.'
    });
  }

  return NextResponse.json(
    { error: 'Action non supportée.' },
    { status: 400 }
  );
}