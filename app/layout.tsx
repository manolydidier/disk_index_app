// app/layout.tsx

import type { Metadata } from 'next';
import Link from 'next/link';
import { Toaster } from 'sonner';
import { HardDrive, Search, Settings2, LayoutGrid } from 'lucide-react';

import './globals.css';

import { ActivityMonitor } from '@/components/providers/activity-monitor';
import { AutomationMonitor } from '@/components/providers/automation-monitor';
import { AuthProvider } from '@/components/providers/auth-provider';
import { AuthActions } from '@/components/auth/auth-actions';

export const metadata: Metadata = {
  title: 'Disk Indexer',
  description: 'Indexation, suivi et recherche multi-disques.'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-muted/30 text-foreground antialiased">
        <AuthProvider>
          <div className="min-h-screen">
            <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur-md">
              <div className="mx-auto flex h-16 w-full max-w-[1700px] items-center justify-between px-4 sm:px-6 xl:px-8">
                <div className="flex items-center gap-6">
                  <Link href="/" className="flex items-center gap-3">
                    <div className="rounded-2xl bg-primary p-2 text-primary-foreground shadow-sm">
                      <HardDrive className="h-5 w-5" />
                    </div>

                    <div className="flex flex-col leading-tight">
                      <span className="text-sm font-semibold sm:text-base">
                        Disk Indexer
                      </span>
                      <span className="hidden text-xs text-muted-foreground sm:block">
                        Gestion et indexation de disques
                      </span>
                    </div>
                  </Link>

                  <nav className="hidden items-center gap-2 md:flex">
                    <NavLink href="/" icon={<LayoutGrid className="h-4 w-4" />}>
                      Tableau de bord
                    </NavLink>

                    <NavLink
                      href="/search"
                      icon={<Search className="h-4 w-4" />}
                    >
                      Recherche
                    </NavLink>

                    <NavLink
                      href="/settings/automation"
                      icon={<Settings2 className="h-4 w-4" />}
                    >
                      Automatisation
                    </NavLink>
                  </nav>
                </div>

                <div className="flex items-center gap-3">
                  <div className="hidden text-right lg:block">
                    <p className="text-sm font-medium">
                      Recherche instantanée et supervision
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Interface épurée et optimisée
                    </p>
                  </div>

                  <AuthActions />

                  <div className="flex items-center gap-2 md:hidden">
                    <MobileIconLink href="/" label="Accueil">
                      <LayoutGrid className="h-4 w-4" />
                    </MobileIconLink>

                    <MobileIconLink href="/search" label="Recherche">
                      <Search className="h-4 w-4" />
                    </MobileIconLink>

                    <MobileIconLink
                      href="/settings/automation"
                      label="Automatisation"
                    >
                      <Settings2 className="h-4 w-4" />
                    </MobileIconLink>
                  </div>
                </div>
              </div>
            </header>

            <main className="mx-auto w-full max-w-[1700px] px-4 py-6 sm:px-6 xl:px-8">
              {children}
            </main>
          </div>

          <ActivityMonitor />
          <AutomationMonitor />
        </AuthProvider>

        <Toaster richColors position="top-right" closeButton />
      </body>
    </html>
  );
}

function NavLink({
  href,
  icon,
  children
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-full border border-transparent px-3 py-2 text-sm text-muted-foreground transition hover:border-border hover:bg-muted hover:text-foreground"
    >
      {icon}
      <span>{children}</span>
    </Link>
  );
}

function MobileIconLink({
  href,
  label,
  children
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border bg-background text-muted-foreground transition hover:bg-muted hover:text-foreground"
    >
      {children}
    </Link>
  );
}