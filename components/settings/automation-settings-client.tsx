'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type SettingsPayload = {
  settings: {
    isEnabled: boolean;
    detectNewDisks: boolean;
    watchIndexedDisks: boolean;
    confirmBeforeUpdate: boolean;
    autoUpdateWithoutPrompt: boolean;
    showSystemNotifications: boolean;
    ignoredRoots: string[];
    ignoredPathPatterns: string[];
    notificationCooldownSeconds: number;
    changeDebounceSeconds: number;
  };
  disks: Array<{
    id: string;
    code: string;
    name: string;
    rootPath: string;
    status: string;
    preference: null | {
      monitorEnabled: boolean;
      notifyOnConnect: boolean;
      notifyOnChange: boolean;
      autoUpdateWithoutPrompt: boolean;
      muted: boolean;
      ignoredPaths: string[];
    };
  }>;
};

export function AutomationSettingsClient() {
  const [data, setData] = useState<SettingsPayload | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const response = await fetch('/api/automation/settings', {
      cache: 'no-store'
    });
    const payload = (await response.json()) as SettingsPayload;
    setData(payload);
  }

  useEffect(() => {
    void load();
  }, []);

  const ignoredRootsText = useMemo(
    () => (data?.settings.ignoredRoots ?? []).join('\n'),
    [data]
  );

  const ignoredPatternsText = useMemo(
    () => (data?.settings.ignoredPathPatterns ?? []).join('\n'),
    [data]
  );

  if (!data) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Chargement des paramètres d’automatisation...
      </div>
    );
  }

  async function save(resetNotificationPreferences = false) {
    setSaving(true);

    try {
      const response = await fetch('/api/automation/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          settings: data.settings,
          diskPreferences: data.disks.map((disk) => ({
            diskId: disk.id,
            ...(disk.preference ?? {
              monitorEnabled: true,
              notifyOnConnect: true,
              notifyOnChange: true,
              autoUpdateWithoutPrompt: false,
              muted: false,
              ignoredPaths: []
            })
          })),
          resetNotificationPreferences
        })
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || 'Impossible de sauvegarder.');
      }

      toast.success('Paramètres enregistrés');
      await load();
    } catch (error) {
      toast.error('Erreur', {
        description:
          error instanceof Error ? error.message : 'Impossible de sauvegarder.'
      });
    } finally {
      setSaving(false);
    }
  }

  function updateGlobal<K extends keyof SettingsPayload['settings']>(
    key: K,
    value: SettingsPayload['settings'][K]
  ) {
    setData((current) =>
      current
        ? {
            ...current,
            settings: {
              ...current.settings,
              [key]: value
            }
          }
        : current
    );
  }

  function updateDiskPreference(
    diskId: string,
    key: string,
    value: unknown
  ) {
    setData((current) => {
      if (!current) return current;

      return {
        ...current,
        disks: current.disks.map((disk) => {
          if (disk.id !== diskId) return disk;

          const pref = disk.preference ?? {
            monitorEnabled: true,
            notifyOnConnect: true,
            notifyOnChange: true,
            autoUpdateWithoutPrompt: false,
            muted: false,
            ignoredPaths: []
          };

          return {
            ...disk,
            preference: {
              ...pref,
              [key]: value
            }
          };
        })
      };
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Automatisation</CardTitle>
          <CardDescription>
            Détection automatique des nouveaux disques et surveillance des
            modifications.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <GlobalToggle
            label="Activer la surveillance globale"
            checked={data.settings.isEnabled}
            onChange={(checked) => updateGlobal('isEnabled', checked)}
          />
          <GlobalToggle
            label="Activer la détection automatique des nouveaux disques"
            checked={data.settings.detectNewDisks}
            onChange={(checked) => updateGlobal('detectNewDisks', checked)}
          />
          <GlobalToggle
            label="Activer la surveillance des modifications sur les disques indexés"
            checked={data.settings.watchIndexedDisks}
            onChange={(checked) => updateGlobal('watchIndexedDisks', checked)}
          />
          <GlobalToggle
            label="Afficher une notification avant mise à jour"
            checked={data.settings.confirmBeforeUpdate}
            onChange={(checked) => updateGlobal('confirmBeforeUpdate', checked)}
          />
          <GlobalToggle
            label="Mettre à jour automatiquement sans demander"
            checked={data.settings.autoUpdateWithoutPrompt}
            onChange={(checked) =>
              updateGlobal('autoUpdateWithoutPrompt', checked)
            }
          />
          <GlobalToggle
            label="Afficher aussi une notification système"
            checked={data.settings.showSystemNotifications}
            onChange={(checked) =>
              updateGlobal('showSystemNotifications', checked)
            }
          />

          <div className="grid gap-4 md:grid-cols-2">
            <FieldBlock label="Cooldown notifications (secondes)">
              <input
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                type="number"
                min={5}
                value={data.settings.notificationCooldownSeconds}
                onChange={(e) =>
                  updateGlobal(
                    'notificationCooldownSeconds',
                    Number(e.target.value || 30)
                  )
                }
              />
            </FieldBlock>

            <FieldBlock label="Délai anti-spam changements (secondes)">
              <input
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                type="number"
                min={3}
                value={data.settings.changeDebounceSeconds}
                onChange={(e) =>
                  updateGlobal(
                    'changeDebounceSeconds',
                    Number(e.target.value || 8)
                  )
                }
              />
            </FieldBlock>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <FieldBlock label="Disques / racines ignorés (une ligne par entrée)">
              <textarea
                className="min-h-[120px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={ignoredRootsText}
                onChange={(e) =>
                  updateGlobal(
                    'ignoredRoots',
                    e.target.value
                      .split('\n')
                      .map((item) => item.trim())
                      .filter(Boolean)
                  )
                }
              />
            </FieldBlock>

            <FieldBlock label="Chemins / motifs ignorés (une ligne par entrée)">
              <textarea
                className="min-h-[120px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={ignoredPatternsText}
                onChange={(e) =>
                  updateGlobal(
                    'ignoredPathPatterns',
                    e.target.value
                      .split('\n')
                      .map((item) => item.trim())
                      .filter(Boolean)
                  )
                }
              />
            </FieldBlock>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Disques surveillés</CardTitle>
          <CardDescription>
            Paramétrage disque par disque.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {data.disks.map((disk) => {
            const pref = disk.preference ?? {
              monitorEnabled: true,
              notifyOnConnect: true,
              notifyOnChange: true,
              autoUpdateWithoutPrompt: false,
              muted: false,
              ignoredPaths: []
            };

            return (
              <div key={disk.id} className="rounded-xl border p-4">
                <div className="mb-4 flex flex-col gap-1">
                  <span className="font-medium">
                    {disk.code} — {disk.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {disk.rootPath} • {disk.status}
                  </span>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <GlobalToggle
                    label="Surveiller ce disque"
                    checked={pref.monitorEnabled}
                    onChange={(checked) =>
                      updateDiskPreference(disk.id, 'monitorEnabled', checked)
                    }
                  />
                  <GlobalToggle
                    label="Notifier à la connexion"
                    checked={pref.notifyOnConnect}
                    onChange={(checked) =>
                      updateDiskPreference(disk.id, 'notifyOnConnect', checked)
                    }
                  />
                  <GlobalToggle
                    label="Notifier aux changements"
                    checked={pref.notifyOnChange}
                    onChange={(checked) =>
                      updateDiskPreference(disk.id, 'notifyOnChange', checked)
                    }
                  />
                  <GlobalToggle
                    label="Mettre à jour automatiquement"
                    checked={pref.autoUpdateWithoutPrompt}
                    onChange={(checked) =>
                      updateDiskPreference(
                        disk.id,
                        'autoUpdateWithoutPrompt',
                        checked
                      )
                    }
                  />
                  <GlobalToggle
                    label="Couper les notifications"
                    checked={pref.muted}
                    onChange={(checked) =>
                      updateDiskPreference(disk.id, 'muted', checked)
                    }
                  />
                </div>

                <div className="mt-4">
                  <FieldBlock label="Chemins ignorés pour ce disque (une ligne par entrée)">
                    <textarea
                      className="min-h-[90px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={pref.ignoredPaths.join('\n')}
                      onChange={(e) =>
                        updateDiskPreference(
                          disk.id,
                          'ignoredPaths',
                          e.target.value
                            .split('\n')
                            .map((item) => item.trim())
                            .filter(Boolean)
                        )
                      }
                    />
                  </FieldBlock>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button disabled={saving} onClick={() => void save(false)}>
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </Button>

        <Button
          variant="outline"
          disabled={saving}
          onClick={() => void save(true)}
        >
          Réinitialiser les préférences de notification
        </Button>
      </div>
    </div>
  );
}

function GlobalToggle({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
      <span className="text-sm">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

function FieldBlock({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      {children}
    </div>
  );
}