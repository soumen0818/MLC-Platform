import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { roleMiddleware } from '../middleware/role.middleware';
import { db } from '../db';
import { rechargeTransactions, commissionDistributions, walletTransactions, users, withdrawalRequests } from '../db/schema';
import { eq, and, gte, lte, sql, desc, count } from 'drizzle-orm';
import { RechargeService } from '../services/recharge.service';

const router = Router();
router.use(authMiddleware);

function toNumericAmount(value?: string | null): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

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

      const providerStatuses = await RechargeService.listProviderStatuses();
      const providerTotals = providerStatuses.reduce(
        (summary, provider) => {
          const trade = toNumericAmount(provider.balances?.trade);
          const recharge = toNumericAmount(provider.balances?.recharge);
          const total =
            toNumericAmount(provider.balances?.total ?? provider.balance) ??
            (trade !== null || recharge !== null ? (trade || 0) + (recharge || 0) : null);

          if (trade !== null) {
            summary.trade += trade;
            summary.tradeSources += 1;
          }

          if (recharge !== null) {
            summary.recharge += recharge;
            summary.rechargeSources += 1;
          }

          if (total !== null) {
            summary.total += total;
            summary.totalSources += 1;
          }

          return summary;
        },
        {
          total: 0,
          trade: 0,
          recharge: 0,
          totalSources: 0,
          tradeSources: 0,
          rechargeSources: 0,
        }
      );

      res.json({
        totalUsers: userStats.totalUsers,
        activeUsers: userStats.activeUsers,
        todayRecharges: todayRecharges.count,
        todayRechargeAmount: todayRecharges.totalAmount,
        todayCommissionsPaid: todayCommissions.totalPaid,
        pendingWithdrawals: pendingWithdrawals.count,
        platformLiquidity: walletPool.totalLiquidity,
        providerFundsTotal: providerTotals.totalSources > 0 ? providerTotals.total.toFixed(2) : null,
        providerTradeBalance: providerTotals.tradeSources > 0 ? providerTotals.trade.toFixed(2) : null,
        providerRechargeBalance: providerTotals.rechargeSources > 0 ? providerTotals.recharge.toFixed(2) : null,
        providersReportingBalance: providerTotals.totalSources,
        providerStatuses,
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
