'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { BellRing, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type Activity = {
  id: string;
  activityType: 'ADDED' | 'MODIFIED' | 'DELETED' | 'RENAMED' | 'DISK_STATUS';
  path: string;
  previousPath?: string | null;
  disk: {
    id: string;
    code: string;
    name: string;
  };
};

export function ActivityMonitor() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const lastCountRef = useRef(0);

  const grouped = useMemo(() => {
    const map = new Map<string, Activity[]>();
    for (const activity of activities) {
      const bucket = map.get(activity.disk.id) ?? [];
      bucket.push(activity);
      map.set(activity.disk.id, bucket);
    }
    return Array.from(map.entries()).map(([diskId, items]) => ({
      diskId,
      disk: items[0]?.disk,
      items
    }));
  }, [activities]);

  useEffect(() => {
    let active = true;

    const poll = async () => {
      try {
        const response = await fetch('/api/activities?unacknowledged=true', { cache: 'no-store' });
        if (!response.ok) return;
        const data = (await response.json()) as Activity[];
        if (!active) return;
        setActivities(data);
        if (data.length > lastCountRef.current && data.length > 0) {
          toast.info(`${data.length} nouvelle(s) activité(s) détectée(s) sur vos disques.`);
        }
        lastCountRef.current = data.length;
      } catch {
        // noop
      }
    };

    poll();
    const interval = window.setInterval(poll, 15000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  async function acknowledge(diskId: string) {
    setLoading(true);
    try {
      await fetch('/api/activities/acknowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diskId })
      });
      setActivities((current) => current.filter((item) => item.disk.id !== diskId));
    } finally {
      setLoading(false);
    }
  }

  async function rescan(diskId: string) {
    setLoading(true);
    try {
      const response = await fetch(`/api/disks/${diskId}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scanType: 'DIFFERENTIAL' })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Rescan impossible');
      }
      toast.success('Scan différentiel lancé avec succès.');
      await acknowledge(diskId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Rescan impossible');
    } finally {
      setLoading(false);
    }
  }

  if (grouped.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[420px] space-y-3">
      {grouped.map((group) => (
        <Card key={group.diskId} className="border-primary/30 shadow-xl">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BellRing className="h-4 w-4" />
                  Activité détectée sur {group.disk?.code}
                </CardTitle>
                <CardDescription>{group.disk?.name}</CardDescription>
              </div>
              <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                {group.items.length} changement(s)
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-h-48 space-y-2 overflow-auto text-sm">
              {group.items.slice(0, 5).map((item) => (
                <div key={item.id} className="rounded-lg border p-3">
                  <div className="font-medium">{item.activityType}</div>
                  <div className="mt-1 break-all text-xs text-muted-foreground">{item.path}</div>
                  {item.previousPath ? <div className="mt-1 break-all text-xs text-muted-foreground">Ancien chemin: {item.previousPath}</div> : null}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button onClick={() => rescan(group.diskId)} disabled={loading}>
                <RefreshCw className="h-4 w-4" />
                Mettre à jour ce disque
              </Button>
              <Button variant="outline" onClick={() => acknowledge(group.diskId)} disabled={loading}>
                Ignorer
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
