import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { roleMiddleware } from '../middleware/role.middleware';
import { db } from '../db';
import { services } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';

const router = Router();
router.use(authMiddleware);

const serviceSchema = z.object({
  name: z.string().min(1),
  serviceType: z.enum(['MOBILE', 'DTH', 'ELECTRICITY', 'GAS', 'WATER']),
  apiEndpoint: z.string().min(1).optional(),
  isActive: z.boolean().default(true),
});

// GET /api/services — list active services
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const isAdmin = req.user!.role === 'SUPER_ADMIN';

    const result = await db
      .select()
      .from(services)
      .where(isAdmin ? undefined : eq(services.isActive, true))
      .orderBy(services.serviceType);

    res.json({ services: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/services — create service (admin only)
router.post(
  '/',
  roleMiddleware('SUPER_ADMIN'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const body = serviceSchema.parse(req.body);

      const [service] = await db
        .insert(services)
        .values(body)
        .returning();

      res.status(201).json({ service });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.errors });
        return;
      }
      res.status(500).json({ error: error.message });
    }
  }
);

// PATCH /api/services/:id — toggle service active status
router.patch(
  '/:id',
  roleMiddleware('SUPER_ADMIN'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { [key: string]: string };
      const { isActive } = req.body;

      await db
        .update(services)
        .set({ isActive: Boolean(isActive) })
        .where(eq(services.id, id as string));

      res.json({ message: `Service ${isActive ? 'enabled' : 'disabled'}` });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;
