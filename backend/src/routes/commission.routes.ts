import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { roleMiddleware } from '../middleware/role.middleware';
import { db } from '../db';
import { commissionConfigs, commissionDistributions, rechargeTransactions } from '../db/schema';
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';
import { z } from 'zod';

const router = Router();
router.use(authMiddleware);

const configSchema = z.object({
  serviceType: z.string().min(1),
  role: z.enum(['STATE_HEAD', 'MASTER_DISTRIBUTOR', 'DISTRIBUTOR', 'RETAILER']),
  commissionType: z.enum(['PERCENTAGE', 'FLAT']),
  commissionValue: z.number().min(0),
});

// GET /api/commission/my — get my earned commissions
router.get('/my', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20', fromDate, toDate } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    const conditions = [eq(commissionDistributions.userId, req.user!.userId)];
    if (fromDate) conditions.push(gte(commissionDistributions.createdAt, new Date(fromDate as string)));
    if (toDate) conditions.push(lte(commissionDistributions.createdAt, new Date(toDate as string)));

    const result = await db
      .select()
      .from(commissionDistributions)
      .where(and(...conditions))
      .orderBy(desc(commissionDistributions.createdAt))
      .limit(limitNum)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(commissionDistributions)
      .where(and(...conditions));

    // Calculate totals
    const [totals] = await db
      .select({
        totalEarned: sql<string>`COALESCE(SUM(CASE WHEN status = 'CREDITED' THEN amount_credited ELSE 0 END), 0)`,
        totalReversed: sql<string>`COALESCE(SUM(CASE WHEN status = 'REVERSED' THEN amount_credited ELSE 0 END), 0)`,
      })
      .from(commissionDistributions)
      .where(and(...conditions));

    res.json({
      commissions: result,
      totals: {
        earned: totals.totalEarned,
        reversed: totals.totalReversed,
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: Number(count),
        totalPages: Math.ceil(Number(count) / limitNum),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/commission/configs — get all commission configs (admin only)
router.get(
  '/configs',
  roleMiddleware('SUPER_ADMIN'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const configs = await db
        .select()
        .from(commissionConfigs)
        .orderBy(commissionConfigs.serviceType, commissionConfigs.role);

      res.json({ configs });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// POST /api/commission/configs — create/update commission config (admin only)
router.post(
  '/configs',
  roleMiddleware('SUPER_ADMIN'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const body = configSchema.parse(req.body);

      // Check if config already exists
      const existing = await db
        .select()
        .from(commissionConfigs)
        .where(
          and(
            eq(commissionConfigs.serviceType, body.serviceType),
            eq(commissionConfigs.role, body.role)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        // Update
        await db
          .update(commissionConfigs)
          .set({
            commissionType: body.commissionType,
            commissionValue: body.commissionValue.toString(),
            setBy: req.user!.userId,
            updatedAt: new Date(),
          })
          .where(eq(commissionConfigs.id, existing[0].id));

        res.json({ message: 'Commission config updated' });
      } else {
        // Create
        await db.insert(commissionConfigs).values({
          serviceType: body.serviceType,
          role: body.role,
          commissionType: body.commissionType,
          commissionValue: body.commissionValue.toString(),
          setBy: req.user!.userId,
        });

        res.status(201).json({ message: 'Commission config created' });
      }
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        const readableErrors = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        res.status(400).json({ error: `Validation failed: ${readableErrors}` });
        return;
      }
      res.status(500).json({ error: error.message });
    }
  }
);

// GET /api/commission/calculate-preview — preview commission distribution
router.get(
  '/calculate-preview',
  roleMiddleware('SUPER_ADMIN'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { amount, serviceType } = req.query;
      if (!amount || !serviceType) {
        res.status(400).json({ error: 'amount and serviceType are required' });
        return;
      }

      const rechargeAmount = parseFloat(amount as string);
      const roles = ['RETAILER', 'DISTRIBUTOR', 'MASTER_DISTRIBUTOR', 'STATE_HEAD'] as const;
      const preview: Array<{ role: string; type: string; value: string; amount: number }> = [];

      for (const role of roles) {
        const [config] = await db
          .select()
          .from(commissionConfigs)
          .where(
            and(
              eq(commissionConfigs.serviceType, serviceType as string),
              eq(commissionConfigs.role, role),
              eq(commissionConfigs.isActive, true)
            )
          );

        if (config) {
          const commValue = parseFloat(config.commissionValue);
          const creditAmount =
            config.commissionType === 'PERCENTAGE'
              ? (rechargeAmount * commValue) / 100
              : commValue;

          preview.push({
            role,
            type: config.commissionType,
            value: config.commissionValue,
            amount: creditAmount,
          });
        }
      }

      res.json({
        rechargeAmount,
        serviceType,
        distribution: preview,
        totalCommission: preview.reduce((sum, p) => sum + p.amount, 0),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;
