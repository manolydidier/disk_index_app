import 'server-only';
import {
  AgentCommandStatus,
  AgentCommandType,
  DiskSourceType
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { resolveAgentDeviceStatus } from '@/lib/agent/device-status';

export type QueueAgentScanResult =
  | { success: true; alreadyQueued: boolean; commandId: string }
  | { success: false; error: string };

export async function queueAgentScanCommand(
  diskId: string,
  scanType: 'FULL' | 'DIFFERENTIAL'
): Promise<QueueAgentScanResult> {
  const disk = await prisma.disk.findUnique({
    where: { id: diskId },
    include: { agentDevice: true }
  });

  if (!disk) {
    return { success: false, error: 'Disque introuvable.' };
  }

  if (disk.sourceType !== DiskSourceType.AGENT || !disk.agentDeviceId) {
    return { success: false, error: 'Ce disque n’est pas géré par un agent.' };
  }

  if (!disk.remoteDiskKey) {
    return { success: false, error: 'Le disque agent ne possède pas de remoteDiskKey.' };
  }

  const effectiveStatus = disk.agentDevice
    ? resolveAgentDeviceStatus(disk.agentDevice.status, disk.agentDevice.lastHeartbeatAt)
    : 'OFFLINE';

  if (effectiveStatus !== 'ONLINE') {
    return { success: false, error: 'Agent hors ligne.' };
  }

  const existing = await prisma.agentCommand.findFirst({
    where: {
      diskId,
      agentDeviceId: disk.agentDeviceId,
      status: {
        in: [AgentCommandStatus.PENDING, AgentCommandStatus.CLAIMED, AgentCommandStatus.RUNNING]
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  if (existing) {
    return { success: true, alreadyQueued: true, commandId: existing.id };
  }

  const command = await prisma.agentCommand.create({
    data: {
      agentDeviceId: disk.agentDeviceId,
      diskId: disk.id,
      commandType: scanType === 'FULL' ? AgentCommandType.FULL_SCAN : AgentCommandType.DIFFERENTIAL_SCAN,
      payload: {
        requestedFrom: 'schedule',
        requestedAt: new Date().toISOString(),
        remoteDiskKey: disk.remoteDiskKey,
        rootPath: disk.rootPath
      },
      status: AgentCommandStatus.PENDING,
      phase: 'EN_ATTENTE',
      progressPercent: 0
    }
  });

  return { success: true, alreadyQueued: false, commandId: command.id };
}
