// components/auth/auth-page-client.tsx

"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

import { AuthForm, type AuthMode } from "@/components/auth/auth-form";

export function AuthPageClient() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [mode, setMode] = useState<AuthMode>("login");

  return (
    <div className="w-full rounded-2xl border bg-background p-6 shadow-sm">
      <h1 className="text-xl font-semibold">
        {mode === "login" ? "Connexion" : "Inscription"}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {mode === "login"
          ? "Connecte-toi pour accéder à Disk Indexer."
          : "Crée ton compte pour accéder à Disk Indexer."}
      </p>

      <div className="mt-6">
        <AuthForm mode={mode} onModeChange={setMode} callbackUrl={callbackUrl} />
      </div>
    </div>
  );
}
