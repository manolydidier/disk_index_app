import { NextResponse } from 'next/server';
import { listConnectedDevices } from '@/lib/automation/device-discovery';
import { requireSession } from '@/lib/require-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  try {
    const devices = await listConnectedDevices();

    return NextResponse.json(
      devices.map((device) => ({
        rootPath: device.rootPath,
        displayName: device.displayName,
        isRemovable: device.isRemovable
      }))
    );
  } catch (error) {
    console.error('GET /api/system/disks ERROR:', error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Impossible de détecter les disques.'
      },
      { status: 500 }
    );
  }
}