'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Files, HardDrive, LayoutGrid, Menu, PieChart, Search, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

const MOBILE_NAV_ITEMS = [
  { href: '/', label: 'Tableau de bord', icon: <LayoutGrid className="h-4 w-4" /> },
  { href: '/search', label: 'Recherche', icon: <Search className="h-4 w-4" /> },
  { href: '/storage', label: "Analyse d'espace", icon: <PieChart className="h-4 w-4" /> },
  { href: '/duplicates', label: 'Doublons', icon: <Files className="h-4 w-4" /> },
  { href: '/settings/automation', label: 'Automatisation', icon: <Settings2 className="h-4 w-4" /> }
];

function isActivePath(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-full md:hidden"
          aria-label="Ouvrir le menu"
        >
          <Menu className="h-4 w-4" />
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-[280px] p-0 sm:w-[320px]">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle className="flex items-center gap-2 text-base">
            <div className="rounded-xl bg-primary p-1.5 text-primary-foreground">
              <HardDrive className="h-4 w-4" />
            </div>
            Disk Indexer
          </SheetTitle>
        </SheetHeader>

        <nav className="space-y-1 p-3">
          {MOBILE_NAV_ITEMS.map((item) => {
            const active = isActivePath(pathname, item.href);

            return (
              <SheetClose asChild key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition',
                    active
                      ? 'bg-primary/10 font-medium text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  {item.icon}
                  {item.label}
                </Link>
              </SheetClose>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
