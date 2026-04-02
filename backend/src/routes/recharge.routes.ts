import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { roleMiddleware } from '../middleware/role.middleware';
import { RechargeService } from '../services/recharge.service';
import { db } from '../db';
import { rechargeTransactions } from '../db/schema';
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { rateLimit } from 'express-rate-limit';

const router = Router();

// Rate limit: 10 recharge requests per minute per retailer
const rechargeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many recharge requests. Please wait a minute.' },
  keyGenerator: (req: any) => req.user?.userId || req.ip,
});

const rechargeSchema = z.object({
  mobileNumber: z.string().min(10).max(15),
  operator: z.string().min(1),
  serviceType: z.enum(['MOBILE', 'DTH', 'ELECTRICITY', 'GAS', 'WATER']),
  amount: z.number().positive().min(1),
});

// POST /api/recharge — process a recharge (retailers only)
router.post(
  '/',
  authMiddleware,
  roleMiddleware('RETAILER'),
  rechargeLimiter,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const body = rechargeSchema.parse(req.body);

      const result = await RechargeService.processRecharge({
        retailerId: req.user!.userId,
        ...body,
      });

      res.json(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.errors });
        return;
      }
      res.status(400).json({ error: error.message });
    }
  }
);

// GET /api/recharge/history — my recharge history (retailers)
router.get('/history', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20', status, operator, fromDate, toDate } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    const conditions: any[] = [];

    // Retailers see only their own, admins see all
    if (req.user!.role === 'RETAILER') {
      conditions.push(eq(rechargeTransactions.retailerId, req.user!.userId));
    }

    if (status) conditions.push(eq(rechargeTransactions.status, status as any));
    if (operator) conditions.push(eq(rechargeTransactions.operator, operator as string));
    if (fromDate) conditions.push(gte(rechargeTransactions.createdAt, new Date(fromDate as string)));
    if (toDate) conditions.push(lte(rechargeTransactions.createdAt, new Date(toDate as string)));

    const result = await db
      .select()
      .from(rechargeTransactions)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(rechargeTransactions.createdAt))
      .limit(limitNum)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(rechargeTransactions)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    res.json({
      transactions: result,
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

// GET /api/recharge/all — admin view all recharges
router.get(
  '/all',
  authMiddleware,
  roleMiddleware('SUPER_ADMIN'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { page = '1', limit = '50', status, fromDate, toDate } = req.query;
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      const conditions: any[] = [];
      if (status) conditions.push(eq(rechargeTransactions.status, status as any));
      if (fromDate) conditions.push(gte(rechargeTransactions.createdAt, new Date(fromDate as string)));
      if (toDate) conditions.push(lte(rechargeTransactions.createdAt, new Date(toDate as string)));

      const result = await db
        .select()
        .from(rechargeTransactions)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(rechargeTransactions.createdAt))
        .limit(limitNum)
        .offset(offset);

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(rechargeTransactions)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      res.json({
        transactions: result,
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
  }
);

// POST /api/recharge/webhook — callback from recharge API provider
router.post('/webhook', async (req: any, res: Response): Promise<void> => {
  try {
    // TODO: Verify HMAC signature from provider
    const { txn_id, status, reason } = req.body;

    const mappedStatus = status === 'success' || status === 1 ? 'SUCCESS' : 'FAILED';
    await RechargeService.handleWebhook(txn_id, mappedStatus, reason);

    res.json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
