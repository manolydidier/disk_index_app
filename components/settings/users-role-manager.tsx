// components/settings/users-role-manager.tsx

"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCcw, ShieldCheck, UserCog } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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

export function UsersRoleManager() {
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
        throw new Error(payload.error || "Impossible de charger les utilisateurs.");
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
        body: JSON.stringify({
          role,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as UpdateRoleResponse;

      if (!response.ok) {
        throw new Error(payload.error || "Impossible de modifier le rôle.");
      }

      if (!payload.user) {
        throw new Error("Réponse invalide du serveur.");
      }

      setUsers((currentUsers) =>
        currentUsers.map((user) =>
          user.id === userId ? payload.user! : user
        )
      );

      toast.success("Rôle modifié", {
        description: `${payload.user.email} est maintenant ${payload.user.role}.`,
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
    return (
      <Card>
        <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement des utilisateurs...
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gestion des utilisateurs</CardTitle>
          <CardDescription>
            Une erreur empêche le chargement des utilisateurs.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
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
      <section className="overflow-hidden rounded-3xl border bg-background shadow-sm">
        <div className="border-b bg-muted/30 px-6 py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                <UserCog className="h-3.5 w-3.5" />
                Administration
              </div>

              <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
                Gestion des utilisateurs
              </h1>

              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Modifie les rôles des utilisateurs et vérifie leur statut.
              </p>
            </div>

            <Button variant="outline" onClick={() => void loadUsers()}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Actualiser
            </Button>
          </div>
        </div>

        <div className="grid gap-4 border-b p-4 sm:grid-cols-3 sm:p-6">
          <StatsCard label="Utilisateurs" value={String(users.length)} />
          <StatsCard label="Administrateurs" value={String(adminCount)} />
          <StatsCard label="Comptes actifs" value={String(activeCount)} />
        </div>

        <div className="p-4 sm:p-6">
          {users.length === 0 ? (
            <div className="rounded-2xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
              Aucun utilisateur trouvé.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border">
              <div className="hidden grid-cols-[1fr_160px_140px_180px] gap-4 border-b bg-muted/40 px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid">
                <span>Utilisateur</span>
                <span>Rôle</span>
                <span>Statut</span>
                <span>Action</span>
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
        </div>
      </section>
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