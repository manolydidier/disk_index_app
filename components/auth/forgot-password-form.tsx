'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, HardDrive, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);

    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
    } finally {
      // The API always answers the same way regardless of outcome, so the
      // UI doesn't need (and shouldn't show) anything but this confirmation.
      setIsLoading(false);
      setSubmitted(true);
    }
  }

  return (
    <div className="w-full rounded-2xl border bg-background p-6 shadow-sm sm:p-8">
      <div className="flex flex-col items-center text-center">
        <div className="rounded-2xl bg-primary p-2.5 text-primary-foreground shadow-sm">
          <HardDrive className="h-6 w-6" />
        </div>

        <h1 className="mt-4 text-xl font-semibold">Mot de passe oublié</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Indique ton email, on t&apos;envoie un lien pour choisir un nouveau mot de passe.
        </p>
      </div>

      {submitted ? (
        <div className="mt-6 flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-6 text-center">
          <CheckCircle2 className="h-7 w-7 text-primary" />
          <p className="text-sm">
            Si un compte existe avec cette adresse, un email de réinitialisation vient d&apos;être
            envoyé.
          </p>
          <p className="text-xs text-muted-foreground">Le lien expire dans une heure.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>

            <Input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@diskindexer.local"
              autoComplete="email"
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading || !email.trim()}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Envoi...
              </>
            ) : (
              'Envoyer le lien de réinitialisation'
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
