import type { User } from '@/types';
import { ROLE_PATHS } from '@/types';

type RedirectUser = Pick<User, 'role' | 'requiresPasswordChange' | 'isActive'>;

export function getAuthRedirectPath(user: RedirectUser | null): string {
  if (!user) return '/login';

  // Force password change sequence centrally before permitting dashboard onboarding
  if (user.requiresPasswordChange) return '/change-password';

  // Account must be activated (admin approved)
  if (!user.isActive) return '/account-pending';

  return `${ROLE_PATHS[user.role as keyof typeof ROLE_PATHS] || ''}/dashboard`;
}
