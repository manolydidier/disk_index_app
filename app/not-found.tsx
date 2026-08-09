import Link from 'next/link';
import { Home, SearchX } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
      <SearchX className="h-8 w-8 text-muted-foreground" />
      <h2 className="text-xl font-semibold">Page introuvable</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        Cette page n'existe pas, ou la ressource demandée a été supprimée.
      </p>

      <Link
        href="/"
        className="mt-2 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
      >
        <Home className="h-4 w-4" />
        Retour au tableau de bord
      </Link>
    </div>
  );
}
