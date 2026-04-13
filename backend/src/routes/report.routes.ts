import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { roleMiddleware } from '../middleware/role.middleware';
import { db } from '../db';
import { rechargeTransactions, commissionDistributions, walletTransactions, users, withdrawalRequests } from '../db/schema';
import { eq, and, gte, lte, sql, desc, count } from 'drizzle-orm';

const router = Router();
router.use(authMiddleware);

// GET /api/reports/daily — admin daily recharge report
router.get(
  '/daily',
  roleMiddleware('SUPER_ADMIN'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { date } = req.query;
      const reportDate = date ? new Date(date as string) : new Date();
      const startOfDay = new Date(reportDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(reportDate.setHours(23, 59, 59, 999));

      // Recharge stats
      const [rechargeStats] = await db
        .select({
          total: sql<number>`count(*)`,
          totalAmount: sql<string>`COALESCE(SUM(amount), 0)`,
          successCount: sql<number>`SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END)`,
          failedCount: sql<number>`SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END)`,
          pendingCount: sql<number>`SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END)`,
        })
        .from(rechargeTransactions)
        .where(
          and(
            gte(rechargeTransactions.createdAt, startOfDay),
            lte(rechargeTransactions.createdAt, endOfDay)
          )
        );

      // Commission stats
      const [commissionStats] = await db
        .select({
          totalPaid: sql<string>`COALESCE(SUM(CASE WHEN status = 'CREDITED' THEN amount_credited ELSE 0 END), 0)`,
        })
        .from(commissionDistributions)
        .where(
          and(
            gte(commissionDistributions.createdAt, startOfDay),
            lte(commissionDistributions.createdAt, endOfDay)
          )
        );

      res.json({
        date: startOfDay.toISOString().split('T')[0],
        recharges: rechargeStats,
        commissions: commissionStats,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// GET /api/reports/dashboard-stats — role-specific dashboard KPI data
router.get('/dashboard-stats', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (role === 'SUPER_ADMIN') {
      // Platform-wide stats
      const [userStats] = await db
        .select({
          totalUsers: sql<number>`count(*)`,
          activeUsers: sql<number>`SUM(CASE WHEN is_active = true THEN 1 ELSE 0 END)`,
        })
        .from(users);

      const [todayRecharges] = await db
        .select({
          count: sql<number>`count(*)`,
          totalAmount: sql<string>`COALESCE(SUM(amount), 0)`,
        })
        .from(rechargeTransactions)
        .where(
          and(
            gte(rechargeTransactions.createdAt, today),
            eq(rechargeTransactions.status, 'SUCCESS')
          )
        );

      const [todayCommissions] = await db
        .select({
          totalPaid: sql<string>`COALESCE(SUM(amount_credited), 0)`,
        })
        .from(commissionDistributions)
        .where(
          and(
            gte(commissionDistributions.createdAt, today),
            eq(commissionDistributions.status, 'CREDITED')
          )
        );

      const [pendingWithdrawals] = await db
        .select({ count: sql<number>`count(*)` })
        .from(withdrawalRequests)
        .where(eq(withdrawalRequests.status, 'PENDING'));

      const [walletPool] = await db
        .select({
          totalLiquidity: sql<string>`COALESCE(SUM(CAST(wallet_balance AS NUMERIC)), 0)`
        })
        .from(users)
        .where(sql`role != 'SUPER_ADMIN'`);

      // Fetch live B2B Wallet Balance from BharatPays Provider
      let providerBalance = '0.00';
      try {
        const apiToken = process.env.BHARATPAYS_API_TOKEN;
        const username = process.env.BHARATPAYS_USERNAME;
        if (apiToken && username) {
          const url = `https://bbps.bharatpays.in/api-user/balance?username=${username}&api_token=${apiToken}`;
          
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000); // 5-second timeout
          
          const res = await fetch(url, { 
            method: 'GET', 
            headers: { 'Accept': 'application/json' },
            signal: controller.signal 
          });
          clearTimeout(timeout);
          
          if (res.ok) {
             const data = await res.json() as any;
             if (data && data.status === 'Ok' && data.totalBalance) {
               providerBalance = parseFloat(data.totalBalance).toFixed(2);
             } else {
               console.warn('[Report] BharatPays balance warn:', data);
             }
          } else {
             console.error(`[Report] BharatPays check failed: HTTP ${res.status}`);
          }
        }
      } catch (err: any) {
        console.error('[Report] Failed to fetch BharatPays provider balance:', err.name, err.message);
      }

      res.json({
        totalUsers: userStats.totalUsers,
        activeUsers: userStats.activeUsers,
        todayRecharges: todayRecharges.count,
        todayRechargeAmount: todayRecharges.totalAmount,
        todayCommissionsPaid: todayCommissions.totalPaid,
        pendingWithdrawals: pendingWithdrawals.count,
        platformLiquidity: walletPool.totalLiquidity,
        providerLiquidity: providerBalance,
      });
    } else if (role === 'RETAILER') {
      // Retailer stats
      const balance = await db
        .select({ walletBalance: users.walletBalance })
        .from(users)
        .where(eq(users.id, userId));

      const [todayRecharges] = await db
        .select({
          count: sql<number>`count(*)`,
          totalAmount: sql<string>`COALESCE(SUM(amount), 0)`,
        })
        .from(rechargeTransactions)
        .where(
          and(
            eq(rechargeTransactions.retailerId, userId),
            gte(rechargeTransactions.createdAt, today),
            eq(rechargeTransactions.status, 'SUCCESS')
          )
        );

      const [todayCommissions] = await db
        .select({
          totalEarned: sql<string>`COALESCE(SUM(amount_credited), 0)`,
        })
        .from(commissionDistributions)
        .where(
          and(
            eq(commissionDistributions.userId, userId),
            gte(commissionDistributions.createdAt, today),
            eq(commissionDistributions.status, 'CREDITED')
          )
        );

      res.json({
        walletBalance: balance[0]?.walletBalance || '0.00',
        todayRecharges: todayRecharges.count,
        todayRechargeAmount: todayRecharges.totalAmount,
        todayCommission: todayCommissions.totalEarned,
      });
    } else {
      // State Head / Master / Distributor — show children stats
      const childrenCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(eq(users.parentId, userId));

      const balance = await db
        .select({ walletBalance: users.walletBalance })
        .from(users)
        .where(eq(users.id, userId));

      const [todayCommissions] = await db
        .select({
          totalEarned: sql<string>`COALESCE(SUM(amount_credited), 0)`,
        })
        .from(commissionDistributions)
        .where(
          and(
            eq(commissionDistributions.userId, userId),
            gte(commissionDistributions.createdAt, today),
            eq(commissionDistributions.status, 'CREDITED')
          )
        );

      res.json({
        walletBalance: balance[0]?.walletBalance || '0.00',
        childrenCount: childrenCount[0].count,
        todayCommission: todayCommissions.totalEarned,
      });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/reports/export — CSV export
router.get(
  '/export',
  roleMiddleware('SUPER_ADMIN'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { type, fromDate, toDate } = req.query;

      if (!type) {
        res.status(400).json({ error: 'Report type is required' });
        return;
      }

      const start = fromDate ? new Date(fromDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = toDate ? new Date(toDate as string) : new Date();

      let csvData = '';

      if (type === 'recharges') {
        const data = await db
          .select()
          .from(rechargeTransactions)
          .where(and(gte(rechargeTransactions.createdAt, start), lte(rechargeTransactions.createdAt, end)))
          .orderBy(desc(rechargeTransactions.createdAt));

        csvData = 'ID,Retailer ID,Mobile,Operator,Service,Amount,Status,Created At\n';
        data.forEach(row => {
          csvData += `${row.id},${row.retailerId},${row.mobileNumber},${row.operator},${row.serviceType},${row.amount},${row.status},${row.createdAt}\n`;
        });
      } else if (type === 'commissions') {
        const data = await db
          .select()
          .from(commissionDistributions)
          .where(and(gte(commissionDistributions.createdAt, start), lte(commissionDistributions.createdAt, end)))
          .orderBy(desc(commissionDistributions.createdAt));

        csvData = 'ID,User ID,Role,Type,Value,Amount Credited,Status,Created At\n';
        data.forEach(row => {
          csvData += `${row.id},${row.userId},${row.role},${row.commissionType},${row.commissionValue},${row.amountCredited},${row.status},${row.createdAt}\n`;
        });
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${type}-report.csv`);
      res.send(csvData);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;
