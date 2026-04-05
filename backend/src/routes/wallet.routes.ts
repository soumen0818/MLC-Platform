import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { roleMiddleware } from '../middleware/role.middleware';
import { hierarchyMiddleware } from '../middleware/hierarchy.middleware';
import { WalletService } from '../services/wallet.service';
import { db } from '../db';
import { users, topupRequests } from '../db/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { z } from 'zod';

const router = Router();
router.use(authMiddleware);

const transferSchema = z.object({
  childId: z.string().uuid(),
  amount: z.number().positive(),
  utrNumber: z.string().optional(),
});

const adjustSchema = z.object({
  userId: z.string().uuid(),
  type: z.enum(['CREDIT', 'DEBIT']),
  amount: z.number().positive(),
  reason: z.string().min(1),
});

const topupRequestSchema = z.object({
  amount: z.number().positive(),
  utrNumber: z.string().min(3),
});

const topupProcessSchema = z.object({
  action: z.enum(['APPROVED', 'REJECTED']),
});

// GET /api/wallet/balance — get my wallet balance
router.get('/balance', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const balance = await WalletService.getBalance(req.user!.userId);
    res.json({ balance });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/wallet/transactions — get my transaction history
router.get('/transactions', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20', type, reason, fromDate, toDate } = req.query;

    const result = await WalletService.getTransactions(
      req.user!.userId,
      parseInt(page as string),
      parseInt(limit as string),
      {
        type: type as any,
        reason: reason as any,
        fromDate: fromDate ? new Date(fromDate as string) : undefined,
        toDate: toDate ? new Date(toDate as string) : undefined,
      }
    );

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/wallet/transfer — transfer funds to direct child
router.post('/transfer', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const body = transferSchema.parse(req.body);

    await WalletService.transferFunds(
      req.user!.userId,
      body.childId,
      body.amount,
      body.utrNumber
    );

    res.json({ message: 'Funds transferred successfully' });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    res.status(400).json({ error: error.message });
  }
});

// POST /api/wallet/adjust — manual admin wallet adjustment
router.post(
  '/adjust',
  roleMiddleware('SUPER_ADMIN'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const body = adjustSchema.parse(req.body);

      if (body.type === 'CREDIT') {
        await WalletService.creditWallet(
          body.userId,
          body.amount,
          'MANUAL_ADJUSTMENT',
          undefined,
          `Admin adjustment: ${body.reason} (by ${req.user!.userId})`
        );
      } else {
        await WalletService.debitWallet(
          body.userId,
          body.amount,
          'MANUAL_ADJUSTMENT',
          undefined,
          `Admin adjustment: ${body.reason} (by ${req.user!.userId})`
        );
      }

      res.json({ message: `Wallet ${body.type.toLowerCase()}ed successfully` });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.errors });
        return;
      }
      res.status(400).json({ error: error.message });
    }
  }
);

// GET /api/wallet/user/:userId — admin view any user's wallet
router.get(
  '/user/:userId',
  roleMiddleware('SUPER_ADMIN'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { userId } = req.params as { [key: string]: string };
      const { page = '1', limit = '20' } = req.query;

      const balance = await WalletService.getBalance(userId);
      const result = await WalletService.getTransactions(
        userId,
        parseInt(page as string),
        parseInt(limit as string)
      );

      res.json({ balance, ...result });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// POST /api/wallet/topup/request — child requests topup from parent
router.post('/topup/request', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const body = topupRequestSchema.parse(req.body);

    const [request] = await db
      .insert(topupRequests)
      .values({
        requestedBy: req.user!.userId,
        amount: body.amount.toFixed(2),
        utrNumber: body.utrNumber,
        status: 'PENDING',
      })
      .returning();

    res.status(201).json({ message: 'Top-up request submitted', request });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/wallet/topup/my-requests — view my own topup requests
router.get('/topup/my-requests', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const requests = await db
      .select()
      .from(topupRequests)
      .where(eq(topupRequests.requestedBy, req.user!.userId))
      .orderBy(desc(topupRequests.createdAt));
    
    res.json({ requests });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/wallet/topup/pending — parent views pending child requests
router.get('/topup/pending', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Parent gets requests from all users whose parentId == req.user.userId
    const children = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.parentId, req.user!.userId));

    const childIds = children.map(c => c.id);
    
    if (childIds.length === 0) {
      res.json({ requests: [] });
      return;
    }

    const requests = await db
      .select({
        id: topupRequests.id,
        amount: topupRequests.amount,
        utrNumber: topupRequests.utrNumber,
        status: topupRequests.status,
        createdAt: topupRequests.createdAt,
        requestedBy: users.id,
        requesterName: users.name,
        requesterPhone: users.phone,
        requesterRole: users.role,
      })
      .from(topupRequests)
      .innerJoin(users, eq(topupRequests.requestedBy, users.id))
      .where(
        and(
          eq(topupRequests.status, 'PENDING'),
          inArray(topupRequests.requestedBy, childIds)
        )
      )
      .orderBy(desc(topupRequests.createdAt));

    res.json({ requests });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/wallet/topup/:id/process — parent processes request
router.patch('/topup/:id/process', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const body = topupProcessSchema.parse(req.body);
    const { id } = req.params as { [key: string]: string };

    const [request] = await db
      .select()
      .from(topupRequests)
      .where(eq(topupRequests.id, id));

    if (!request) {
      res.status(404).json({ error: 'Request not found' });
      return;
    }
    if (request.status !== 'PENDING') {
      res.status(400).json({ error: 'Request is no longer pending' });
      return;
    }

    // Verify req.user is indeed the parent of the requester
    const [requester] = await db
      .select({ parentId: users.parentId })
      .from(users)
      .where(eq(users.id, request.requestedBy));

    if (requester.parentId !== req.user!.userId && req.user!.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Not authorized to process this request' });
      return;
    }

    if (body.action === 'APPROVED') {
      // Transfer funds from parent to child
      await WalletService.transferFunds(
        req.user!.userId,
        request.requestedBy,
        parseFloat(request.amount),
        request.utrNumber || undefined
      );
    }

    await db
      .update(topupRequests)
      .set({
        status: body.action,
        creditedBy: req.user!.userId,
        processedAt: new Date(),
      })
      .where(eq(topupRequests.id, id));

    res.json({ message: `Request ${body.action.toLowerCase()} successfully` });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    res.status(400).json({ error: error.message });
  }
});

export default router;
