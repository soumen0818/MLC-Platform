import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { ROLE_HIERARCHY } from './role.middleware';

// Verifies that the requesting user is the direct parent of the target user
export const hierarchyMiddleware = (targetUserIdParam: string = 'userId') => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      // Super Admin can access everything
      if (req.user.role === 'SUPER_ADMIN') {
        next();
        return;
      }

      const targetUserId = req.params[targetUserIdParam] || req.body[targetUserIdParam];

      if (!targetUserId) {
        res.status(400).json({ error: 'Target user ID is required' });
        return;
      }

      // Query the target user to check parent_id
      const targetUser = await db
        .select({ parentId: users.parentId })
        .from(users)
        .where(eq(users.id, targetUserId))
        .limit(1);

      if (targetUser.length === 0) {
        res.status(404).json({ error: 'Target user not found' });
        return;
      }

      if (targetUser[0].parentId !== req.user.userId) {
        res.status(403).json({ error: 'You can only manage your direct children' });
        return;
      }

      next();
    } catch (error) {
      console.error('Hierarchy middleware error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

/**
 * Middleware ensuring a user can only create an account exactly one tier below them.
 */
export const creationHierarchyMiddleware = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const creatorRole = req.user!.role as keyof typeof ROLE_HIERARCHY | 'SUPER_ADMIN';
  const targetRole = req.body?.role;

  // Global exception: Super Admin possesses unrestricted account creation power
  if (creatorRole === 'SUPER_ADMIN') {
    next();
    return;
  }

  if (!targetRole) {
    res.status(400).json({ error: 'Target role is required' });
    return;
  }

  const allowedChildRole = ROLE_HIERARCHY[creatorRole];

  if (targetRole !== allowedChildRole || !allowedChildRole) {
    res.status(403).json({
      error: `As a ${creatorRole}, you are only authorized to create ${allowedChildRole || 'no'} accounts.`,
    });
    return;
  }

  next();
};
