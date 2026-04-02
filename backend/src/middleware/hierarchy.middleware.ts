import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

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
