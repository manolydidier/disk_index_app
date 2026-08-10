'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle
} from '@/components/ui/dialog';
import {
  Files,
  HardDrive,
  LayoutGrid,
  PieChart,
  Search,
  Settings2
} from 'lucide-react';

type DiskOption = {
  id: string;
  code: string;
  name: string;
  status: string;
};

type Command = {
  key: string;
  label: string;
  sublabel?: string;
  href: string;
  icon: React.ReactNode;
};

const STATIC_COMMANDS: Command[] = [
  { key: 'home', label: 'Tableau de bord', href: '/', icon: <LayoutGrid className="h-4 w-4" /> },
  { key: 'search', label: 'Recherche', href: '/search', icon: <Search className="h-4 w-4" /> },
  { key: 'storage', label: "Analyse d'espace", href: '/storage', icon: <PieChart className="h-4 w-4" /> },
  { key: 'duplicates', label: 'Doublons', href: '/duplicates', icon: <Files className="h-4 w-4" /> },
  {
    key: 'Parametres',
    label: 'Parametres',
    href: '/settings/automation',
    icon: <Settings2 className="h-4 w-4" />
  }
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [disks, setDisks] = useState<DiskOption[] | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setSelectedIndex(0);
      return;
    }

    if (!disks) {
      fetch('/api/disks', { cache: 'no-store' })
        .then((res) => (res.ok ? res.json() : []))
        .then((data: DiskOption[]) => setDisks(Array.isArray(data) ? data : []))
        .catch(() => setDisks([]));
    }

    const timeout = window.setTimeout(() => inputRef.current?.focus(), 10);
    return () => window.clearTimeout(timeout);
  }, [open, disks]);

  const commands = useMemo<Command[]>(() => {
    const diskCommands: Command[] = (disks ?? []).map((disk) => ({
      key: `disk:${disk.id}`,
      label: `${disk.code} — ${disk.name}`,
      sublabel: 'Ouvrir la fiche disque',
      href: `/disks/${disk.id}`,
      icon: <HardDrive className="h-4 w-4" />
    }));

    return [...STATIC_COMMANDS, ...diskCommands];
  }, [disks]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((command) => command.label.toLowerCase().includes(q));
  }, [commands, query]);

  function go(command: Command) {
    setOpen(false);
    router.push(command.href);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Accès rapide (Ctrl+K)"
        className="inline-flex h-9 items-center gap-2 rounded-full border bg-background px-3 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Accès rapide</span>
        <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
          Ctrl K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg gap-0 p-0">
        <DialogTitle className="sr-only">Accès rapide</DialogTitle>
        <DialogDescription className="sr-only">
          Recherche rapide dans les pages et les disques indexés
        </DialogDescription>

        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIndex(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setSelectedIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === 'Enter' && filtered[selectedIndex]) {
              e.preventDefault();
              go(filtered[selectedIndex]);
            }
          }}
          placeholder="Aller à une page ou un disque..."
          className="w-full border-b bg-transparent px-4 py-3.5 text-sm outline-none placeholder:text-muted-foreground"
        />

        <div className="max-h-80 overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Aucun résultat pour « {query} »
            </p>
          ) : (
            filtered.map((command, index) => (
              <button
                key={command.key}
                type="button"
                onMouseEnter={() => setSelectedIndex(index)}
                onClick={() => go(command)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                  index === selectedIndex
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted/60'
                }`}
              >
                <span className="text-muted-foreground">{command.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-foreground">
                    {command.label}
                  </span>
                  {command.sublabel ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {command.sublabel}
                    </span>
                  ) : null}
                </span>
              </button>
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t px-4 py-2 text-[11px] text-muted-foreground">
          <span>↑↓ pour naviguer · Entrée pour ouvrir</span>
          <span>Échap pour fermer</span>
        </div>
      </DialogContent>
      </Dialog>
    </>
  );
}
