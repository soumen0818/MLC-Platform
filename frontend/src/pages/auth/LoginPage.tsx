import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
import { LoadingSpinner } from '@/components/ui';
import { getAuthRedirectPath } from '@/lib/authRedirect';
import type { UserRole } from '@/types';
import { ROLE_LABELS } from '@/types';

import { ShieldCheck, Mail, Lock, ChevronDown, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const { login, isLoading, isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<UserRole | ''>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (isAuthenticated && user) {
    return <Navigate to={getAuthRedirectPath(user)} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!role) {
      setErrorMessage('Please choose your role before signing in.');
      return;
    }

    try {
      const response = await login(email, password, role);
      toast.success('Welcome back!');
      navigate(response.redirectTo || getAuthRedirectPath(useAuthStore.getState().user), { replace: true });
    } catch (error: any) {
      const backendError = error?.response?.data?.error || error?.response?.data?.message || error?.message;
      const finalError = backendError || 'Login failed. Please check your credentials and ensure the correct role is selected.';
      setErrorMessage(finalError);
      toast.error(finalError);
    }
  };

  const handleRoleSelect = (selectedRole: UserRole | string) => {
    setRole(selectedRole as UserRole | '');
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-[440px] bg-card rounded-[24px] border border-border shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-9">
        
        {/* Brand Header */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-sidebar-bg flex items-center justify-center">
              <ShieldCheck size={24} className="text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="text-[20px] font-bold text-text-primary tracking-tight leading-none mb-1">MLC Platform</span>
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] leading-none">Partner Portal</span>
            </div>
          </div>
        </div>

        {/* Header Text */}
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-text-primary mb-2">Welcome Back</h1>
          <p className="text-[14px] text-text-secondary">Sign in to your account and select your role to continue.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Role Selection */}
          <div>
            <label htmlFor="role" className="block text-[13px] font-semibold text-text-primary mb-2">Account Role</label>
            <div className="relative">
              <select
                id="role"
                value={role}
                onChange={(e) => handleRoleSelect(e.target.value)}
                required
                className="w-full h-12 rounded-xl border border-border bg-background-secondary pl-4 pr-10 text-[14px] text-text-primary outline-none transition-all focus:border-primary focus:bg-white focus:ring-[3px] focus:ring-primary/20 appearance-none cursor-pointer"
              >
                <option value="" disabled>Choose your role</option>
                {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <ChevronDown size={16} className="text-text-muted" />
              </div>
            </div>
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-[13px] font-semibold text-text-primary mb-2">Email address</label>
            <div className="relative">
              <div className="absolute left-[14px] top-1/2 -translate-y-1/2 pointer-events-none">
                <Mail size={16} className="text-text-muted" />
              </div>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                className="w-full h-12 rounded-xl border border-border bg-background-secondary pl-10 pr-4 text-[14px] text-text-primary outline-none transition-all focus:border-primary focus:bg-white focus:ring-[3px] focus:ring-primary/20"
                placeholder="Ex. you@example.com"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-[13px] font-semibold text-text-primary mb-2">Password</label>
            <div className="relative">
              <div className="absolute left-[14px] top-1/2 -translate-y-1/2 pointer-events-none">
                <Lock size={16} className="text-text-muted" />
              </div>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="w-full h-12 rounded-xl border border-border bg-background-secondary pl-10 pr-12 text-[14px] text-text-primary outline-none transition-all focus:border-primary focus:bg-white focus:ring-[3px] focus:ring-primary/20"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors p-1"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl p-3">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
              <p className="text-[13px] font-medium text-red-700 m-0 leading-tight">{errorMessage}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 mt-2 rounded-xl bg-sidebar-bg text-white text-[15px] font-bold border-none cursor-pointer flex items-center justify-center gap-2 transition-all hover:bg-sidebar-bg/90 disabled:opacity-70 disabled:cursor-not-allowed outline-none focus:ring-[3px] focus:ring-primary/40"
          >
            {isLoading ? (
              <>
                <LoadingSpinner size="sm" />
                <span>Signing in...</span>
              </>
            ) : (
              'Sign in'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}