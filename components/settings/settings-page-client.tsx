// components/settings/settings-page-client.tsx

"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
  AlertTriangle,
  Laptop,
  Loader2,
  Pencil,
  Play,
  RefreshCcw,
  RotateCcw,
  Save,
  SearchCheck,
  Settings2,
  ShieldCheck,
  ShieldOff,
  SlidersHorizontal,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";

import {
  DEFAULT_SCAN_SETTINGS,
  SCAN_SETTINGS_STORAGE_KEY,
} from "@/lib/scan-settings";
import type { ScanSettings } from "@/lib/scan-settings";
import { ScanSettingsForm } from "@/components/scan/scan-settings-form";

type SettingsTab = "automation" | "manual-scan" | "users" | "agents";

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
    lowSpacePercentThreshold: number;
    notifyEmailEnabled: boolean;
    notifyEmailRecipients: string[];
    smtpHost: string | null;
    smtpPort: number | null;
    smtpUser: string | null;
    smtpFrom: string | null;
    smtpPasswordSet: boolean;
    // Client-only field: the new password being typed, if any. Never
    // populated from the server (the API never echoes the stored password).
    smtpPassword?: string;
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
      scheduledScanEnabled: boolean;
      scheduledScanIntervalHours: number;
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

type NavItem = {
  id: SettingsTab;
  label: string;
  description: string;
  icon: React.ReactNode;
};

const NAV_ITEMS: NavItem[] = [
  {
    id: "automation",
    label: "Automatisation",
    description: "Surveillance et notifications",
    icon: <SlidersHorizontal className="h-4 w-4" />,
  },
  {
    id: "manual-scan",
    label: "Scan manuel",
    description: "Lancer un scan immédiat",
    icon: <SearchCheck className="h-4 w-4" />,
  },
  {
    id: "users",
    label: "Utilisateurs",
    description: "Comptes et rôles",
    icon: <Users className="h-4 w-4" />,
  },
  {
    id: "agents",
    label: "Appareils agents",
    description: "Machines connectées",
    icon: <Laptop className="h-4 w-4" />,
  },
];

