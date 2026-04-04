import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
import { LoadingSpinner } from '@/components/ui';
import { getAuthRedirectPath } from '@/lib/authRedirect';
import { Lock, KeyRound, ShieldCheck } from 'lucide-react';

export default function ChangePasswordPage() {
  const { user, isAuthenticated, changePassword, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (newPassword !== confirmPassword) {
      setErrorMessage('New password and confirm password do not match.');
      return;
    }

    try {
      await changePassword(currentPassword, newPassword);
      toast.success('Password updated successfully.');
      const nextPath = getAuthRedirectPath(useAuthStore.getState().user);
      navigate(nextPath, { replace: true });
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.error || error?.message || 'Unable to change password.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-[440px] bg-card rounded-[24px] border border-border shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-9">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-sidebar-bg">
            <KeyRound size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-[20px] font-bold text-text-primary tracking-tight m-0">Change Password</h1>
            <p className="text-[13px] text-text-secondary mt-1 mb-0">Update your account password.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="currentPassword" className="block text-[13px] font-semibold text-text-primary mb-2">Current Password</label>
            <div className="relative">
              <div className="absolute left-[14px] top-1/2 -translate-y-1/2 pointer-events-none">
                <Lock size={16} className="text-text-muted" />
              </div>
              <input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full h-[46px] rounded-xl border border-border bg-background-secondary pl-10 pr-[14px] text-[14px] text-text-primary outline-none transition-all focus:border-primary focus:bg-white focus:ring-[3px] focus:ring-primary/20"
              />
            </div>
          </div>

          <div>
            <label htmlFor="newPassword" className="block text-[13px] font-semibold text-text-primary mb-2">New Password</label>
            <div className="relative">
              <div className="absolute left-[14px] top-1/2 -translate-y-1/2 pointer-events-none">
                <ShieldCheck size={16} className="text-text-muted" />
              </div>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="w-full h-[46px] rounded-xl border border-border bg-background-secondary pl-10 pr-[14px] text-[14px] text-text-primary outline-none transition-all focus:border-primary focus:bg-white focus:ring-[3px] focus:ring-primary/20"
              />
            </div>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-[13px] font-semibold text-text-primary mb-2">Confirm New Password</label>
            <div className="relative">
              <div className="absolute left-[14px] top-1/2 -translate-y-1/2 pointer-events-none">
                <ShieldCheck size={16} className="text-text-muted" />
              </div>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className="w-full h-[46px] rounded-xl border border-border bg-background-secondary pl-10 pr-[14px] text-[14px] text-text-primary outline-none transition-all focus:border-primary focus:bg-white focus:ring-[3px] focus:ring-primary/20"
              />
            </div>
          </div>

          {errorMessage && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl p-3">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
              <p className="text-[13px] font-medium text-red-700 m-0 leading-tight">{errorMessage}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-[50px] mt-2 rounded-xl bg-sidebar-bg text-white text-[15px] font-bold border-none cursor-pointer flex items-center justify-center gap-2 transition-all hover:bg-sidebar-bg/90 disabled:opacity-70 disabled:cursor-not-allowed outline-none focus:ring-[3px] focus:ring-primary/40"
          >
            {isLoading ? (
              <>
                <LoadingSpinner size="sm" />
                <span>Updating...</span>
              </>
            ) : (
              'Update Password'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
