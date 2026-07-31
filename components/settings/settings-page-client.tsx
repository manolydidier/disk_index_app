// components/settings/settings-page-client.tsx

"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  HardDrive,
  Loader2,
  Play,
  RefreshCcw,
  RotateCcw,
  Save,
  SearchCheck,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  UserCog,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

import {
  DEFAULT_SCAN_SETTINGS,
  SCAN_SETTINGS_STORAGE_KEY,
} from "@/lib/scan-settings";
import type { ScanSettings } from "@/lib/scan-settings";
import { ScanSettingsForm } from "@/components/scan/scan-settings-form";

type SettingsTab = "automation" | "manual-scan" | "users";

type AutomationSettingsPayload = {
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

type DiskOption = {
  id: string;
  code: string;
  name: string;
  rootPath: string;
  status: string;
};

type ScanResponse = {
  success?: boolean;
  summary?: unknown;
  error?: string;
};

type UserRole = "ADMIN" | "USER";

type AppUser = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type UsersResponse = {
  users?: AppUser[];
  error?: string;
};

type UpdateRoleResponse = {
  user?: AppUser;
  error?: string;
};

export function SettingsPageClient() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("automation");

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border bg-background shadow-sm">
        <div className="border-b bg-muted/30 px-6 py-6 sm:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                <Settings2 className="h-3.5 w-3.5" />
                Paramètres Disk Indexer
              </div>

              <div>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  Paramètres
                </h1>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  Configure la surveillance automatique, les notifications, les
                  disques suivis, les scans manuels et les utilisateurs depuis
                  une seule interface.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[520px]">
              <InfoPill
                icon={<ShieldCheck className="h-4 w-4" />}
                label="Sécurité"
                value="Session protégée"
              />

              <InfoPill
                icon={<Bell className="h-4 w-4" />}
                label="Notifications"
                value="Personnalisables"
              />

              <InfoPill
                icon={<Users className="h-4 w-4" />}
                label="Utilisateurs"
                value="Rôles gérés"
              />
            </div>
          </div>
        </div>

        <div className="border-b px-4 py-3 sm:px-6">
          <div className="flex flex-wrap gap-2 rounded-2xl bg-muted/50 p-1">
            <TabButton
              active={activeTab === "automation"}
              onClick={() => setActiveTab("automation")}
              icon={<SlidersHorizontal className="h-4 w-4" />}
            >
              Automatisation
            </TabButton>

            <TabButton
              active={activeTab === "manual-scan"}
              onClick={() => setActiveTab("manual-scan")}
              icon={<SearchCheck className="h-4 w-4" />}
            >
              Scan manuel
            </TabButton>

            <TabButton
              active={activeTab === "users"}
              onClick={() => setActiveTab("users")}
              icon={<Users className="h-4 w-4" />}
            >
              Utilisateurs
            </TabButton>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {activeTab === "automation" ? <AutomationSettingsPanel /> : null}
          {activeTab === "manual-scan" ? <ManualScanPanel /> : null}
          {activeTab === "users" ? <UsersPanel /> : null}
        </div>
      </section>
    </div>
  );
}

