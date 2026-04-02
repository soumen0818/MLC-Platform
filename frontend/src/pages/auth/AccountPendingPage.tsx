import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { getAuthRedirectPath } from '@/lib/authRedirect';

export default function AccountPendingPage() {
  const { user, isAuthenticated, logout } = useAuthStore();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.isActive) {
    return <Navigate to={getAuthRedirectPath(user)} replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
      <div className="card w-full max-w-lg p-8 text-center">
        <h1 className="text-2xl font-bold font-display">Account Pending Approval</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-3">
          Your login is successful, but your account is not active yet. Please contact your parent admin or support.
        </p>
        <button className="btn btn-secondary mt-6" onClick={logout}>Sign out</button>
      </div>
    </div>
  );
}
