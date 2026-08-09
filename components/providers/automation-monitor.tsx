'use client';

import { useEffect, useMemo, useState } from 'react';
import { BellRing, Check, HardDrive, HardDriveDownload, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type AutomationEvent = {
  id: string;
  diskId: string | null;
  eventType: 'NEW_DISK_DETECTED' | 'DISK_CHANGED' | 'LOW_DISK_SPACE';
  title: string;
  message: string;
  payload: Record<string, unknown> | null;
  isDismissed: boolean;
  actionState: string;
  createdAt: string;
  disk?: {
    id: string;
    code: string;
    name: string;
    rootPath: string;
    status: string;
  } | null;
};

function getActions(event: AutomationEvent) {
  if (event.eventType === 'NEW_DISK_DETECTED') {
    return {
      primary: { action: 'update-now', label: 'Mettre à jour maintenant' },
      secondary: { action: 'later', label: 'Plus tard' },
      tertiary: { action: 'never-ask', label: 'Ne plus demander' }
    };
  }

  if (event.eventType === 'LOW_DISK_SPACE') {
    return {
      primary: { action: 'ignore', label: 'Compris' },
      secondary: null,
      tertiary: {
        action: 'mute-disk',
        label: 'Désactiver les notifications'
      }
    };
  }

  return {
    primary: { action: 'update-now', label: 'Mettre à jour' },
    secondary: { action: 'ignore', label: 'Ignorer' },
    tertiary: {
      action: 'mute-disk',
      label: 'Désactiver les notifications'
    }
  };
}

export function AutomationMonitor() {
  const [events, setEvents] = useState<AutomationEvent[]>([]);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [locallyHiddenIds, setLocallyHiddenIds] = useState<Set<string>>(
    () => new Set()
  );

  async function fetchEvents() {
    try {
      const response = await fetch('/api/automation/events', {
        cache: 'no-store'
      });

      const data = (await response.json().catch(() => [])) as AutomationEvent[];

      if (!response.ok) return;
      setEvents(Array.isArray(data) ? data : []);
    } catch {
      // silence
    }
  }

  useEffect(() => {
    void fetchEvents();

    const interval = window.setInterval(() => {
      void fetchEvents();
    }, 8000);

    return () => window.clearInterval(interval);
  }, []);

  async function runAction(eventId: string, action: string) {
    setLoadingAction(`${eventId}:${action}`);

    try {
      const response = await fetch(`/api/automation/events/${eventId}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action })
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || 'Action impossible.');
      }

      toast.success('Action exécutée', {
        description: payload.message || 'La demande a été prise en compte.'
      });

      await fetchEvents();
    } catch (error) {
      toast.error('Action impossible', {
        description:
          error instanceof Error ? error.message : 'Une erreur est survenue.'
      });
    } finally {
      setLoadingAction(null);
    }
  }

  const activeEvents = useMemo(
    () => events.filter((event) => !locallyHiddenIds.has(event.id)),
    [events, locallyHiddenIds]
  );
  const visibleEvents = useMemo(() => activeEvents.slice(0, 3), [activeEvents]);
  const hiddenCount = activeEvents.length - visibleEvents.length;

  if (visibleEvents.length === 0) {
    return null;
  }

  return (
    <>
      {hiddenCount > 0 ? (
        <div className="self-end rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
          +{hiddenCount} autre{hiddenCount > 1 ? 's' : ''} notification
          {hiddenCount > 1 ? 's' : ''} en attente
        </div>
      ) : null}

      {visibleEvents.map((event) => {
        const actions = getActions(event);

        return (
          <Card
            key={event.id}
            className="w-full animate-in border shadow-xl slide-in-from-bottom-4 fade-in-0"
          >
            <CardHeader className="pb-3">
              <CardTitle className="flex items-start justify-between gap-3 text-base">
                <span className="flex items-center gap-2">
                  {event.eventType === 'NEW_DISK_DETECTED' ? (
                    <HardDrive className="h-4 w-4" />
                  ) : event.eventType === 'LOW_DISK_SPACE' ? (
                    <HardDriveDownload className="h-4 w-4" />
                  ) : (
                    <BellRing className="h-4 w-4" />
                  )}
                  {event.title}
                </span>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                  aria-label="Fermer cette notification"
                  title="Fermer (n'applique aucune action)"
                  onClick={() =>
                    setLocallyHiddenIds((current) => {
                      const next = new Set(current);
                      next.add(event.id);
                      return next;
                    })
                  }
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{event.message}</p>

              {event.payload &&
              typeof event.payload === 'object' &&
              'summaryText' in event.payload ? (
                <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  {String(event.payload.summaryText)}
                </div>
              ) : null}

              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  onClick={() => void runAction(event.id, actions.primary.action)}
                  disabled={loadingAction === `${event.id}:${actions.primary.action}`}
                >
                  {actions.primary.action === 'update-now' ? (
                    <RefreshCw className="h-4 w-4" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  {actions.primary.label}
                </Button>

                <div className="flex gap-2">
                  {actions.secondary ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => void runAction(event.id, actions.secondary!.action)}
                      disabled={loadingAction === `${event.id}:${actions.secondary!.action}`}
                    >
                      {actions.secondary.label}
                    </Button>
                  ) : null}

                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => void runAction(event.id, actions.tertiary.action)}
                    disabled={loadingAction === `${event.id}:${actions.tertiary.action}`}
                  >
                    {actions.tertiary.label}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </>
  );
}