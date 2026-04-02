import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { roleMiddleware } from '../middleware/role.middleware';
import { hierarchyMiddleware } from '../middleware/hierarchy.middleware';
import { WalletService } from '../services/wallet.service';
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

export default router;
