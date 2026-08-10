// components/auth/auth-actions.tsx

"use client";

import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";

import { AuthModal } from "@/components/auth/auth-modal";
import { LogoutButton } from "@/components/auth/logout-button";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";

export function AuthActions() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  if (status === "loading") {
    return (
      <Button variant="outline" size="sm" disabled>
        Chargement...
      </Button>
    );
  }

  if (status === "authenticated") {
    const user = session?.user;

    return (
      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-2 sm:flex">
          <UserAvatar name={user?.name} email={user?.email} className="h-8 w-8" />
          <span className="max-w-[140px] truncate text-sm font-medium" title={user?.name ?? user?.email ?? undefined}>
            {user?.name || user?.email}
          </span>
        </div>

        <LogoutButton />
      </div>
    );
  }

  // The /login page already offers the full login/register flow inline —
  // showing this trigger there would open a second, competing form.
  if (pathname === "/login") {
    return null;
  }

  return <AuthModal triggerLabel="Connexion" callbackUrl="/" />;
}