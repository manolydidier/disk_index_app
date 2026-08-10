import { Suspense } from 'react';
import { AuthPageClient } from '@/components/auth/auth-page-client';
import { LoginBrandPanel } from '@/components/auth/login-brand-panel';

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-4xl items-center px-4">
      <div className="grid w-full overflow-hidden rounded-2xl border bg-background shadow-sm lg:grid-cols-2">
        <LoginBrandPanel className="hidden lg:flex" />

        <div className="p-6 sm:p-8">
          <Suspense fallback={null}>
            <AuthPageClient />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
