import { adminLogoutAction } from '@/app/admin/logout/actions';

export function AdminLogoutButton() {
  return (
    <form action={adminLogoutAction}>
      <button className="btn btn-secondary" type="submit">
        Logout
      </button>
    </form>
  );
}