function AutomationSettingsPanel() {
  const [data, setData] = useState<AutomationSettingsPayload | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const response = await fetch("/api/automation/settings", {
        cache: "no-store",
      });

      const payload = (await response.json()) as AutomationSettingsPayload;
      setData(payload);
    } catch {
      toast.error("Impossible de charger les paramètres d’automatisation");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const ignoredRootsText = useMemo(
    () => (data?.settings.ignoredRoots ?? []).join("\n"),
    [data]
  );

  const ignoredPatternsText = useMemo(
    () => (data?.settings.ignoredPathPatterns ?? []).join("\n"),
    [data]
  );

  if (!data) {
    return (
      <LoadingBlock label="Chargement des paramètres d’automatisation..." />
    );
  }

  async function save(resetNotificationPreferences = false) {
    if (!data) return;

    setSaving(true);

    try {
      const response = await fetch("/api/automation/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
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
              ignoredPaths: [],
            }),
          })),
          resetNotificationPreferences,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Impossible de sauvegarder.");
      }

      toast.success("Paramètres enregistrés");
      await load();
    } catch (error) {
      toast.error("Erreur", {
        description:
          error instanceof Error ? error.message : "Impossible de sauvegarder.",
      });
    } finally {
      setSaving(false);
    }
  }

  function updateGlobal<K extends keyof AutomationSettingsPayload["settings"]>(
    key: K,
    value: AutomationSettingsPayload["settings"][K]
  ) {
    setData((current) =>
      current
        ? {
            ...current,
            settings: {
              ...current.settings,
              [key]: value,
            },
          }
        : current
    );
  }

  function updateDiskPreference(diskId: string, key: string, value: unknown) {
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
            ignoredPaths: [],
          };

          return {
            ...disk,
            preference: {
              ...pref,
              [key]: value,
            },
          };
        }),
      };
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-0 bg-muted/30 shadow-none lg:col-span-2">
          <CardHeader>
            <CardTitle>Surveillance globale</CardTitle>
            <CardDescription>
              Configure le comportement général de l’automatisation.
            </CardDescription>
          </CardHeader>

          <CardContent className="grid gap-3 md:grid-cols-2">
            <SettingToggle
              label="Activer la surveillance globale"
              description="Active ou désactive toute l’automatisation."
              checked={data.settings.isEnabled}
              onChange={(checked) => updateGlobal("isEnabled", checked)}
            />

            <SettingToggle
              label="Détecter les nouveaux disques"
              description="Surveille l’arrivée de nouvelles racines."
              checked={data.settings.detectNewDisks}
              onChange={(checked) => updateGlobal("detectNewDisks", checked)}
            />

            <SettingToggle
              label="Surveiller les disques indexés"
              description="Détecte les modifications sur les disques connus."
              checked={data.settings.watchIndexedDisks}
              onChange={(checked) => updateGlobal("watchIndexedDisks", checked)}
            />

            <SettingToggle
              label="Demander confirmation"
              description="Affiche une demande avant mise à jour."
              checked={data.settings.confirmBeforeUpdate}
              onChange={(checked) =>
                updateGlobal("confirmBeforeUpdate", checked)
              }
            />

            <SettingToggle
              label="Mise à jour automatique"
              description="Applique les mises à jour sans confirmation."
              checked={data.settings.autoUpdateWithoutPrompt}
              onChange={(checked) =>
                updateGlobal("autoUpdateWithoutPrompt", checked)
              }
            />

            <SettingToggle
              label="Notifications système"
              description="Affiche aussi des notifications système."
              checked={data.settings.showSystemNotifications}
              onChange={(checked) =>
                updateGlobal("showSystemNotifications", checked)
              }
            />
          </CardContent>
        </Card>

        <Card className="border-0 bg-muted/30 shadow-none">
          <CardHeader>
            <CardTitle>Délais</CardTitle>
            <CardDescription>
              Ajuste la fréquence des notifications et changements.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <FieldBlock label="Cooldown notifications">
              <input
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                type="number"
                min={5}
                value={data.settings.notificationCooldownSeconds}
                onChange={(e) =>
                  updateGlobal(
                    "notificationCooldownSeconds",
                    Number(e.target.value || 30)
                  )
                }
              />
              <p className="text-xs text-muted-foreground">En secondes.</p>
            </FieldBlock>

            <FieldBlock label="Anti-spam changements">
              <input
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                type="number"
                min={3}
                value={data.settings.changeDebounceSeconds}
                onChange={(e) =>
                  updateGlobal(
                    "changeDebounceSeconds",
                    Number(e.target.value || 8)
                  )
                }
              />
              <p className="text-xs text-muted-foreground">En secondes.</p>
            </FieldBlock>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 bg-muted/30 shadow-none">
        <CardHeader>
          <CardTitle>Exclusions globales</CardTitle>
          <CardDescription>
            Ignore certains disques, racines ou motifs de chemin.
          </CardDescription>
        </CardHeader>

        <CardContent className="grid gap-4 md:grid-cols-2">
          <FieldBlock label="Disques / racines ignorés">
            <textarea
              className="min-h-[140px] w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={ignoredRootsText}
              placeholder="Exemple : D:/Archives"
              onChange={(e) =>
                updateGlobal(
                  "ignoredRoots",
                  e.target.value
                    .split("\n")
                    .map((item) => item.trim())
                    .filter(Boolean)
                )
              }
            />
            <p className="text-xs text-muted-foreground">
              Une entrée par ligne.
            </p>
          </FieldBlock>

          <FieldBlock label="Chemins / motifs ignorés">
            <textarea
              className="min-h-[140px] w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={ignoredPatternsText}
              placeholder="Exemple : node_modules"
              onChange={(e) =>
                updateGlobal(
                  "ignoredPathPatterns",
                  e.target.value
                    .split("\n")
                    .map((item) => item.trim())
                    .filter(Boolean)
                )
              }
            />
            <p className="text-xs text-muted-foreground">
              Une entrée par ligne.
            </p>
          </FieldBlock>
        </CardContent>
      </Card>

      <Card className="border-0 bg-muted/30 shadow-none">
        <CardHeader>
          <CardTitle>Disques surveillés</CardTitle>
          <CardDescription>
            Paramétrage disque par disque.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {data.disks.length === 0 ? (
            <div className="rounded-2xl border bg-background px-4 py-8 text-center text-sm text-muted-foreground">
              Aucun disque trouvé.
            </div>
          ) : (
            data.disks.map((disk) => {
              const pref = disk.preference ?? {
                monitorEnabled: true,
                notifyOnConnect: true,
                notifyOnChange: true,
                autoUpdateWithoutPrompt: false,
                muted: false,
                ignoredPaths: [],
              };

              return (
                <div
                  key={disk.id}
                  className="rounded-2xl border bg-background p-4 shadow-sm"
                >
                  <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="font-medium">
                        {disk.code} — {disk.name}
                      </p>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">
                        {disk.rootPath}
                      </p>
                    </div>

                    <span className="w-fit rounded-full border bg-muted px-3 py-1 text-xs text-muted-foreground">
                      {disk.status}
                    </span>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <SettingToggle
                      label="Surveiller ce disque"
                      checked={pref.monitorEnabled}
                      onChange={(checked) =>
                        updateDiskPreference(
                          disk.id,
                          "monitorEnabled",
                          checked
                        )
                      }
                    />

                    <SettingToggle
                      label="Notifier à la connexion"
                      checked={pref.notifyOnConnect}
                      onChange={(checked) =>
                        updateDiskPreference(
                          disk.id,
                          "notifyOnConnect",
                          checked
                        )
                      }
                    />

                    <SettingToggle
                      label="Notifier aux changements"
                      checked={pref.notifyOnChange}
                      onChange={(checked) =>
                        updateDiskPreference(
                          disk.id,
                          "notifyOnChange",
                          checked
                        )
                      }
                    />

                    <SettingToggle
                      label="Mettre à jour automatiquement"
                      checked={pref.autoUpdateWithoutPrompt}
                      onChange={(checked) =>
                        updateDiskPreference(
                          disk.id,
                          "autoUpdateWithoutPrompt",
                          checked
                        )
                      }
                    />

                    <SettingToggle
                      label="Couper les notifications"
                      checked={pref.muted}
                      onChange={(checked) =>
                        updateDiskPreference(disk.id, "muted", checked)
                      }
                    />
                  </div>

                  <div className="mt-4">
                    <FieldBlock label="Chemins ignorés pour ce disque">
                      <textarea
                        className="min-h-[90px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                        value={pref.ignoredPaths.join("\n")}
                        placeholder="Une entrée par ligne"
                        onChange={(e) =>
                          updateDiskPreference(
                            disk.id,
                            "ignoredPaths",
                            e.target.value
                              .split("\n")
                              .map((item) => item.trim())
                              .filter(Boolean)
                          )
                        }
                      />
                    </FieldBlock>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <div className="sticky bottom-4 z-10 flex flex-wrap gap-3 rounded-2xl border bg-background/90 p-3 shadow-lg backdrop-blur">
        <Button disabled={saving} onClick={() => void save(false)}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Enregistrement...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Enregistrer
            </>
          )}
        </Button>

        <Button
          variant="outline"
          disabled={saving}
          onClick={() => void save(true)}
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Réinitialiser les préférences
        </Button>
      </div>
    </div>
  );
}

function ManualScanPanel() {
  const [disks, setDisks] = useState<DiskOption[]>([]);
  const [diskId, setDiskId] = useState("");
  const [settings, setSettings] = useState<ScanSettings>(
    DEFAULT_SCAN_SETTINGS
  );
  const [loadingDisks, setLoadingDisks] = useState(true);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState("Prêt");
  const [resultText, setResultText] = useState("");

  useEffect(() => {
    async function loadDisks() {
      try {
        const response = await fetch("/api/disks", { cache: "no-store" });
        const payload = (await response.json()) as DiskOption[];
        setDisks(Array.isArray(payload) ? payload : []);
      } catch {
        toast.error("Impossible de charger les disques");
      } finally {
        setLoadingDisks(false);
      }
    }

    void loadDisks();

    try {
      const raw = localStorage.getItem(SCAN_SETTINGS_STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as Partial<ScanSettings>;

      setSettings({
        ...DEFAULT_SCAN_SETTINGS,
        ...parsed,
      });
    } catch {
      // ignore
    }
  }, []);

  const selectedDisk = useMemo(
    () => disks.find((disk) => disk.id === diskId) ?? null,
    [diskId, disks]
  );

  async function runScan() {
    if (!diskId) {
      toast.error("Choisis un disque");
      return;
    }

    setRunning(true);
    setProgress(8);
    setPhase("Préparation");
    setResultText("");

    const interval = window.setInterval(() => {
      setProgress((current) => {
        if (current >= 90) return current;
        return current + 6;
      });
    }, 500);

    try {
      setPhase("Scan en cours");

      const response = await fetch(`/api/disks/${diskId}/scan-sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
      });

      const payload = (await response.json().catch(() => ({}))) as ScanResponse;

      if (!response.ok) {
        throw new Error(payload.error || "Le scan a échoué.");
      }

      setPhase("Terminé");
      setProgress(100);
      setResultText(
        payload.summary
          ? JSON.stringify(payload.summary)
          : "Scan terminé avec succès."
      );

      toast.success("Scan terminé");
    } catch (error) {
      setPhase("Échec");
      toast.error("Erreur de scan", {
        description:
          error instanceof Error ? error.message : "Le scan a échoué.",
      });
    } finally {
      window.clearInterval(interval);
      setRunning(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
      <Card className="border-0 bg-muted/30 shadow-none">
        <CardHeader>
          <CardTitle>Scan manuel</CardTitle>
          <CardDescription>
            Lance un scan immédiat sur un disque sélectionné.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <FieldBlock label="Disque">
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={diskId}
              onChange={(e) => setDiskId(e.target.value)}
              disabled={loadingDisks || running}
            >
              <option value="">Choisir un disque</option>

              {disks.map((disk) => (
                <option key={disk.id} value={disk.id}>
                  {disk.code} — {disk.name}
                </option>
              ))}
            </select>
          </FieldBlock>

          {selectedDisk ? (
            <div className="rounded-2xl border bg-background px-4 py-3 text-sm shadow-sm">
              <p className="font-medium">
                {selectedDisk.code} — {selectedDisk.name}
              </p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {selectedDisk.rootPath}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Statut : {selectedDisk.status}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed bg-background px-4 py-6 text-center text-sm text-muted-foreground">
              Sélectionne un disque pour démarrer.
            </div>
          )}

          <Button
            type="button"
            onClick={runScan}
            disabled={running || !diskId}
            className="w-full"
          >
            {running ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Scan en cours...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Lancer le scan
              </>
            )}
          </Button>

          {(running || progress > 0) && (
            <div className="space-y-3 rounded-2xl border bg-background px-4 py-4 shadow-sm">
              <div className="flex items-center justify-between text-sm">
                <span>{phase}</span>
                <span>{progress}%</span>
              </div>

              <Progress value={progress} className="h-2" />

              <p className="text-xs text-muted-foreground">
                Le scan est exécuté directement et la page attend la fin.
              </p>
            </div>
          )}

          {resultText ? (
            <div className="rounded-2xl border bg-background px-4 py-3 shadow-sm">
              <p className="mb-1 text-sm font-medium">Résultat</p>
              <p className="break-all text-xs text-muted-foreground">
                {resultText}
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-0 bg-muted/30 shadow-none">
        <CardHeader>
          <CardTitle>Paramètres du scan</CardTitle>
          <CardDescription>
            Ces réglages sont appliqués uniquement au scan manuel courant.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <ScanSettingsForm
            value={settings}
            onChange={setSettings}
            disabled={running}
          />

          <div className="flex items-center gap-2 rounded-2xl border bg-background px-4 py-3 text-sm text-muted-foreground shadow-sm">
            <SearchCheck className="h-4 w-4" />
            Tu peux modifier ces paramètres sans toucher aux réglages
            d’automatisation enregistrés.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function UsersPanel() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function loadUsers() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/users", {
        cache: "no-store",
      });

      const payload = (await response.json().catch(() => ({}))) as UsersResponse;

      if (!response.ok) {
        throw new Error(
          payload.error || "Impossible de charger les utilisateurs."
        );
      }

      setUsers(payload.users ?? []);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Impossible de charger les utilisateurs.";

      setError(message);

      toast.error("Erreur", {
        description: message,
      });
    } finally {
      setLoading(false);
    }
  }

  async function updateUserRole(userId: string, role: UserRole) {
    setSavingUserId(userId);

    try {
      const response = await fetch(`/api/users/${userId}/role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role }),
      });

      const payload = (await response.json().catch(() => ({}))) as UpdateRoleResponse;

      if (!response.ok) {
        throw new Error(payload.error || "Impossible de modifier le rôle.");
      }

      if (!payload.user) {
        throw new Error("Réponse invalide du serveur.");
      }

      const updatedUser = payload.user;

      setUsers((currentUsers) =>
        currentUsers.map((user) =>
          user.id === userId ? updatedUser : user
        )
      );

      toast.success("Rôle modifié", {
        description: `${updatedUser.email} est maintenant ${updatedUser.role}.`,
      });
    } catch (error) {
      toast.error("Erreur", {
        description:
          error instanceof Error
            ? error.message
            : "Impossible de modifier le rôle.",
      });
    } finally {
      setSavingUserId(null);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  const adminCount = useMemo(
    () => users.filter((user) => user.role === "ADMIN").length,
    [users]
  );

  const activeCount = useMemo(
    () => users.filter((user) => user.isActive).length,
    [users]
  );

  if (loading) {
    return <LoadingBlock label="Chargement des utilisateurs..." />;
  }

  if (error) {
    return (
      <Card className="border-0 bg-muted/30 shadow-none">
        <CardHeader>
          <CardTitle>Gestion des utilisateurs</CardTitle>
          <CardDescription>
            Une erreur empêche le chargement des utilisateurs.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>

          <Button variant="outline" onClick={() => void loadUsers()}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Réessayer
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-0 bg-muted/30 shadow-none">
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UserCog className="h-5 w-5" />
                Gestion des utilisateurs
              </CardTitle>

              <CardDescription>
                Modifie les rôles des utilisateurs de Disk Indexer.
              </CardDescription>
            </div>

            <Button variant="outline" onClick={() => void loadUsers()}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Actualiser
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatsCard label="Utilisateurs" value={String(users.length)} />
            <StatsCard label="Administrateurs" value={String(adminCount)} />
            <StatsCard label="Comptes actifs" value={String(activeCount)} />
          </div>

          {users.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-background px-4 py-10 text-center text-sm text-muted-foreground">
              Aucun utilisateur trouvé.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border bg-background shadow-sm">
              <div className="hidden grid-cols-[1fr_160px_140px_180px] gap-4 border-b bg-muted/40 px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid">
                <span>Utilisateur</span>
                <span>Rôle</span>
                <span>Statut</span>
                <span>Modifier</span>
              </div>

              <div className="divide-y">
                {users.map((user) => {
                  const isSaving = savingUserId === user.id;

                  return (
                    <div
                      key={user.id}
                      className="grid gap-4 px-4 py-4 md:grid-cols-[1fr_160px_140px_180px] md:items-center"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-medium">
                            {user.name || "Utilisateur sans nom"}
                          </p>

                          {user.role === "ADMIN" ? (
                            <span className="inline-flex items-center gap-1 rounded-full border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                              <ShieldCheck className="h-3 w-3" />
                              Admin
                            </span>
                          ) : null}
                        </div>

                        <p className="truncate text-sm text-muted-foreground">
                          {user.email}
                        </p>

                        <p className="mt-1 text-xs text-muted-foreground">
                          Créé le {formatDate(user.createdAt)}
                        </p>
                      </div>

                      <div>
                        <span
                          className={
                            user.role === "ADMIN"
                              ? "inline-flex rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
                              : "inline-flex rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground"
                          }
                        >
                          {user.role}
                        </span>
                      </div>

                      <div>
                        <span
                          className={
                            user.isActive
                              ? "inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700"
                              : "inline-flex rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive"
                          }
                        >
                          {user.isActive ? "Actif" : "Désactivé"}
                        </span>
                      </div>

                      <div>
                        <select
                          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                          value={user.role}
                          disabled={isSaving}
                          onChange={(e) =>
                            void updateUserRole(
                              user.id,
                              e.target.value as UserRole
                            )
                          }
                        >
                          <option value="USER">USER</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>

                        {isSaving ? (
                          <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Modification...
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "inline-flex items-center gap-2 rounded-xl bg-background px-4 py-2 text-sm font-medium shadow-sm"
          : "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm text-muted-foreground transition hover:bg-background/70 hover:text-foreground"
      }
    >
      {icon}
      {children}
    </button>
  );
}

function InfoPill({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border bg-background px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

function LoadingBlock({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

function SettingToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border bg-background px-4 py-3 shadow-sm transition hover:bg-muted/30">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {description ? (
          <span className="mt-1 block text-xs text-muted-foreground">
            {description}
          </span>
        ) : null}
      </span>

      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4"
      />
    </label>
  );
}

function FieldBlock({
  label,
  children,
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

function StatsCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-background px-4 py-3 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}