'use client';

import { useEffect, useState } from 'react';
import { RotateCcw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  DEFAULT_SCAN_SETTINGS,
  SCAN_SETTINGS_STORAGE_KEY,
  ScanSettings
} from '@/lib/scan-settings';
import { ScanSettingsForm } from '@/components/scan/scan-settings-form';

export function ScanSettingsClient() {
  const [settings, setSettings] = useState<ScanSettings>(DEFAULT_SCAN_SETTINGS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SCAN_SETTINGS_STORAGE_KEY);

      if (!raw) return;

      const parsed = JSON.parse(raw) as Partial<ScanSettings>;

      setSettings({
        ...DEFAULT_SCAN_SETTINGS,
        ...parsed
      });
    } catch {
      // ignore
    }
  }, []);

  function save() {
    localStorage.setItem(SCAN_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    toast.success('Paramètres enregistrés');
  }

  function reset() {
    setSettings(DEFAULT_SCAN_SETTINGS);
    localStorage.setItem(
      SCAN_SETTINGS_STORAGE_KEY,
      JSON.stringify(DEFAULT_SCAN_SETTINGS)
    );
    toast.success('Paramètres réinitialisés');
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle>Paramètres de scan</CardTitle>
        <CardDescription>
          Réglages utilisés par défaut pour le scan manuel.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <ScanSettingsForm value={settings} onChange={setSettings} />

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={save}>
            <Save className="h-4 w-4" />
            Enregistrer
          </Button>

          <Button type="button" variant="outline" onClick={reset}>
            <RotateCcw className="h-4 w-4" />
            Réinitialiser
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}