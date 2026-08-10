import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth-options';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';

export default async function ResetPasswordPage({
  params
}: {
  params: Promise<{ token: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (session) redirect('/');

  const { token } = await params;

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md items-center px-4">
      <ResetPasswordForm token={token} />
    </main>
  );
}
