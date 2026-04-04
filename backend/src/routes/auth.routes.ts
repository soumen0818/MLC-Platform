import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { users } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { NotificationService } from '../services/notification.service';

const router = Router();

// Validation schemas
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  role: z.string(),
});

const registerAdminSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(10),
  password: z.string().min(8)
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number')
    .regex(/[!@#$%^&*]/, 'Must contain at least one special character'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8)
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number')
    .regex(/[!@#$%^&*]/, 'Must contain at least one special character'),
});

// Generate JWT token
function generateToken(user: any): string {
  return jwt.sign(
    {
      userId: user.id,
      role: user.role,
      parentId: user.parentId,
      kycStatus: user.kycStatus,
      isActive: user.isActive,
      requiresPasswordChange: user.requiresPasswordChange,
    },
    process.env.JWT_SECRET || 'fallback_secret_key',
    { expiresIn: (process.env.JWT_EXPIRY || '7d') as any }
  );
}

// POST /api/auth/register-admin — Super Admin bootstrap (first boot only)
router.post('/register-admin', async (req: Request, res: Response): Promise<void> => {
  try {
    if (process.env.ALLOW_ADMIN_REGISTER !== 'true') {
      res.status(403).json({ error: 'Admin registration is disabled' });
      return;
    }

    const body = registerAdminSchema.parse(req.body);

    // Check if any admin already exists
    const existingAdmin = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, 'SUPER_ADMIN'))
      .limit(1);

    if (existingAdmin.length > 0) {
      res.status(400).json({ error: 'Super Admin already exists' });
      return;
    }

    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12');
    const passwordHash = await bcrypt.hash(body.password, saltRounds);

    const [admin] = await db
      .insert(users)
      .values({
        name: body.name,
        email: body.email,
        phone: body.phone,
        passwordHash,
        role: 'SUPER_ADMIN',
        isActive: true,
        kycStatus: 'APPROVED',
        requiresPasswordChange: false,
      })
      .returning();

    const token = generateToken(admin);

    res.status(201).json({
      message: 'Super Admin created successfully',
      token,
      user: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    console.error('Register admin error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = loginSchema.parse(req.body);

    // Query user by both email and role
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, body.email), eq(users.role, body.role as any)));

    if (!user) {
      res.status(401).json({ error: 'Invalid credentials or role mismatch' });
      return;
    }

    const isPasswordValid = await bcrypt.compare(body.password, user.passwordHash);
    if (!isPasswordValid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = generateToken(user);

    // Determine redirect path based on role
    const rolePaths: Record<string, string> = {
      SUPER_ADMIN: '/admin/dashboard',
      STATE_HEAD: '/state-head/dashboard',
      MASTER_DISTRIBUTOR: '/master/dashboard',
      DISTRIBUTOR: '/distributor/dashboard',
      RETAILER: '/retailer/dashboard',
    };

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        kycStatus: user.kycStatus,
        isActive: user.isActive,
        requiresPasswordChange: false, // Override to bypass change password page
        walletBalance: user.walletBalance,
      },
      // Bypass requires password change redirect if user doesn't want it:
      redirectTo: !user.isActive 
        ? '/account-pending' 
        : rolePaths[user.role] || '/dashboard',
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/change-password
router.post('/change-password', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const body = changePasswordSchema.parse(req.body);

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.user!.userId));

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const isValid = await bcrypt.compare(body.currentPassword, user.passwordHash);
    if (!isValid) {
      res.status(400).json({ error: 'Current password is incorrect' });
      return;
    }

    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12');
    const newHash = await bcrypt.hash(body.newPassword, saltRounds);

    await db
      .update(users)
      .set({
        passwordHash: newHash,
        requiresPasswordChange: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, req.user!.userId));

    // Generate new token with updated flag
    const updatedUser = { ...user, requiresPasswordChange: false };
    const token = generateToken(updatedUser);

    res.json({ message: 'Password changed successfully', token });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me — get current user session info
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        role: users.role,
        kycStatus: users.kycStatus,
        isActive: users.isActive,
        walletBalance: users.walletBalance,
        requiresPasswordChange: users.requiresPasswordChange,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, req.user!.userId));

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
