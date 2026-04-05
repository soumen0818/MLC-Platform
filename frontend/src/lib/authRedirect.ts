import type { User } from '@/types';
import { ROLE_PATHS } from '@/types';

type RedirectUser = Pick<User, 'role' | 'requiresPasswordChange' | 'kycStatus' | 'isActive'>;

export function getAuthRedirectPath(user: RedirectUser | null): string {
  if (!user) return '/login';

  // Force password change sequence centrally before permitting dashboard onboarding
  if (user.requiresPasswordChange) return '/change-password';

  // Let all roles enter their dashboard, KYC will be handled internally
  if (!user.isActive) return '/account-pending';

  return `${ROLE_PATHS[user.role as keyof typeof ROLE_PATHS] || ''}/dashboard`;
}
