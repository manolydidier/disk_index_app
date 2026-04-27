import os from 'node:os';
import { NextResponse } from 'next/server';
import { getAvailableRoots } from '@/lib/system-roots';

export const runtime = 'nodejs';

export async function GET() {
  const roots = await getAvailableRoots();

  return NextResponse.json({
    platform: os.platform(),
    roots
  });
}
