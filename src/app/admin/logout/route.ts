import { redirect } from 'next/navigation';

import { clearAdminSession } from '@/lib/admin-auth';

export async function GET() {
  console.info('adminLogoutRequested', { logoutMethod: 'GET', cookieMutated: false });
  redirect('/admin/applications');
}

export async function POST() {
  console.info('adminLogoutRequested', { logoutMethod: 'POST' });
  await clearAdminSession();
  redirect('/admin/login');
}
