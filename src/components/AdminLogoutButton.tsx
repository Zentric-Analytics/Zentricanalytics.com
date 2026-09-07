import { hrLogoutAction } from '@/app/hr/actions';

export function AdminLogoutButton() {
  return (
    <form action={hrLogoutAction}>
      <button className="btn btn-secondary" type="submit">
        Logout
      </button>
    </form>
  );
}
