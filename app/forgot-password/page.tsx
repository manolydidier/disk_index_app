import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth-options';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

export default async function ForgotPasswordPage() {
  const session = await getServerSession(authOptions);
  if (session) redirect('/');

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md items-center px-4">
      <ForgotPasswordForm />
    </main>
  );
}
