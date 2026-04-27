import Link from 'next/link';
import { HardDrive, Search, LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';

const links = [
  { href: '/', label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/search', label: 'Recherche', icon: Search }
];

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r bg-muted/30 lg:block">
      <div className="flex h-16 items-center border-b px-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary p-2 text-primary-foreground">
            <HardDrive className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold">Disk Indexer</div>
            <div className="text-xs text-muted-foreground">Next.js + Prisma</div>
          </div>
        </div>
      </div>
      <nav className="space-y-1 p-4">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-background hover:text-foreground')}
            >
              <Icon className="h-4 w-4" />
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
