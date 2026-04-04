import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { getAuthRedirectPath } from '@/lib/authRedirect';
import { Clock, LogOut } from 'lucide-react';

export default function AccountPendingPage() {
  const { user, isAuthenticated, logout } = useAuthStore();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.isActive) {
    return <Navigate to={getAuthRedirectPath(user)} replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-[440px] bg-card rounded-[24px] border border-border shadow-[0_4px_24px_rgba(0,0,0,0.06)] px-9 py-10 text-center">
        <div className="mx-auto mb-5 flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-50 border border-amber-100">
          <Clock size={28} className="text-amber-500" />
        </div>
        <h1 className="text-[20px] font-bold text-text-primary mb-2">
          Account Pending Approval
        </h1>
        <p className="text-[14px] text-text-secondary leading-relaxed mb-6">
          Your login is successful, but your account is not active yet. Please contact your parent admin or support.
        </p>
        <button
          onClick={logout}
          className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl border border-border bg-white text-text-primary text-[14px] font-semibold cursor-pointer outline-none transition-colors hover:bg-background"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </div>
  );
}
