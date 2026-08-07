import os from 'node:os';
import { NextResponse } from 'next/server';
import { getAvailableRoots } from '@/lib/system-roots';
import { requireSession } from '@/lib/require-session';

export const runtime = 'nodejs';

export async function GET() {
  const { unauthorized } = await requireSession();
  if (unauthorized) return unauthorized;

  const roots = await getAvailableRoots();

  return NextResponse.json({
    platform: os.platform(),
    roots
  });
}
