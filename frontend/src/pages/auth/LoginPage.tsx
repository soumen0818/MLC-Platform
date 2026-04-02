import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { LoadingSpinner } from '@/components/ui';
import { Eye, EyeOff, ArrowRight, ShieldCheck, Mail, Lock } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password) {
      setFormError('Email and password are required.');
      return;
    }

    setFormError(null);

    try {
      const { redirectTo } = await login(normalizedEmail, password);
      toast.success('Welcome back!');
      navigate(redirectTo);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <div
      style={{ minHeight: '100vh', background: '#F4F4F5' }}
      className="flex items-center justify-center px-4 py-10"
    >
      <div style={{ width: '100%', maxWidth: '420px' }}>

        {/* ── Brand header ── */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="flex items-center gap-3">
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: '#0A0A0A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
              }}
            >
              <svg width="24" height="24" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="5"  r="2.5" fill="#CCFF00" />
                <circle cx="5"  cy="14" r="2.5" fill="white" fillOpacity="0.85" />
                <circle cx="15" cy="14" r="2.5" fill="white" fillOpacity="0.85" />
                <line x1="10" y1="7.5" x2="5"  y2="11.5" stroke="white" strokeWidth="1.5" strokeOpacity="0.6" />
                <line x1="10" y1="7.5" x2="15" y2="11.5" stroke="white" strokeWidth="1.5" strokeOpacity="0.6" />
              </svg>
            </div>
            <span
              style={{
                fontSize: 26,
                fontWeight: 800,
                color: '#0A0A0A',
                letterSpacing: '-0.03em',
                fontFamily: "'Inter', system-ui, sans-serif",
              }}
            >
              MLC Platform
            </span>
          </div>
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#A1A1AA',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
            }}
          >
            Multi-Level Commission Distribution
          </p>
        </div>

        {/* ── Login Card ── */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: 24,
            border: '1px solid #E4E4E7',
            boxShadow: '0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)',
            padding: '36px 36px 28px 36px',
          }}
        >
          {/* Heading */}
          <div style={{ marginBottom: 28 }}>
            <h2
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: '#0A0A0A',
                letterSpacing: '-0.02em',
                marginBottom: 6,
                fontFamily: "'Inter', system-ui, sans-serif",
              }}
            >
              Welcome Back
            </h2>
            <p style={{ fontSize: 14, color: '#52525B', lineHeight: 1.6 }}>
              Sign in with your agent credentials to access your dashboard securely.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate>

            {/* Email field */}
            <div style={{ marginBottom: 18 }}>
              <label
                htmlFor="login-email"
                style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#0A0A0A',
                  marginBottom: 8,
                }}
              >
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    left: 0,
                    paddingLeft: 14,
                    display: 'flex',
                    alignItems: 'center',
                    pointerEvents: 'none',
                    width: 'fit-content',
                  }}
                >
                  <Mail size={16} color="#A1A1AA" />
                </div>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  autoComplete="username"
                  style={{
                    width: '100%',
                    height: 46,
                    borderRadius: 12,
                    border: '1.5px solid #E4E4E7',
                    background: '#F4F4F5',
                    paddingLeft: 40,
                    paddingRight: 14,
                    fontSize: 14,
                    color: '#0A0A0A',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s, background 0.15s',
                    fontFamily: "'Inter', system-ui, sans-serif",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#0A0A0A';
                    e.target.style.background = '#fff';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#E4E4E7';
                    e.target.style.background = '#F4F4F5';
                  }}
                />
              </div>
            </div>

            {/* Password field */}
            <div style={{ marginBottom: 24 }}>
              <label
                htmlFor="login-password"
                style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#0A0A0A', marginBottom: 8 }}
              >
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    left: 0,
                    paddingLeft: 14,
                    display: 'flex',
                    alignItems: 'center',
                    pointerEvents: 'none',
                    width: 'fit-content',
                  }}
                >
                  <Lock size={16} color="#A1A1AA" />
                </div>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  style={{
                    width: '100%',
                    height: 46,
                    borderRadius: 12,
                    border: '1.5px solid #E4E4E7',
                    background: '#F4F4F5',
                    paddingLeft: 40,
                    paddingRight: 46,
                    fontSize: 14,
                    color: '#0A0A0A',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s, background 0.15s',
                    fontFamily: "'Inter', system-ui, sans-serif",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#0A0A0A';
                    e.target.style.background = '#fff';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#E4E4E7';
                    e.target.style.background = '#F4F4F5';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    height: '100%',
                    paddingRight: 14,
                    paddingLeft: 10,
                    display: 'flex',
                    alignItems: 'center',
                    color: '#A1A1AA',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Error message */}
            {formError && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: '#FEF2F2',
                  border: '1px solid #FEE2E2',
                  borderRadius: 10,
                  padding: '10px 14px',
                  marginBottom: 16,
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: '#EF4444',
                    flexShrink: 0,
                  }}
                />
                <p style={{ fontSize: 13, fontWeight: 500, color: '#B91C1C' }}>{formError}</p>
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              id="login-submit-btn"
              disabled={isLoading}
              style={{
                width: '100%',
                height: 50,
                borderRadius: 12,
                background: '#CCFF00',
                border: 'none',
                fontSize: 15,
                fontWeight: 700,
                color: '#0A0A0A',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 4px 14px rgba(204, 255, 0, 0.3)',
                transition: 'background 0.15s, transform 0.1s',
                fontFamily: "'Inter', system-ui, sans-serif",
                letterSpacing: '-0.01em',
              }}
              onMouseOver={(e) => {
                if (!isLoading) (e.currentTarget as HTMLButtonElement).style.background = '#B8E600';
              }}
              onMouseOut={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = '#CCFF00';
              }}
            >
              {isLoading ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign in securely</span>
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* ── Footer ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            marginTop: 20,
          }}
        >
          <ShieldCheck size={14} color="#A1A1AA" />
          <p style={{ fontSize: 12, color: '#71717A', fontWeight: 500 }}>
            Enterprise-grade end-to-end encryption
          </p>
        </div>

      </div>
    </div>
  );
}