'use client';

import { useEffect, useState } from 'react';
import { Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';

type AccessRow = {
  userId: string;
  email: string;
  name: string | null;
  hasAccess: boolean;
};

export function DiskAccessPanel({ diskId }: { diskId: string }) {
  const [rows, setRows] = useState<AccessRow[] | null>(null);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/disks/${diskId}/access`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: AccessRow[]) => {
        if (!cancelled) setRows(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      });

    return () => {
      cancelled = true;
    };
  }, [diskId]);

  async function toggleAccess(userId: string, granted: boolean) {
    setPendingUserId(userId);

    try {
      const response = await fetch(`/api/disks/${diskId}/access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, granted })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Impossible de modifier l'accès.");
      }

      setRows((prev) =>
        prev
          ? prev.map((row) => (row.userId === userId ? { ...row, hasAccess: granted } : row))
          : prev
      );
    } catch (error) {
      toast.error("Impossible de modifier l'accès", {
        description: error instanceof Error ? error.message : undefined
      });
    } finally {
      setPendingUserId(null);
    }
  }

  if (rows === null) {
    return (
      <div className="flex items-center gap-2 rounded-xl border bg-muted/10 px-3 py-3 text-sm text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Chargement des accès...
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-xl border bg-muted/10 px-3 py-3 text-sm text-muted-foreground">
        Aucun compte non-administrateur à gérer. Tous les administrateurs voient déjà tous les
        disques.
      </p>
    );
  }

  return (
    <div className="divide-y rounded-xl border">
      {rows.map((row) => (
        <div key={row.userId} className="flex items-center justify-between gap-3 px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{row.name || row.email}</p>
              {row.name ? (
                <p className="truncate text-xs text-muted-foreground">{row.email}</p>
              ) : null}
            </div>
          </div>

          <Switch
            checked={row.hasAccess}
            disabled={pendingUserId === row.userId}
            onCheckedChange={(checked) => void toggleAccess(row.userId, checked)}
          />
        </div>
      ))}
    </div>
  );
}
