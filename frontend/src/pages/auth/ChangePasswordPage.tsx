import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
import { LoadingSpinner } from '@/components/ui';
import { getAuthRedirectPath } from '@/lib/authRedirect';

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

  if (!user.requiresPasswordChange) {
    return <Navigate to={getAuthRedirectPath(user)} replace />;
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
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
      <div className="card w-full max-w-md p-8">
        <h1 className="text-2xl font-bold font-display">Change Password</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1 mb-6">
          For security reasons, you must set a new password before continuing.
        </p>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="currentPassword" className="input-label">Current Password</label>
            <input
              id="currentPassword"
              type="password"
              className="input-modern"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="newPassword" className="input-label">New Password</label>
            <input
              id="newPassword"
              type="password"
              className="input-modern"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="input-label">Confirm New Password</label>
            <input
              id="confirmPassword"
              type="password"
              className="input-modern"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>

          {errorMessage && (
            <p className="text-sm text-red-600">{errorMessage}</p>
          )}

          <button type="submit" className="btn btn-primary w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <LoadingSpinner size="sm" />
                Updating...
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
