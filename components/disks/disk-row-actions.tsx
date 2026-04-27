'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

export function DiskRowActions({ diskId, isEnabled, status }: { diskId: string; isEnabled: boolean; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggleEnabled() {
    setLoading(true);
    try {
      const response = await fetch(`/api/disks/${diskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: !isEnabled, status: !isEnabled ? 'ACTIVE' : 'INACTIVE' })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Action impossible');
      toast.success(!isEnabled ? 'Disque réactivé.' : 'Disque désactivé.');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Action impossible');
    } finally {
      setLoading(false);
    }
  }

  async function removeDisk() {
    if (!window.confirm('Supprimer ce disque et tout son index ?')) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/disks/${diskId}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Suppression impossible');
      toast.success('Disque supprimé.');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Suppression impossible');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={toggleEnabled} disabled={loading}>
        {isEnabled ? 'Désactiver' : 'Réactiver'}
      </Button>
      {(status !== 'ACTIVE' || !isEnabled) && (
        <Button variant="destructive" size="sm" onClick={removeDisk} disabled={loading}>
          Supprimer
        </Button>
      )}
    </div>
  );
}
