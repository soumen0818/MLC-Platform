import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';

type UserRole = 'SUPER_ADMIN' | 'STATE_HEAD' | 'MASTER_DISTRIBUTOR' | 'DISTRIBUTOR' | 'RETAILER';

export const roleMiddleware = (...allowedRoles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!allowedRoles.includes(req.user.role as UserRole)) {
      res.status(403).json({ error: 'You do not have permission to access this resource' });
      return;
    }

    next();
  };
};

// Role hierarchy - used to determine valid child creation
export const ROLE_HIERARCHY: Record<UserRole, UserRole | null> = {
  SUPER_ADMIN: 'STATE_HEAD',
  STATE_HEAD: 'MASTER_DISTRIBUTOR',
  MASTER_DISTRIBUTOR: 'DISTRIBUTOR',
  DISTRIBUTOR: 'RETAILER',
  RETAILER: null,
};

// Get all roles below a given role
export const getRolesBelow = (role: UserRole): UserRole[] => {
  const roles: UserRole[] = [];
  let current = ROLE_HIERARCHY[role];
  while (current) {
    roles.push(current);
    current = ROLE_HIERARCHY[current];
  }
  return roles;
};
