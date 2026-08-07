'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, Home, RotateCw } from 'lucide-react';

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
      <AlertTriangle className="h-8 w-8 text-destructive" />
      <h2 className="text-lg font-semibold">Une erreur est survenue</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        Quelque chose s&apos;est mal passé lors du chargement de cette page.
        {error.digest ? ` (réf. ${error.digest})` : ''}
      </p>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          <RotateCw className="h-4 w-4" />
          Réessayer
        </button>

        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-muted"
        >
          <Home className="h-4 w-4" />
          Retour au tableau de bord
        </Link>
      </div>
    </div>
  );
}
