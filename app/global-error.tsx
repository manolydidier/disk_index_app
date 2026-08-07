'use client';

import './globals.css';

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body className="flex min-h-screen items-center justify-center bg-muted/30 p-6 text-foreground antialiased">
        <div className="flex max-w-sm flex-col items-center gap-3 rounded-xl border bg-background px-6 py-10 text-center shadow-sm">
          <h2 className="text-lg font-semibold">L&apos;application a rencontré une erreur</h2>
          <p className="text-sm text-muted-foreground">
            Un problème critique empêche l&apos;affichage de la page.
            {error.digest ? ` (réf. ${error.digest})` : ''}
          </p>

          <button
            type="button"
            onClick={() => reset()}
            className="mt-2 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}
