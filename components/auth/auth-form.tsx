// components/auth/auth-form.tsx

"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type AuthMode = "login" | "register";

type AuthFormProps = {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  callbackUrl?: string;
  onSuccess?: () => void;
};

export function AuthForm({
  mode,
  onModeChange,
  callbackUrl = "/",
  onSuccess
}: AuthFormProps) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const passwordTooShort =
    mode === "register" && password.length > 0 && password.length < 8;
  const passwordsMismatch =
    mode === "register" &&
    confirmPassword.length > 0 &&
    password !== confirmPassword;

  function resetForm() {
    setName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setError("");
  }

  function switchMode(nextMode: AuthMode) {
    onModeChange(nextMode);
    resetForm();
  }

  async function handleLogin() {
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl
    });

    if (result?.error) {
      setError(
        result.error === "RATE_LIMITED"
          ? "Trop de tentatives échouées. Réessaie dans quelques minutes."
          : "Email ou mot de passe invalide."
      );
      return;
    }

    onSuccess?.();
    router.push(callbackUrl);
    router.refresh();
  }

  async function handleRegister() {
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    const response = await fetch("/api/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ name, email, password })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(data.error || "Impossible de créer le compte.");
      return;
    }

    if (data.invitedByAdmin) {
      // An admin created this account for someone else — signing in here
      // would replace the admin's own session with the new account's.
      onSuccess?.();
      resetForm();
      router.refresh();
      return;
    }

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl
    });

    if (result?.error) {
      setError("Compte créé, mais connexion automatique impossible.");
      return;
    }

    onSuccess?.();
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

  const submitDisabled =
    isLoading || (mode === "register" && (passwordTooShort || passwordsMismatch));

  return (
    <div>
      <Tabs value={mode} onValueChange={(value) => switchMode(value as AuthMode)}>
        <TabsList className="grid w-full grid-cols-2 rounded-xl">
          <TabsTrigger value="login" className="rounded-lg">
            Connexion
          </TabsTrigger>
          <TabsTrigger value="register" className="rounded-lg">
            Inscription
          </TabsTrigger>
        </TabsList>
      </Tabs>

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
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="password" className="text-sm font-medium">
              Mot de passe
            </label>

            {mode === "login" ? (
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-muted-foreground underline hover:text-foreground"
              >
                Mot de passe oublié ?
              </Link>
            ) : null}
          </div>

          <Input
            id="password"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            aria-invalid={passwordTooShort}
            className={
              passwordTooShort
                ? "border-destructive focus-visible:ring-destructive"
                : undefined
            }
            required
          />
          {passwordTooShort ? (
            <p className="text-xs text-destructive">
              Le mot de passe doit contenir au moins 8 caractères.
            </p>
          ) : null}
        </div>

        {mode === "register" ? (
          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="text-sm font-medium">
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
              aria-invalid={passwordsMismatch}
              className={
                passwordsMismatch
                  ? "border-destructive focus-visible:ring-destructive"
                  : undefined
              }
              required
            />
            {passwordsMismatch ? (
              <p className="text-xs text-destructive">
                Les mots de passe ne correspondent pas.
              </p>
            ) : null}
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Button type="submit" className="w-full" disabled={submitDisabled}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {mode === "login" ? "Connexion..." : "Création du compte..."}
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
    </div>
  );
}
