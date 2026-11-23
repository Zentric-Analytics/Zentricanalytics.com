import { expect, it, vi } from 'vitest';
import { hrLoginAction } from '@/app/hr/login/actions';

const { findOrganization, redirect } = vi.hoisted(() => ({
  findOrganization: vi.fn(),
  redirect: vi.fn((path: string): never => { throw new Error(path); }),
}));

vi.mock('@/lib/prisma', () => ({
  isDatabaseConfigured: () => false,
  prisma: { hrOrganization: { findUnique: findOrganization } },
}));
vi.mock('next/navigation', () => ({ redirect }));

it('rejects a sign-in when the HR database is unconfigured before querying Prisma', async () => {
  const form = new FormData();
  form.set('email', 'synthetic@example.invalid');
  form.set('password', 'fictional-test-password');

  await expect(hrLoginAction(form)).rejects.toThrow('/hr/login?error=Invalid%20email%20or%20password.');
  expect(findOrganization).not.toHaveBeenCalled();
});
