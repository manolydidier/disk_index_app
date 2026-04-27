import type { Metadata } from 'next';
import Link from 'next/link';
import { Toaster } from 'sonner';
import { HardDrive } from 'lucide-react';
import './globals.css';
import { Sidebar } from '@/components/layout/sidebar';
import { ActivityMonitor } from '@/components/providers/activity-monitor';

export const metadata: Metadata = {
  title: 'Disk Indexer',
  description: 'Indexation, suivi et recherche multi-disques.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <div className="flex min-h-screen bg-muted/20">
          <Sidebar />
          <div className="flex min-h-screen flex-1 flex-col">
            <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
              <div className="container flex h-16 items-center justify-between">
                <Link href="/" className="flex items-center gap-3 lg:hidden">
                  <div className="rounded-xl bg-primary p-2 text-primary-foreground">
                    <HardDrive className="h-5 w-5" />
                  </div>
                  <span className="font-semibold">Disk Indexer</span>
                </Link>
                <div className="hidden lg:block">
                  <h1 className="text-lg font-semibold">Gestion et indexation de disques</h1>
                  <p className="text-sm text-muted-foreground">Recherche instantanée et supervision des changements.</p>
                </div>
              </div>
            </header>
            <main className="container flex-1 py-8">{children}</main>
          </div>
        </div>
        <ActivityMonitor />
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
