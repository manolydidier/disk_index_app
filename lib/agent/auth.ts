import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

export function generateAgentToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function hashAgentToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function authenticateAgentRequest(request: Request) {
  const token = request.headers.get('x-agent-token')?.trim();

  if (!token) {
    throw new Error('Agent non authentifié : token manquant.');
  }

  const tokenHash = hashAgentToken(token);

  const auth = await prisma.agentAuthToken.findUnique({
    where: { tokenHash },
    include: {
      agentDevice: true
    }
  });

  if (!auth) {
    throw new Error('Token agent invalide.');
  }

  if (auth.revokedAt) {
    throw new Error('Token agent révoqué.');
  }

  if (auth.expiresAt && auth.expiresAt < new Date()) {
    throw new Error('Token agent expiré.');
  }

  if (!auth.agentDevice) {
    throw new Error("Aucun agent lié à ce token.");
  }

  if (auth.agentDevice.status === 'DISABLED') {
    throw new Error('Agent désactivé.');
  }

  await prisma.agentAuthToken.update({
    where: { id: auth.id },
    data: {
      lastUsedAt: new Date()
    }
  });

  console.log('[AGENT AUTH] Authentification réussie:', {
    agentId: auth.agentDevice.id,
    machineId: auth.agentDevice.machineId,
    hostName: auth.agentDevice.hostName
  });

  return auth.agentDevice;
}