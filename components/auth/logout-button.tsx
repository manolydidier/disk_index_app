'use client';

import { signOut } from 'next-auth/react';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LogoutButton() {
  return (
    <Button
      type="button"
      variant="outline"
      className="gap-2 px-2.5 sm:px-4"
      aria-label="Se déconnecter"
      title="Se déconnecter"
      onClick={() => signOut({ callbackUrl: '/login' })}
    >
      <LogOut className="h-4 w-4" />
      <span className="hidden sm:inline">Déconnexion</span>
    </Button>
  );
}