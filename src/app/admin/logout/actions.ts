'use server';

import { redirect } from 'next/navigation';

import { clearAdminSession } from '@/lib/admin-auth';

export async function adminLogoutAction() {
  console.info('adminLogoutRequested', { logoutMethod: 'server_action' });
  await clearAdminSession();
  redirect('/admin/login');
}
