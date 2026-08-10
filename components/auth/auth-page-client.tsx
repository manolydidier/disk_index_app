// components/auth/auth-page-client.tsx

"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { HardDrive } from "lucide-react";

import { AuthForm, type AuthMode } from "@/components/auth/auth-form";

export function AuthPageClient() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [mode, setMode] = useState<AuthMode>("login");

  return (
    <div className="w-full">
      <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
        <div className="rounded-2xl bg-primary p-2.5 text-primary-foreground shadow-sm lg:hidden">
          <HardDrive className="h-6 w-6" />
        </div>

        <h1 className="mt-4 text-xl font-semibold lg:mt-0">
          {mode === "login" ? "Connexion" : "Inscription"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "login"
            ? "Connecte-toi pour accéder à Disk Indexer."
            : "Crée ton compte pour accéder à Disk Indexer."}
        </p>
      </div>

      <div className="mt-6">
        <AuthForm mode={mode} onModeChange={setMode} callbackUrl={callbackUrl} />
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground lg:text-left">
        Pas encore de compte ? Contacte un administrateur de ton organisation.
      </p>
    </div>
  );
}
