// app/layout.tsx

import type { Metadata } from 'next';
import Link from 'next/link';
import { Fira_Code, Fira_Sans } from 'next/font/google';
import { Toaster } from 'sonner';
import { ChevronDown, Files, HardDrive, PieChart, Search, Settings2, LayoutGrid, Wrench } from 'lucide-react';

import './globals.css';

const fontSans = Fira_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap'
});

const fontMono = Fira_Code({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap'
});

import { NotificationDock } from '@/components/providers/notification-dock';
import { AuthProvider } from '@/components/providers/auth-provider';
import { AuthActions } from '@/components/auth/auth-actions';
import { NavLink } from '@/components/layout/nav-link';
import { MobileNav } from '@/components/layout/mobile-nav';
import { CommandPalette } from '@/components/layout/command-palette';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

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
    <html lang="fr" suppressHydrationWarning className={`${fontSans.variable} ${fontMono.variable}`}>
      <body className="min-h-screen bg-muted/30 font-sans text-foreground antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <TooltipProvider delayDuration={200}>
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

                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex items-center gap-2 rounded-full border border-transparent px-3 py-2 text-sm text-muted-foreground outline-none transition hover:border-border hover:bg-muted hover:text-foreground data-[state=open]:border-border data-[state=open]:bg-muted data-[state=open]:text-foreground">
                        <Wrench className="h-4 w-4" />
                        <span>Outils</span>
                        <ChevronDown className="h-3.5 w-3.5" />
                      </DropdownMenuTrigger>

                      <DropdownMenuContent align="start">
                        <DropdownMenuLabel>Outils d&apos;analyse</DropdownMenuLabel>

                        <DropdownMenuItem asChild>
                          <Link href="/storage">
                            <PieChart className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium">Analyse d&apos;espace</p>
                              <p className="text-xs text-muted-foreground">
                                Répartition du stockage par type de fichier
                              </p>
                            </div>
                          </Link>
                        </DropdownMenuItem>

                        <DropdownMenuItem asChild>
                          <Link href="/duplicates">
                            <Files className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium">Doublons</p>
                              <p className="text-xs text-muted-foreground">
                                Fichiers en double par nom et taille
                              </p>
                            </div>
                          </Link>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <NavLink
                      href="/settings/automation"
                      icon={<Settings2 className="h-4 w-4" />}
                    >
                      Automatisation
                    </NavLink>
                  </nav>
                </div>

                <div className="flex items-center gap-2 sm:gap-3">
                  <CommandPalette />

                  <ThemeToggle />

                  <AuthActions />

                  <MobileNav />
                </div>
              </div>
            </header>

            <main className="mx-auto w-full max-w-[1700px] px-4 py-6 sm:px-6 xl:px-8">
              {children}
            </main>
          </div>

          <NotificationDock />
        </AuthProvider>
        </TooltipProvider>
        </ThemeProvider>

        <Toaster richColors position="top-right" closeButton />
      </body>
    </html>
  );
}