export function SettingsPageClient() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const [activeTab, setActiveTab] = useState<SettingsTab>("automation");

  const visibleNavItems = useMemo(
    () => (isAdmin ? NAV_ITEMS : NAV_ITEMS.filter((item) => item.id !== "users")),
    [isAdmin]
  );

  const activeItem =
    visibleNavItems.find((item) => item.id === activeTab) ?? visibleNavItems[0];

  useEffect(() => {
    if (activeTab === "users" && !isAdmin) {
      setActiveTab("automation");
    }
  }, [activeTab, isAdmin]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
          <Settings2 className="h-3.5 w-3.5" />
          Paramètres Disk Indexer
        </div>

        <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
          Paramètres
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Configure la surveillance automatique, les scans manuels, les
          utilisateurs et les appareils agents depuis une seule interface.
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto rounded-xl border bg-muted/30 p-1.5 lg:hidden">
        {visibleNavItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
              activeTab === item.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid overflow-hidden rounded-2xl border bg-background shadow-sm lg:grid-cols-[260px_1fr]">
        <nav className="hidden border-r bg-muted/20 p-3 lg:block">
          <ul className="space-y-1">
            {visibleNavItems.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition",
                    activeTab === item.id
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                      activeTab === item.id
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {item.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate">{item.label}</span>
                    <span className="block truncate text-xs text-muted-foreground/80">
                      {item.description}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <main className="min-w-0 p-5 sm:p-8">
          <div className="mb-6 border-b pb-4">
            <h2 className="text-lg font-semibold">{activeItem.label}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {activeItem.description}
            </p>
          </div>

          {activeTab === "automation" ? <AutomationSettingsPanel /> : null}
          {activeTab === "manual-scan" ? <ManualScanPanel /> : null}
          {activeTab === "users" ? <UsersPanel /> : null}
          {activeTab === "agents" ? <AgentDevicesPanel /> : null}
        </main>
      </div>
    </div>
  );
}

function AutomationSettingsPanel() {
  const [data, setData] = useState<AutomationSettingsPayload | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState("");
  const [testingEmail, setTestingEmail] = useState(false);

  async function sendTestEmail() {
    if (!testEmailAddress.trim() || !data) return;

    setTestingEmail(true);

    try {
      const response = await fetch("/api/automation/settings/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: testEmailAddress.trim(),
          smtpHost: data.settings.smtpHost || undefined,
          smtpPort: data.settings.smtpPort || undefined,
          smtpUser: data.settings.smtpUser || undefined,
          smtpPassword: data.settings.smtpPassword || undefined,
          smtpFrom: data.settings.smtpFrom || undefined,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Échec de l'envoi.");
      }

      toast.success("Email envoyé", { description: payload.message });
    } catch (error) {
      toast.error("Échec de l'envoi", {
        description:
          error instanceof Error ? error.message : "Vérifie la configuration SMTP.",
      });
    } finally {
      setTestingEmail(false);
    }
  }

  async function load() {
    setError("");

    try {
      const response = await fetch("/api/automation/settings", {
        cache: "no-store",
      });

      const payload = (await response
        .json()
        .catch(() => ({}))) as AutomationSettingsPayload & { error?: string };

      if (!response.ok) {
        throw new Error(
          payload.error || "Impossible de charger les paramètres d’automatisation."
        );
      }

      setData(payload);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Impossible de charger les paramètres d’automatisation.";

      setError(message);
      toast.error("Erreur", { description: message });
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

  if (!data && error) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>

        <Button variant="outline" onClick={() => void load()}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          Réessayer
        </Button>
      </div>
    );
  }

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
              scheduledScanEnabled: false,
              scheduledScanIntervalHours: 24,
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
            scheduledScanEnabled: false,
            scheduledScanIntervalHours: 24,
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
    <div className="space-y-8 pb-20">
      <SettingsSection
        title="Surveillance globale"
        description="Configure le comportement général de l’automatisation."
      >
        <div className="divide-y">
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
        </div>
      </SettingsSection>

      <SettingsSection
        title="Délais"
        description="Ajuste la fréquence des notifications et changements."
      >
        <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <SettingField label="Cooldown notifications" hint="En secondes.">
            <input
              className="h-9 w-28 rounded-md border bg-background px-3 text-sm"
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
          </SettingField>

          <SettingField label="Anti-spam changements" hint="En secondes.">
            <input
              className="h-9 w-28 rounded-md border bg-background px-3 text-sm"
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
          </SettingField>

          <SettingField
            label="Seuil d'espace disque faible"
            hint="Alerte quand l'espace libre passe sous ce pourcentage."
          >
            <input
              className="h-9 w-28 rounded-md border bg-background px-3 text-sm"
              type="number"
              min={1}
              max={90}
              value={data.settings.lowSpacePercentThreshold}
              onChange={(e) =>
                updateGlobal(
                  "lowSpacePercentThreshold",
                  Math.min(90, Math.max(1, Number(e.target.value) || 10))
                )
              }
            />
          </SettingField>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Notifications email"
        description="Envoie aussi les alertes importantes par email."
      >
        <div className="space-y-4">
          <SettingToggle
            label="Activer les notifications email"
            description="Nécessite un serveur SMTP configuré ci-dessous."
            checked={data.settings.notifyEmailEnabled}
            onChange={(checked) => updateGlobal("notifyEmailEnabled", checked)}
          />

          <SettingField
            label="Destinataires"
            hint="Une adresse email par ligne."
          >
            <textarea
              className="min-h-[90px] w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={data.settings.notifyEmailRecipients.join("\n")}
              placeholder="admin@exemple.com"
              onChange={(e) =>
                updateGlobal(
                  "notifyEmailRecipients",
                  e.target.value
                    .split("\n")
                    .map((item) => item.trim())
                    .filter(Boolean)
                )
              }
            />
          </SettingField>

          <div className="grid gap-4 rounded-xl border bg-muted/10 p-4 sm:grid-cols-2">
            <SettingField label="Serveur SMTP" hint="Ex. smtp.gmail.com">
              <input
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={data.settings.smtpHost ?? ""}
                placeholder="smtp.gmail.com"
                onChange={(e) => updateGlobal("smtpHost", e.target.value)}
              />
            </SettingField>

            <SettingField label="Port" hint="587 (STARTTLS) ou 465 (SSL)">
              <input
                type="number"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={data.settings.smtpPort ?? ""}
                placeholder="587"
                onChange={(e) =>
                  updateGlobal(
                    "smtpPort",
                    e.target.value ? Number(e.target.value) : null
                  )
                }
              />
            </SettingField>

            <SettingField label="Utilisateur SMTP" hint="Ton adresse Gmail complète">
              <input
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={data.settings.smtpUser ?? ""}
                placeholder="toncompte@gmail.com"
                onChange={(e) => updateGlobal("smtpUser", e.target.value)}
              />
            </SettingField>

            <SettingField
              label="Mot de passe SMTP"
              hint={
                data.settings.smtpPasswordSet
                  ? "Un mot de passe est déjà enregistré — laisse vide pour le garder."
                  : "Pour Gmail : un mot de passe d'application, pas ton mot de passe habituel."
              }
            >
              <input
                type="password"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={data.settings.smtpPassword ?? ""}
                placeholder={
                  data.settings.smtpPasswordSet ? "••••••••••••••••" : ""
                }
                onChange={(e) => updateGlobal("smtpPassword", e.target.value)}
              />
            </SettingField>

            <SettingField
              label="Adresse d'expédition"
              hint="Optionnel — utilise l'utilisateur SMTP par défaut."
            >
              <input
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={data.settings.smtpFrom ?? ""}
                placeholder={data.settings.smtpUser ?? ""}
                onChange={(e) => updateGlobal("smtpFrom", e.target.value)}
              />
            </SettingField>

            <div className="sm:col-span-2">
              <SettingField
                label="Tester l'envoi"
                hint="Envoie un email avec les valeurs ci-dessus, même si tu n'as pas encore enregistré."
              >
                <div className="flex gap-2">
                  <input
                    type="email"
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                    value={testEmailAddress}
                    placeholder="toi@exemple.com"
                    onChange={(e) => setTestEmailAddress(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!testEmailAddress.trim() || testingEmail}
                    onClick={() => void sendTestEmail()}
                  >
                    {testingEmail ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <SearchCheck className="h-4 w-4" />
                    )}
                    Envoyer
                  </Button>
                </div>
              </SettingField>
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Exclusions globales"
        description="Ignore certains disques, racines ou motifs de chemin."
      >
        <div className="grid gap-6 md:grid-cols-2">
          <SettingField label="Disques / racines ignorés" hint="Une entrée par ligne.">
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
          </SettingField>

          <SettingField label="Chemins / motifs ignorés" hint="Une entrée par ligne.">
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
          </SettingField>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Disques surveillés"
        description="Paramétrage disque par disque."
      >
        {data.disks.length === 0 ? (
          <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            Aucun disque trouvé.
          </div>
        ) : (
          <Accordion type="multiple" className="space-y-2">
            {data.disks.map((disk) => {
              const pref = disk.preference ?? {
                monitorEnabled: true,
                notifyOnConnect: true,
                notifyOnChange: true,
                autoUpdateWithoutPrompt: false,
                muted: false,
                ignoredPaths: [],
                scheduledScanEnabled: false,
                scheduledScanIntervalHours: 24,
              };

              return (
                <AccordionItem
                  key={disk.id}
                  value={disk.id}
                  className="rounded-xl border border-b-0"
                >
                  <AccordionTrigger className="px-4 py-3 hover:no-underline">
                    <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                      <div className="min-w-0 text-left">
                        <p className="truncate text-sm font-medium">
                          {disk.code} — {disk.name}
                        </p>
                        <p className="truncate font-mono text-xs text-muted-foreground">
                          {disk.rootPath}
                        </p>
                      </div>

                      <span className="shrink-0 rounded-full border bg-muted px-2.5 py-1 text-xs font-normal text-muted-foreground">
                        {disk.status}
                      </span>
                    </div>
                  </AccordionTrigger>

                  <AccordionContent className="border-t px-4 pb-3 pt-3">
                    <div className="divide-y">
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

                      <SettingToggle
                        label="Scan complet planifié"
                        checked={pref.scheduledScanEnabled}
                        onChange={(checked) =>
                          updateDiskPreference(
                            disk.id,
                            "scheduledScanEnabled",
                            checked
                          )
                        }
                      />
                    </div>

                    {pref.scheduledScanEnabled ? (
                      <div className="mt-4">
                        <SettingField label="Fréquence du scan planifié (heures)">
                          <input
                            type="number"
                            min={1}
                            max={168}
                            className="h-9 w-32 rounded-md border bg-background px-3 text-sm"
                            value={pref.scheduledScanIntervalHours}
                            onChange={(e) =>
                              updateDiskPreference(
                                disk.id,
                                "scheduledScanIntervalHours",
                                Math.min(168, Math.max(1, Number(e.target.value) || 24))
                              )
                            }
                          />
                          <p className="mt-1 text-xs text-muted-foreground">
                            Un scan complet automatique s’exécute en filet de sécurité,
                            en plus de la détection en direct.
                          </p>
                        </SettingField>
                      </div>
                    ) : null}

                    <div className="mt-4">
                      <SettingField label="Chemins ignorés pour ce disque">
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
                      </SettingField>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </SettingsSection>

      <div className="sticky bottom-4 z-10 flex flex-wrap gap-3 rounded-2xl border bg-background/95 p-3 shadow-lg backdrop-blur">
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
          onClick={() => setResetConfirmOpen(true)}
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Réinitialiser les préférences
        </Button>
      </div>

      <Dialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Réinitialiser les préférences ?
            </DialogTitle>
            <DialogDescription>
              Cette action efface les racines et motifs ignorés globaux, et
              remet à zéro les préférences de surveillance (activation,
              notifications, mise à jour automatique, mise en sourdine,
              chemins ignorés) de <strong>tous les disques</strong>. Elle est
              appliquée immédiatement et ne peut pas être annulée.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setResetConfirmOpen(false)}
              disabled={saving}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="rounded-xl"
              disabled={saving}
              onClick={() => {
                setResetConfirmOpen(false);
                void save(true);
              }}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              Réinitialiser maintenant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
    <div className="grid gap-8 xl:grid-cols-[360px_1fr]">
      <div className="space-y-4">
        <SettingField label="Disque">
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
        </SettingField>

        {selectedDisk ? (
          <div className="rounded-xl border bg-muted/20 px-4 py-3 text-sm">
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
          <div className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
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
          <div className="space-y-3 rounded-xl border bg-muted/20 px-4 py-4">
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
          <div className="rounded-xl border bg-muted/20 px-4 py-3">
            <p className="mb-1 text-sm font-medium">Résultat</p>
            <p className="break-all text-xs text-muted-foreground">
              {resultText}
            </p>
          </div>
        ) : null}
      </div>

      <div className="space-y-6 border-t pt-6 xl:border-l xl:border-t-0 xl:pl-8 xl:pt-0">
        <div>
          <h3 className="text-sm font-semibold">Paramètres du scan</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Ces réglages sont appliqués uniquement au scan manuel courant.
          </p>
        </div>

        <ScanSettingsForm
          value={settings}
          onChange={setSettings}
          disabled={running}
        />

        <div className="flex items-center gap-2 rounded-xl border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          <SearchCheck className="h-4 w-4" />
          Tu peux modifier ces paramètres sans toucher aux réglages
          d’automatisation enregistrés.
        </div>
      </div>
    </div>
  );
}

type RoleChangeTarget = {
  id: string;
  email: string;
  nextRole: UserRole;
};

function UsersPanel() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [roleChangeTarget, setRoleChangeTarget] =
    useState<RoleChangeTarget | null>(null);

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
      <div className="space-y-4">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>

        <Button variant="outline" onClick={() => void loadUsers()}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          Réessayer
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid flex-1 gap-3 sm:grid-cols-3">
          <StatsCard label="Utilisateurs" value={String(users.length)} />
          <StatsCard label="Administrateurs" value={String(adminCount)} />
          <StatsCard label="Comptes actifs" value={String(activeCount)} />
        </div>

        <Button variant="outline" onClick={() => void loadUsers()}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          Actualiser
        </Button>
      </div>

      {users.length === 0 ? (
        <div className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          Aucun utilisateur trouvé.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
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
                  <div className="flex min-w-0 items-start gap-3">
                    <UserAvatar name={user.name} email={user.email} className="mt-0.5 h-8 w-8 shrink-0" />

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
                      onChange={(e) => {
                        const nextRole = e.target.value as UserRole;
                        if (nextRole === user.role) return;
                        setRoleChangeTarget({
                          id: user.id,
                          email: user.email,
                          nextRole
                        });
                      }}
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

      <Dialog
        open={roleChangeTarget !== null}
        onOpenChange={(next) => !next && setRoleChangeTarget(null)}
      >
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirmer le changement de rôle
            </DialogTitle>
            <DialogDescription>
              {roleChangeTarget ? (
                <>
                  <strong>{roleChangeTarget.email}</strong> passera du rôle
                  actuel à <strong>{roleChangeTarget.nextRole}</strong>.
                  {roleChangeTarget.id === session?.user?.id
                    ? ' Tu es sur le point de modifier ton propre rôle.'
                    : ''}
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setRoleChangeTarget(null)}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="rounded-xl"
              onClick={() => {
                if (!roleChangeTarget) return;
                void updateUserRole(
                  roleChangeTarget.id,
                  roleChangeTarget.nextRole
                );
                setRoleChangeTarget(null);
              }}
            >
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type AgentDeviceStatus = "ONLINE" | "OFFLINE" | "DISABLED";

type AgentDevice = {
  id: string;
  machineId: string;
  hostName: string;
  userLabel: string | null;
  osName: string | null;
  appVersion: string | null;
  status: AgentDeviceStatus;
  rawStatus: AgentDeviceStatus;
  lastSeenAt: string | null;
  lastHeartbeatAt: string | null;
  createdAt: string;
  diskCount: number;
  activeTokenCount: number;
};

type AgentDeviceActionState =
  | { type: "rename"; device: AgentDevice }
  | { type: "revoke"; device: AgentDevice }
  | { type: "reactivate"; device: AgentDevice }
  | { type: "delete"; device: AgentDevice }
  | null;

const agentStatusStyles: Record<AgentDeviceStatus, string> = {
  ONLINE:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  OFFLINE: "border-muted-foreground/20 bg-muted text-muted-foreground",
  DISABLED: "border-destructive/30 bg-destructive/10 text-destructive"
};

const agentStatusLabels: Record<AgentDeviceStatus, string> = {
  ONLINE: "En ligne",
  OFFLINE: "Hors ligne",
  DISABLED: "Désactivé"
};

function AgentDevicesPanel() {
  const [devices, setDevices] = useState<AgentDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionState, setActionState] = useState<AgentDeviceActionState>(null);
  const [renameValue, setRenameValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function loadDevices() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/agent-devices", { cache: "no-store" });
      const payload = (await response.json().catch(() => [])) as
        | AgentDevice[]
        | { error?: string };

      if (!response.ok) {
        throw new Error(
          !Array.isArray(payload) && payload.error
            ? payload.error
            : "Impossible de charger les appareils agents."
        );
      }

      setDevices(Array.isArray(payload) ? payload : []);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Impossible de charger les appareils agents.";
      setError(message);
      toast.error("Erreur", { description: message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDevices();
  }, []);

  function openRename(device: AgentDevice) {
    setRenameValue(device.userLabel ?? "");
    setActionState({ type: "rename", device });
  }

  async function submitRename() {
    if (actionState?.type !== "rename") return;
    const trimmed = renameValue.trim();

    if (!trimmed) {
      toast.error("Nom requis", {
        description: "Le nom de l'appareil ne peut pas être vide."
      });
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`/api/agent-devices/${actionState.device.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userLabel: trimmed })
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Impossible de renommer l'appareil.");
      }

      toast.success("Appareil renommé");
      setActionState(null);
      await loadDevices();
    } catch (err) {
      toast.error("Erreur", {
        description:
          err instanceof Error
            ? err.message
            : "Impossible de renommer l'appareil."
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function submitRevoke() {
    if (actionState?.type !== "revoke") return;
    setSubmitting(true);

    try {
      const response = await fetch(
        `/api/agent-devices/${actionState.device.id}/revoke`,
        { method: "POST" }
      );

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Impossible de révoquer l'appareil.");
      }

      toast.success("Accès révoqué", { description: payload.message });
      setActionState(null);
      await loadDevices();
    } catch (err) {
      toast.error("Erreur", {
        description:
          err instanceof Error
            ? err.message
            : "Impossible de révoquer l'appareil."
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function submitReactivate() {
    if (actionState?.type !== "reactivate") return;
    setSubmitting(true);

    try {
      const response = await fetch(
        `/api/agent-devices/${actionState.device.id}/reactivate`,
        { method: "POST" }
      );

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Impossible de réactiver l'appareil.");
      }

      toast.success("Appareil réactivé", { description: payload.message });
      setActionState(null);
      await loadDevices();
    } catch (err) {
      toast.error("Erreur", {
        description:
          err instanceof Error
            ? err.message
            : "Impossible de réactiver l'appareil."
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function submitDelete() {
    if (actionState?.type !== "delete") return;
    setSubmitting(true);

    try {
      const response = await fetch(`/api/agent-devices/${actionState.device.id}`, {
        method: "DELETE"
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Impossible de supprimer l'appareil.");
      }

      toast.success("Appareil supprimé");
      setActionState(null);
      await loadDevices();
    } catch (err) {
      toast.error("Erreur", {
        description:
          err instanceof Error
            ? err.message
            : "Impossible de supprimer l'appareil."
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <LoadingBlock label="Chargement des appareils agents..." />;
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>

        <Button variant="outline" onClick={() => void loadDevices()}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          Réessayer
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl text-sm text-muted-foreground">
          Machines ayant enregistré un agent pour indexer leurs disques.
          Révoque l'accès d'un appareil perdu, remplacé ou compromis.
        </p>

        <Button variant="outline" onClick={() => void loadDevices()}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          Actualiser
        </Button>
      </div>

      {devices.length === 0 ? (
        <div className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          Aucun appareil agent enregistré pour le moment.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <div className="hidden grid-cols-[1fr_120px_160px_120px_240px] gap-4 border-b bg-muted/40 px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid">
            <span>Appareil</span>
            <span>Statut</span>
            <span>Dernier contact</span>
            <span>Disques</span>
            <span>Actions</span>
          </div>

          <div className="divide-y">
            {devices.map((device) => (
              <div
                key={device.id}
                className="grid gap-4 px-4 py-4 md:grid-cols-[1fr_120px_160px_120px_240px] md:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {device.userLabel || device.hostName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {device.hostName} • {device.machineId}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {device.osName || "OS inconnu"}
                    {device.appVersion ? ` • v${device.appVersion}` : ""}
                  </p>
                </div>

                <div>
                  <span
                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${agentStatusStyles[device.status]}`}
                  >
                    {agentStatusLabels[device.status]}
                  </span>
                </div>

                <div className="text-xs text-muted-foreground">
                  {device.lastHeartbeatAt
                    ? formatDistanceToNow(new Date(device.lastHeartbeatAt), {
                        addSuffix: true,
                        locale: fr
                      })
                    : "Jamais"}
                </div>

                <div className="text-sm">{device.diskCount}</div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openRename(device)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Renommer
                  </Button>

                  {device.rawStatus === "DISABLED" ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setActionState({ type: "reactivate", device })
                      }
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Réactiver
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setActionState({ type: "revoke", device })}
                    >
                      <ShieldOff className="h-3.5 w-3.5" />
                      Révoquer
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => setActionState({ type: "delete", device })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Supprimer
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog
        open={actionState?.type === "rename"}
        onOpenChange={(next) => !next && setActionState(null)}
      >
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Renommer l'appareil</DialogTitle>
            <DialogDescription>
              Ce nom s'affiche à la place du nom de machine dans l'application.
            </DialogDescription>
          </DialogHeader>

          <input
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder="Ex : Poste de Manoly"
            autoFocus
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setActionState(null)}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button
              type="button"
              className="rounded-xl"
              onClick={() => void submitRename()}
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={actionState?.type === "revoke"}
        onOpenChange={(next) => !next && setActionState(null)}
      >
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Révoquer cet appareil ?
            </DialogTitle>
            <DialogDescription>
              {actionState?.type === "revoke" ? (
                <>
                  <strong>
                    {actionState.device.userLabel || actionState.device.hostName}
                  </strong>{" "}
                  sera désactivé et son token d'accès invalidé immédiatement. Il ne
                  pourra plus envoyer de scans ni de battements de vie tant qu'il
                  ne se sera pas réenregistré avec le secret d'enregistrement.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setActionState(null)}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="rounded-xl"
              onClick={() => void submitRevoke()}
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldOff className="h-4 w-4" />
              )}
              Révoquer l'accès
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={actionState?.type === "reactivate"}
        onOpenChange={(next) => !next && setActionState(null)}
      >
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Réactiver cet appareil ?</DialogTitle>
            <DialogDescription>
              {actionState?.type === "reactivate" ? (
                <>
                  <strong>
                    {actionState.device.userLabel || actionState.device.hostName}
                  </strong>{" "}
                  pourra à nouveau se connecter, mais devra se réenregistrer avec
                  le secret d'enregistrement pour obtenir un nouveau token — son
                  ancien token reste invalide.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setActionState(null)}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button
              type="button"
              className="rounded-xl"
              onClick={() => void submitReactivate()}
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              Réactiver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={actionState?.type === "delete"}
        onOpenChange={(next) => !next && setActionState(null)}
      >
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Supprimer cet appareil ?
            </DialogTitle>
            <DialogDescription>
              {actionState?.type === "delete" ? (
                <>
                  <strong>
                    {actionState.device.userLabel || actionState.device.hostName}
                  </strong>{" "}
                  et ses tokens seront supprimés définitivement.
                  {actionState.device.diskCount > 0
                    ? ` Les ${actionState.device.diskCount} disque(s) associé(s) resteront dans l'application mais ne seront plus liés à un agent.`
                    : ""}{" "}
                  Cette action est irréversible.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setActionState(null)}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="rounded-xl"
              onClick={() => void submitDelete()}
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Supprimer définitivement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b pb-8 last:border-b-0 last:pb-0">
      <h3 className="text-sm font-semibold">{title}</h3>
      {description ? (
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
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
    <div className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>

      <Switch
        checked={checked}
        onCheckedChange={onChange}
        className="mt-0.5 shrink-0"
      />
    </div>
  );
}

function LoadingBlock({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

function SettingField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function StatsCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-muted/20 px-4 py-3">
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
