import { AgentDeviceStatus } from '@prisma/client';

// The agent heartbeats every 15s (see agent/index.ts's HEARTBEAT_INTERVAL_MS).
// Heartbeat writes flip status to ONLINE but nothing ever flips it back —
// a device whose agent process died months ago still reads "ONLINE" forever.
// Treat a heartbeat older than this as proof the agent isn't actually running.
const HEARTBEAT_STALE_MS = 60_000;

export function resolveAgentDeviceStatus(
  status: AgentDeviceStatus,
  lastHeartbeatAt: Date | string | null
): AgentDeviceStatus {
  if (status === AgentDeviceStatus.DISABLED) {
    return status;
  }

  if (!lastHeartbeatAt) {
    return AgentDeviceStatus.OFFLINE;
  }

  const lastHeartbeatMs =
    lastHeartbeatAt instanceof Date
      ? lastHeartbeatAt.getTime()
      : new Date(lastHeartbeatAt).getTime();

  const isStale = Date.now() - lastHeartbeatMs > HEARTBEAT_STALE_MS;

  return isStale ? AgentDeviceStatus.OFFLINE : AgentDeviceStatus.ONLINE;
}
