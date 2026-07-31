// components/auth/auth-actions.tsx

"use client";

import { useSession } from "next-auth/react";

import { AuthModal } from "@/components/auth/auth-modal";
import { LogoutButton } from "@/components/auth/logout-button";
import { Button } from "@/components/ui/button";

export function AuthActions() {
  const { status } = useSession();

  if (status === "loading") {
    return (
      <Button variant="outline" size="sm" disabled>
        Chargement...
      </Button>
    );
  }

  if (status === "authenticated") {
    return <LogoutButton />;
  }

  return <AuthModal triggerLabel="Connexion" callbackUrl="/" />;
}