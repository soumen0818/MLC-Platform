import type { User } from '@/types';
import { ROLE_PATHS } from '@/types';

type RedirectUser = Pick<User, 'role' | 'requiresPasswordChange' | 'kycStatus' | 'isActive'>;

export function getAuthRedirectPath(user: RedirectUser | null): string {
  if (!user) return '/login';

  if (user.requiresPasswordChange) return '/change-password';
  if (user.kycStatus !== 'APPROVED') return '/kyc';
  if (!user.isActive) return '/account-pending';

  return `${ROLE_PATHS[user.role]}/dashboard`;
}
