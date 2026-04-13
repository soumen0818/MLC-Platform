import { Router, Request, Response } from 'express';
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

/**
 * GET /api/recharge/callback — BharatPays Recharge Callback URL
 * 
 * BharatPays sends callbacks as GET requests with query parameters:
 * ?number=[RECHARGE_NUMBER]&amount=[AMOUNT]&txnId=[OUR_UNIQUE_ID]&refId=[YOUR_UNIQUE_ID]
 *  &status=[Success/Failure/Refunded]&operatorId=[OPERATOR'S_UNIQUE_ID]
 *  &operatorCode=[OPERATOR_CODE]&balance=[YOUR_BALANCE]
 * 
 * This endpoint is PUBLIC (no auth) — BharatPays server calls it directly.
 */
router.get('/callback', async (req: Request, res: Response): Promise<void> => {
  try {
    const { number, amount, txnId, refId, status, operatorId, operatorCode, balance } = req.query;

    console.log(`[BharatPays Callback] Received: refId=${refId}, txnId=${txnId}, status=${status}, number=${number}, amount=${amount}`);

    if (!refId || !status) {
      res.status(400).json({ error: 'Missing required callback parameters (refId, status)' });
      return;
    }

    await RechargeService.handleCallback({
      refId: refId as string,
      txnId: txnId as string,
      status: status as string,
      number: number as string,
      amount: amount as string,
      operatorId: operatorId as string,
      operatorCode: operatorCode as string,
      balance: balance as string,
    });

    // BharatPays expects a simple acknowledgement
    res.json({ received: true, message: 'Callback processed successfully' });
  } catch (error: any) {
    console.error('[BharatPays Callback] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
