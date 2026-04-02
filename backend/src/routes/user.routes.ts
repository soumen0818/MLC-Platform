import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db';
import { users } from '../db/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { z } from 'zod';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { roleMiddleware, ROLE_HIERARCHY } from '../middleware/role.middleware';
import { hierarchyMiddleware } from '../middleware/hierarchy.middleware';
import { NotificationService } from '../services/notification.service';
import crypto from 'crypto';

const router = Router();

// All user routes require authentication
router.use(authMiddleware);

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(10),
  role: z.enum(['STATE_HEAD', 'MASTER_DISTRIBUTOR', 'DISTRIBUTOR', 'RETAILER']),
  parentId: z.string().uuid().optional(),
});

// GET /api/users — list users (filtered by role/hierarchy)
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, status, kycStatus, page = '1', limit = '20', search } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    let query = db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      role: users.role,
      parentId: users.parentId,
      walletBalance: users.walletBalance,
      kycStatus: users.kycStatus,
      isActive: users.isActive,
      createdAt: users.createdAt,
    }).from(users);

    const conditions: any[] = [];

    // Non-admins can only see their direct children
    if (req.user!.role !== 'SUPER_ADMIN') {
      conditions.push(eq(users.parentId, req.user!.userId));
    }

    if (role) conditions.push(eq(users.role, role as any));
    if (status === 'active') conditions.push(eq(users.isActive, true));
    if (status === 'inactive') conditions.push(eq(users.isActive, false));
    if (kycStatus) conditions.push(eq(users.kycStatus, kycStatus as any));

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const result = await (query as any)
      .orderBy(desc(users.createdAt))
      .limit(limitNum)
      .offset(offset);

    // Count total
    const countConditions = [...conditions];
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(conditions.length > 0 ? and(...countConditions) : undefined);

    res.json({
      users: result,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: Number(count),
        totalPages: Math.ceil(Number(count) / limitNum),
      },
    });
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users — create a new user (parent creates child)
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const body = createUserSchema.parse(req.body);
    const creatorRole = req.user!.role;

    // Verify the creator can create this role (must be one level above)
    const allowedChildRole = ROLE_HIERARCHY[creatorRole as keyof typeof ROLE_HIERARCHY];
    if (creatorRole !== 'SUPER_ADMIN' && body.role !== allowedChildRole) {
      res.status(403).json({
        error: `As ${creatorRole}, you can only create ${allowedChildRole} users`,
      });
      return;
    }

    // Determine parent
    const parentId = creatorRole === 'SUPER_ADMIN' && body.parentId
      ? body.parentId
      : req.user!.userId;

    // Check duplicate email/phone
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, body.email))
      .limit(1);

    if (existing.length > 0) {
      res.status(400).json({ error: 'Email already registered' });
      return;
    }

    // Generate temporary password
    const tempPassword = crypto.randomBytes(4).toString('hex') + 'A1!';
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12');
    const passwordHash = await bcrypt.hash(tempPassword, saltRounds);

    const [newUser] = await db
      .insert(users)
      .values({
        name: body.name,
        email: body.email,
        phone: body.phone,
        passwordHash,
        role: body.role,
        parentId,
        isActive: false,
        kycStatus: 'PENDING',
        requiresPasswordChange: true,
        createdBy: req.user!.userId,
      })
      .returning();

    // Send welcome email with temp password
    await NotificationService.sendWelcomeEmail(
      body.email,
      body.name,
      tempPassword,
      body.role
    );

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        parentId: newUser.parentId,
      },
      tempPassword, // Also return in response for immediate use
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/:userId — get single user
router.get('/:userId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params as { [key: string]: string };

    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        role: users.role,
        parentId: users.parentId,
        walletBalance: users.walletBalance,
        kycStatus: users.kycStatus,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Non-admins can only view their own profile or their direct children
    if (
      req.user!.role !== 'SUPER_ADMIN' &&
      user.id !== req.user!.userId &&
      user.parentId !== req.user!.userId
    ) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/users/:userId/activate — toggle user active status
router.patch('/:userId/activate', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params as { [key: string]: string };
    const { isActive } = req.body;

    // Verify hierarchy (admin or direct parent)
    if (req.user!.role !== 'SUPER_ADMIN') {
      const [target] = await db
        .select({ parentId: users.parentId })
        .from(users)
        .where(eq(users.id, userId));

      if (!target || target.parentId !== req.user!.userId) {
        res.status(403).json({ error: 'You can only manage your direct children' });
        return;
      }
    }

    await db
      .update(users)
      .set({ isActive: Boolean(isActive), updatedAt: new Date() })
      .where(eq(users.id, userId));

    res.json({ message: `User ${isActive ? 'activated' : 'deactivated'} successfully` });
  } catch (error) {
    console.error('Activate user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/:userId/children — get direct children of a user
router.get('/:userId/children', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params as { [key: string]: string };

    // Only allow self or admin
    if (req.user!.role !== 'SUPER_ADMIN' && userId !== req.user!.userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const children = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        role: users.role,
        walletBalance: users.walletBalance,
        kycStatus: users.kycStatus,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.parentId, userId))
      .orderBy(desc(users.createdAt));

    res.json({ children });
  } catch (error) {
    console.error('Get children error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
