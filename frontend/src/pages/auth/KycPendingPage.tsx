import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

export default function KycPendingPage() {
  const { user, isAuthenticated, logout } = useAuthStore();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.requiresPasswordChange) {
    return <Navigate to="/change-password" replace />;
  }

  if (user.kycStatus === 'APPROVED') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
      <div className="card w-full max-w-lg p-8 text-center">
        <h1 className="text-2xl font-bold font-display">KYC Verification Required</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-3">
          Your account is logged in, but KYC is not approved yet. You can access dashboard features after approval.
        </p>
        <p className="text-sm mt-4">
          Current status: <span className="font-semibold">{user.kycStatus}</span>
        </p>
        <button className="btn btn-secondary mt-6" onClick={logout}>Sign out</button>
      </div>
    </div>
  );
}
