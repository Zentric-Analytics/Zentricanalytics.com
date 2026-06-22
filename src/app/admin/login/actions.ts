'use server';
import { redirect } from 'next/navigation';
import { setAdminSession, verifyAdminPassword } from '@/lib/admin-auth';

export async function adminLoginAction(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  if (email !== String(process.env.ADMIN_EMAIL ?? '').toLowerCase() || !verifyAdminPassword(password)) redirect('/admin/login?error=1');
  await setAdminSession(email);
  redirect('/admin/applications');
}
