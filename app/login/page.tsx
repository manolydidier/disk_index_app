import { LoginForm } from '@/components/auth/login-form';

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md items-center px-4">
      <div className="w-full rounded-2xl border bg-background p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Connexion</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connecte-toi pour accéder à Disk Indexer.
        </p>
        <div className="mt-6">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}