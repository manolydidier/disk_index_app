import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/require-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SETTINGS_ID = 1;

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

async function ensureSettings() {
  return prisma.automationSettings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID }
  });
}

function jsonSafe<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_, currentValue) =>
      typeof currentValue === 'bigint' ? currentValue.toString() : currentValue
    )
  );
}

export async function GET() {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  try {
    const settings = await ensureSettings();

    const disks = await prisma.disk.findMany({
      orderBy: { code: 'asc' },
      include: {
        automationPreference: true
      }
    });

    return NextResponse.json(
      jsonSafe({
        settings: {
          ...settings,
          ignoredRoots: asStringArray(settings.ignoredRoots),
          ignoredPathPatterns: asStringArray(settings.ignoredPathPatterns),
          notifyEmailRecipients: asStringArray(settings.notifyEmailRecipients)
        },
        disks: disks.map((disk) => ({
          id: disk.id,
          code: disk.code,
          name: disk.name,
          rootPath: disk.rootPath,
          status: disk.status,
          preference: disk.automationPreference
            ? {
                ...disk.automationPreference,
                ignoredPaths: asStringArray(disk.automationPreference.ignoredPaths)
              }
            : null
        }))
      })
    );
  } catch (error) {
    console.error('GET /api/automation/settings ERROR:', error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Impossible de charger les paramètres.'
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json().catch(() => ({}));
    const settingsInput = body.settings ?? {};
    const diskPreferences = Array.isArray(body.diskPreferences)
      ? body.diskPreferences
      : [];
    const resetNotificationPreferences = Boolean(
      body.resetNotificationPreferences
    );

    await ensureSettings();

    if (resetNotificationPreferences) {
      await prisma.automationSettings.update({
        where: { id: SETTINGS_ID },
        data: {
          ignoredRoots: [],
          ignoredPathPatterns: []
        }
      });

      await prisma.diskAutomationPreference.updateMany({
        data: {
          monitorEnabled: true,
          notifyOnConnect: true,
          notifyOnChange: true,
          autoUpdateWithoutPrompt: false,
          muted: false,
          ignoredPaths: [],
          lastPromptAt: null
        }
      });
    }

    await prisma.automationSettings.update({
      where: { id: SETTINGS_ID },
      data: {
        isEnabled: Boolean(settingsInput.isEnabled),
        detectNewDisks: Boolean(settingsInput.detectNewDisks),
        watchIndexedDisks: Boolean(settingsInput.watchIndexedDisks),
        confirmBeforeUpdate: Boolean(settingsInput.confirmBeforeUpdate),
        autoUpdateWithoutPrompt: Boolean(settingsInput.autoUpdateWithoutPrompt),
        showSystemNotifications: Boolean(settingsInput.showSystemNotifications),
        ignoredRoots: Array.isArray(settingsInput.ignoredRoots)
          ? settingsInput.ignoredRoots
          : [],
        ignoredPathPatterns: Array.isArray(settingsInput.ignoredPathPatterns)
          ? settingsInput.ignoredPathPatterns
          : [],
        notificationCooldownSeconds: Number(
          settingsInput.notificationCooldownSeconds ?? 30
        ),
        changeDebounceSeconds: Number(settingsInput.changeDebounceSeconds ?? 8),
        lowSpacePercentThreshold: Math.min(
          90,
          Math.max(1, Number(settingsInput.lowSpacePercentThreshold ?? 10))
        ),
        notifyEmailEnabled: Boolean(settingsInput.notifyEmailEnabled),
        notifyEmailRecipients: Array.isArray(settingsInput.notifyEmailRecipients)
          ? settingsInput.notifyEmailRecipients
          : []
      }
    });

    for (const pref of diskPreferences) {
      if (!pref?.diskId) continue;

      await prisma.diskAutomationPreference.upsert({
        where: { diskId: pref.diskId },
        update: {
          monitorEnabled: Boolean(pref.monitorEnabled),
          notifyOnConnect: Boolean(pref.notifyOnConnect),
          notifyOnChange: Boolean(pref.notifyOnChange),
          autoUpdateWithoutPrompt: Boolean(pref.autoUpdateWithoutPrompt),
          muted: Boolean(pref.muted),
          ignoredPaths: Array.isArray(pref.ignoredPaths)
            ? pref.ignoredPaths
            : [],
          scheduledScanEnabled: Boolean(pref.scheduledScanEnabled),
          scheduledScanIntervalHours: Math.min(
            168,
            Math.max(1, Number(pref.scheduledScanIntervalHours ?? 24))
          )
        },
        create: {
          diskId: pref.diskId,
          monitorEnabled: Boolean(pref.monitorEnabled),
          notifyOnConnect: Boolean(pref.notifyOnConnect),
          notifyOnChange: Boolean(pref.notifyOnChange),
          autoUpdateWithoutPrompt: Boolean(pref.autoUpdateWithoutPrompt),
          muted: Boolean(pref.muted),
          ignoredPaths: Array.isArray(pref.ignoredPaths)
            ? pref.ignoredPaths
            : [],
          scheduledScanEnabled: Boolean(pref.scheduledScanEnabled),
          scheduledScanIntervalHours: Math.min(
            168,
            Math.max(1, Number(pref.scheduledScanIntervalHours ?? 24))
          )
        }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PUT /api/automation/settings ERROR:', error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Impossible de sauvegarder les paramètres.'
      },
      { status: 500 }
    );
  }
}