// components/auth/auth-modal.tsx

"use client";

import { FormEvent, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AuthMode = "login" | "register";

type AuthModalProps = {
  triggerLabel?: string;
  callbackUrl?: string;
};

export function AuthModal({
  triggerLabel = "Connexion",
  callbackUrl = "/",
}: AuthModalProps) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("login");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  function resetForm() {
    setName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setError("");
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    resetForm();
  }

  async function handleLogin() {
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });

    if (result?.error) {
      setError("Email ou mot de passe invalide.");
      return;
    }

    setOpen(false);
    router.push(callbackUrl);
    router.refresh();
  }

  async function handleRegister() {
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    const response = await fetch("/api/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        email,
        password,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Impossible de créer le compte.");
      return;
    }

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });

    if (result?.error) {
      setError("Compte créé, mais connexion automatique impossible.");
      return;
    }

    setOpen(false);
    router.push(callbackUrl);
    router.refresh();
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError("");
    setIsLoading(true);

    try {
      if (mode === "login") {
        await handleLogin();
      } else {
        await handleRegister();
      }
    } catch {
      setError("Une erreur est survenue. Réessaie plus tard.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button type="button">{triggerLabel}</Button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />

        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-background p-6 shadow-lg">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-xl font-semibold">
                {mode === "login" ? "Connexion" : "Inscription"}
              </Dialog.Title>

              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                {mode === "login"
                  ? "Connecte-toi pour accéder à Disk Indexer."
                  : "Crée ton compte pour accéder à Disk Indexer."}
              </Dialog.Description>
            </div>

            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-6 grid grid-cols-2 rounded-xl bg-muted p-1">
            <button
              type="button"
              onClick={() => switchMode("login")}
              className={
                mode === "login"
                  ? "rounded-lg bg-background px-3 py-2 text-sm font-medium shadow-sm"
                  : "rounded-lg px-3 py-2 text-sm text-muted-foreground"
              }
            >
              Connexion
            </button>

            <button
              type="button"
              onClick={() => switchMode("register")}
              className={
                mode === "register"
                  ? "rounded-lg bg-background px-3 py-2 text-sm font-medium shadow-sm"
                  : "rounded-lg px-3 py-2 text-sm text-muted-foreground"
              }
            >
              Inscription
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === "register" ? (
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium">
                  Nom
                </label>

                <Input
                  id="name"
                  name="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Admin"
                  autoComplete="name"
                />
              </div>
            ) : null}

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>

              <Input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@diskindexer.local"
                autoComplete="email"
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Mot de passe
              </label>

              <Input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                required
              />
            </div>

            {mode === "register" ? (
              <div className="space-y-2">
                <label
                  htmlFor="confirmPassword"
                  className="text-sm font-medium"
                >
                  Confirmer le mot de passe
                </label>

                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                />
              </div>
            ) : null}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {mode === "login"
                    ? "Connexion..."
                    : "Création du compte..."}
                </>
              ) : mode === "login" ? (
                "Se connecter"
              ) : (
                "Créer mon compte"
              )}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            {mode === "login" ? (
              <>
                Pas encore de compte ?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("register")}
                  className="font-medium underline"
                >
                  Créer un compte
                </button>
              </>
            ) : (
              <>
                Déjà un compte ?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="font-medium underline"
                >
                  Se connecter
                </button>
              </>
            )}
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}