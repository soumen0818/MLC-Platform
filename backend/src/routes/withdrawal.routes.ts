import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { roleMiddleware } from '../middleware/role.middleware';
import { db } from '../db';
import { withdrawalRequests, users } from '../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { WalletService } from '../services/wallet.service';
import { NotificationService } from '../services/notification.service';
import { z } from 'zod';

const router = Router();
router.use(authMiddleware);

const withdrawSchema = z.object({
  amount: z.number().positive().min(100),
  bankAccountNumber: z.string().min(5),
  ifscCode: z.string().min(4),
  accountHolderName: z.string().min(2),
});

const processSchema = z.object({
  action: z.enum(['PAID', 'REJECTED']),
  utrNumber: z.string().optional(),
  rejectionReason: z.string().optional(),
});

// POST /api/withdrawals — create withdrawal request
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const body = withdrawSchema.parse(req.body);

    // Check balance
    const balance = parseFloat(await WalletService.getBalance(req.user!.userId));
    if (balance < body.amount) {
      res.status(400).json({ error: 'Insufficient wallet balance' });
      return;
    }

    // Calculate TDS (5% above ₹30,000 annual threshold — simplified)
    const tdsDeducted = body.amount > 30000 ? body.amount * 0.05 : 0;
    const amountPayable = body.amount - tdsDeducted;

    // Debit wallet immediately (for pending withdrawal)
    await WalletService.debitWallet(
      req.user!.userId,
      body.amount,
      'WITHDRAWAL',
      undefined,
      'Withdrawal request submitted'
    );

    const [request] = await db
      .insert(withdrawalRequests)
      .values({
        userId: req.user!.userId,
        amountRequested: body.amount.toFixed(2),
        tdsDeducted: tdsDeducted.toFixed(2),
        amountPayable: amountPayable.toFixed(2),
        bankAccountNumber: body.bankAccountNumber,
        ifscCode: body.ifscCode,
        accountHolderName: body.accountHolderName,
      })
      .returning();

    res.status(201).json({
      message: 'Withdrawal request submitted',
      withdrawal: request,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    res.status(400).json({ error: error.message });
  }
});

// GET /api/withdrawals/my — my withdrawal history
router.get('/my', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await db
      .select()
      .from(withdrawalRequests)
      .where(eq(withdrawalRequests.userId, req.user!.userId))
      .orderBy(desc(withdrawalRequests.requestedAt));

    res.json({ withdrawals: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/withdrawals/pending — admin view all pending
router.get(
  '/pending',
  roleMiddleware('SUPER_ADMIN'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const result = await db
        .select()
        .from(withdrawalRequests)
        .where(eq(withdrawalRequests.status, 'PENDING'))
        .orderBy(desc(withdrawalRequests.requestedAt));

      res.json({ withdrawals: result });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// GET /api/withdrawals/all — admin view all
router.get(
  '/all',
  roleMiddleware('SUPER_ADMIN'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { status, page = '1', limit = '50' } = req.query;
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);

      const conditions: any[] = [];
      if (status) conditions.push(eq(withdrawalRequests.status, status as any));

      const result = await db
        .select()
        .from(withdrawalRequests)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(withdrawalRequests.requestedAt))
        .limit(limitNum)
        .offset((pageNum - 1) * limitNum);

      res.json({ withdrawals: result });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// PATCH /api/withdrawals/:id/process — admin approve/reject
router.patch(
  '/:id/process',
  roleMiddleware('SUPER_ADMIN'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const body = processSchema.parse(req.body);
      const { id } = req.params as { [key: string]: string };

      const [withdrawal] = await db
        .select()
        .from(withdrawalRequests)
        .where(eq(withdrawalRequests.id, id as string));

      if (!withdrawal) {
        res.status(404).json({ error: 'Withdrawal request not found' });
        return;
      }

      if (withdrawal.status !== 'PENDING') {
        res.status(400).json({ error: 'This request has already been processed' });
        return;
      }

      if (body.action === 'PAID') {
        if (!body.utrNumber) {
          res.status(400).json({ error: 'UTR number is required for approval' });
          return;
        }

        await db
          .update(withdrawalRequests)
          .set({
            status: 'PAID',
            utrNumber: body.utrNumber,
            processedAt: new Date(),
            processedBy: req.user!.userId,
          })
          .where(eq(withdrawalRequests.id, id as string));
      } else {
        // Refund the amount back to user's wallet
        const refundAmount = parseFloat(withdrawal.amountRequested);
        await WalletService.creditWallet(
          withdrawal.userId,
          refundAmount,
          'REVERSAL',
          id,
          `Withdrawal rejected: ${body.rejectionReason || 'No reason provided'}`
        );

        await db
          .update(withdrawalRequests)
          .set({
            status: 'REJECTED',
            rejectionReason: body.rejectionReason || 'No reason provided',
            processedAt: new Date(),
            processedBy: req.user!.userId,
          })
          .where(eq(withdrawalRequests.id, id as string));
      }

      // Get user email for notification
      const [user] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, withdrawal.userId));

      if (user) {
        await NotificationService.sendWithdrawalStatusEmail(
          user.email,
          body.action,
          parseFloat(withdrawal.amountPayable),
          body.utrNumber,
          body.rejectionReason
        );
      }

      res.json({ message: `Withdrawal ${body.action.toLowerCase()} successfully` });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.errors });
        return;
      }
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;
