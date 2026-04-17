import { Request, Response, Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { roleMiddleware } from '../middleware/role.middleware';
import { RechargeService } from '../services/recharge.service';
import { db } from '../db';
import { rechargeTransactions } from '../db/schema';

const router = Router();

const rechargeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many recharge requests. Please wait a minute.' },
  keyGenerator: (req: any) => req.user?.userId || req.ip,
});

const providerEnum = z.enum(['bharatpays', 'setu']);
const serviceTypeEnum = z.enum(['MOBILE', 'DTH', 'ELECTRICITY', 'GAS', 'WATER']);

const rechargeSchema = z.object({
  mobileNumber: z.string().min(6).max(20),
  operator: z.string().min(1),
  serviceType: serviceTypeEnum,
  amount: z.number().positive().min(1),
  provider: providerEnum.optional(),
  circle: z.string().trim().min(1).max(100).optional(),
  planId: z.string().trim().min(1).max(100).optional(),
});

router.get('/providers', authMiddleware, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const providers = RechargeService.listProviders();
    res.json({ providers });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/plans', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const querySchema = z.object({
      provider: providerEnum,
      serviceType: serviceTypeEnum,
      operator: z.string().min(1),
      mobileNumber: z.string().min(6).max(20).optional(),
      circle: z.string().min(1).max(100).optional(),
    });

    const query = querySchema.parse(req.query);
    const plans = await RechargeService.getPlans(query.provider, query);
    res.json({ plans });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }

    res.status(400).json({ error: error.message });
  }
});

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

router.get('/history', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20', status, operator, provider, fromDate, toDate } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    const conditions: any[] = [];

    if (req.user!.role === 'RETAILER') {
      conditions.push(eq(rechargeTransactions.retailerId, req.user!.userId));
    }

    if (status) conditions.push(eq(rechargeTransactions.status, status as any));
    if (operator) conditions.push(eq(rechargeTransactions.operator, operator as string));
    if (provider) conditions.push(eq(rechargeTransactions.apiProvider, provider as string));
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

router.get(
  '/all',
  authMiddleware,
  roleMiddleware('SUPER_ADMIN'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { page = '1', limit = '50', status, provider, fromDate, toDate } = req.query;
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const offset = (pageNum - 1) * limitNum;

      const conditions: any[] = [];
      if (status) conditions.push(eq(rechargeTransactions.status, status as any));
      if (provider) conditions.push(eq(rechargeTransactions.apiProvider, provider as string));
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

async function handleSetuWebhook(req: Request, res: Response): Promise<void> {
  try {
    const result = await RechargeService.handleProviderWebhook('setu', req.body, req.headers);
    res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.message === 'Invalid Setu webhook API key' ? 401 : 500;
    res.status(statusCode).json({ error: error.message });
  }
}

router.post('/webhooks/setu', handleSetuWebhook);
router.post('/webhooks/setu/bills/payment/response', handleSetuWebhook);
router.post('/webhooks/setu/bills/fetch/response', handleSetuWebhook);
router.post('/webhooks/setu/bills/validate/response', handleSetuWebhook);

async function handleBharatPaysWebhook(req: Request, res: Response): Promise<void> {
  try {
    const { refId, status } = req.query;
    if (!refId || !status) {
      res.status(400).json({ error: 'Missing required callback parameters (refId, status)' });
      return;
    }

    const result = await RechargeService.handleProviderWebhook('bharatpays', req.query, req.headers);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

router.get('/callback', handleBharatPaysWebhook);
router.get('/webhooks/bharatpays', handleBharatPaysWebhook);

export default router;
