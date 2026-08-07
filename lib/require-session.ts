import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

export async function requireSession() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return {
      session: null,
      unauthorized: NextResponse.json(
        { error: 'Non autorisé. Connecte-toi puis réessaie.' },
        { status: 401 }
      )
    };
  }

  return { session, unauthorized: null as null };
}
