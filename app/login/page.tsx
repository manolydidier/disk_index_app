import { Suspense } from 'react';
import { AuthPageClient } from '@/components/auth/auth-page-client';

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md items-center px-4">
      <Suspense fallback={null}>
        <AuthPageClient />
      </Suspense>
    </main>
  );
}
