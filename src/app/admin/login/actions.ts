'use server';
import { redirect } from 'next/navigation';
import { buildAdminLoginDiagnostics, getConfiguredAdminEmail, normalizeServerEnvValue, setAdminSession, verifyAdminPassword } from '@/lib/admin-auth';

export async function adminLoginAction(formData: FormData) {
  const email = normalizeServerEnvValue(String(formData.get('email') ?? '')).toLowerCase();
  const password = String(formData.get('password') ?? '');
  const passwordVerified = verifyAdminPassword(password);
  const diagnostics = buildAdminLoginDiagnostics(email, passwordVerified);

  if (email !== getConfiguredAdminEmail() || !passwordVerified) {
    console.warn('Admin login failed', diagnostics);
    redirect('/admin/login?error=1');
  }

  if (!diagnostics.adminSessionSecretLengthValid) {
    console.warn('Admin login failed', diagnostics);
    redirect('/admin/login?error=1');
  }

  await setAdminSession(email);
  redirect('/admin/applications');
}
