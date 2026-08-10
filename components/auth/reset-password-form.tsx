'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, HardDrive, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const passwordTooShort = password.length > 0 && password.length < 8;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || 'Impossible de réinitialiser le mot de passe.');
        return;
      }

      setSuccess(true);
      window.setTimeout(() => router.push('/login'), 2500);
    } catch {
      setError('Une erreur est survenue. Réessaie plus tard.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="w-full rounded-2xl border bg-background p-6 shadow-sm sm:p-8">
      <div className="flex flex-col items-center text-center">
        <div className="rounded-2xl bg-primary p-2.5 text-primary-foreground shadow-sm">
          <HardDrive className="h-6 w-6" />
        </div>

        <h1 className="mt-4 text-xl font-semibold">Nouveau mot de passe</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choisis un nouveau mot de passe pour ton compte.
        </p>
      </div>

      {success ? (
        <div className="mt-6 flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-6 text-center">
          <CheckCircle2 className="h-7 w-7 text-primary" />
          <p className="text-sm">Mot de passe mis à jour. Redirection vers la connexion...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              Nouveau mot de passe
            </label>

            <Input
              id="password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              aria-invalid={passwordTooShort}
              className={
                passwordTooShort ? 'border-destructive focus-visible:ring-destructive' : undefined
              }
              required
            />
            {passwordTooShort ? (
              <p className="text-xs text-destructive">
                Le mot de passe doit contenir au moins 8 caractères.
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="text-sm font-medium">
              Confirmer le mot de passe
            </label>

            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              aria-invalid={passwordsMismatch}
              className={
                passwordsMismatch ? 'border-destructive focus-visible:ring-destructive' : undefined
              }
              required
            />
            {passwordsMismatch ? (
              <p className="text-xs text-destructive">Les mots de passe ne correspondent pas.</p>
            ) : null}
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || passwordTooShort || passwordsMismatch}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Mise à jour...
              </>
            ) : (
              'Réinitialiser le mot de passe'
            )}
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium underline">
          Retour à la connexion
        </Link>
      </p>
    </div>
  );
}
