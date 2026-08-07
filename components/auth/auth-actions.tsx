// components/auth/auth-actions.tsx

"use client";

import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";

import { AuthModal } from "@/components/auth/auth-modal";
import { LogoutButton } from "@/components/auth/logout-button";
import { Button } from "@/components/ui/button";

export function AuthActions() {
  const { status } = useSession();
  const pathname = usePathname();

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

  // The /login page already offers the full login/register flow inline —
  // showing this trigger there would open a second, competing form.
  if (pathname === "/login") {
    return null;
  }

  return <AuthModal triggerLabel="Connexion" callbackUrl="/" />;
}