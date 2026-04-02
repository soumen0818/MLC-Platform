import { useAuthStore } from '@/stores/authStore';
import { ROLE_LABELS } from '@/types';

export default function ProfilePage() {
  const { user } = useAuthStore();

  if (!user) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-display">Profile</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          Account details and current access information.
        </p>
      </div>

      <div className="card p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Name</p>
            <p className="text-sm font-semibold mt-1">{user.name}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Role</p>
            <p className="text-sm font-semibold mt-1">{ROLE_LABELS[user.role]}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Email</p>
            <p className="text-sm font-semibold mt-1">{user.email}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Phone</p>
            <p className="text-sm font-semibold mt-1">{user.phone}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
