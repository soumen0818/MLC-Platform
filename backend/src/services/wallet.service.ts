import { db } from '../db';
import { users, walletTransactions } from '../db/schema';
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';

type WalletReason = 'RECHARGE' | 'COMMISSION' | 'TOPUP' | 'WITHDRAWAL' | 'REVERSAL' | 'MANUAL_ADJUSTMENT';
type WalletType = 'MAIN' | 'COMMISSION';

// Helper type for optional db transaction context
type DatabaseTx = any;

export class WalletService {
  /**
   * Credit a wallet.
   * - walletType 'MAIN'       → credit walletBalance (bank top-up, reversal, etc.)
   * - walletType 'COMMISSION' → credit commissionWalletBalance (earned from recharges, locked)
   */
  static async creditWallet(
    userId: string,
    amount: number,
    reason: WalletReason,
    refId?: string,
    note?: string,
    tx: DatabaseTx = db,
    walletType: WalletType = 'MAIN'
  ): Promise<{ success: boolean; newBalance: string; txnId: string }> {
    if (amount <= 0) throw new Error('Amount must be positive');

    let newBalance: string;

    if (walletType === 'COMMISSION') {
      const returned = await tx
        .update(users)
        .set({
          commissionWalletBalance: sql`${users.commissionWalletBalance} + ${amount}`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning({ commissionWalletBalance: users.commissionWalletBalance });

      if (!returned || returned.length === 0) throw new Error('User not found');
      newBalance = returned[0].commissionWalletBalance;
    } else {
      const returned = await tx
        .update(users)
        .set({
          walletBalance: sql`${users.walletBalance} + ${amount}`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning({ walletBalance: users.walletBalance });

      if (!returned || returned.length === 0) throw new Error('User not found');
      newBalance = returned[0].walletBalance;
    }

    const [txn] = await tx
      .insert(walletTransactions)
      .values({
        userId,
        type: 'CREDIT',
        walletType,
        amount: amount.toFixed(2),
        closingBalance: newBalance,
        reason,
        refId: refId || null,
        note: note || null,
      })
      .returning({ id: walletTransactions.id });

    return { success: true, newBalance, txnId: txn.id };
  }

  /**
   * Debit a wallet.
   * For RECHARGE reason: drains commissionWalletBalance first, then falls back to walletBalance.
   * For all other reasons: only debits walletBalance (MAIN).
   */
  static async debitWallet(
    userId: string,
    amount: number,
    reason: WalletReason,
    refId?: string,
    note?: string,
    tx: DatabaseTx = db
  ): Promise<{ success: boolean; newBalance: string; txnId: string }> {
    if (amount <= 0) throw new Error('Amount must be positive');

    if (reason === 'RECHARGE') {
      // Drain commission wallet first, then fall back to main wallet
      const [userRow] = await tx
        .select({
          walletBalance: users.walletBalance,
          commissionWalletBalance: users.commissionWalletBalance,
        })
        .from(users)
        .where(eq(users.id, userId));

      if (!userRow) throw new Error('User not found');

      const commissionBal = parseFloat(userRow.commissionWalletBalance);
      const mainBal = parseFloat(userRow.walletBalance);
      const totalBal = commissionBal + mainBal;

      if (totalBal < amount) throw new Error('Insufficient wallet balance');

      // Calculate how much to take from each wallet
      const fromCommission = Math.min(commissionBal, amount);
      const fromMain = amount - fromCommission;

      let finalMainBalance = userRow.walletBalance;
      let finalCommissionBalance = userRow.commissionWalletBalance;

      // Debit commission wallet portion
      if (fromCommission > 0) {
        const ret = await tx
          .update(users)
          .set({
            commissionWalletBalance: sql`${users.commissionWalletBalance} - ${fromCommission}`,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId))
          .returning({ commissionWalletBalance: users.commissionWalletBalance });
        finalCommissionBalance = ret[0].commissionWalletBalance;

        await tx.insert(walletTransactions).values({
          userId,
          type: 'DEBIT',
          walletType: 'COMMISSION',
          amount: fromCommission.toFixed(2),
          closingBalance: finalCommissionBalance,
          reason,
          refId: refId || null,
          note: note ? `${note} (commission portion)` : 'Commission wallet used for recharge',
        });
      }

      // Debit main wallet remainder
      if (fromMain > 0) {
        const ret = await tx
          .update(users)
          .set({
            walletBalance: sql`${users.walletBalance} - ${fromMain}`,
            updatedAt: new Date(),
          })
          .where(and(eq(users.id, userId), gte(users.walletBalance, fromMain.toFixed(2))))
          .returning({ walletBalance: users.walletBalance });

        if (!ret || ret.length === 0) throw new Error('Insufficient main wallet balance');
        finalMainBalance = ret[0].walletBalance;

        await tx.insert(walletTransactions).values({
          userId,
          type: 'DEBIT',
          walletType: 'MAIN',
          amount: fromMain.toFixed(2),
          closingBalance: finalMainBalance,
          reason,
          refId: refId || null,
          note: note ? `${note} (main wallet portion)` : null,
        });
      }

      // Return a synthetic txnId (the last ledger entry id)
      const [lastTxn] = await tx
        .select({ id: walletTransactions.id })
        .from(walletTransactions)
        .where(eq(walletTransactions.userId, userId))
        .orderBy(desc(walletTransactions.createdAt))
        .limit(1);

      return { success: true, newBalance: finalMainBalance, txnId: lastTxn?.id || '' };
    }

    // All other reasons (WITHDRAWAL, TOPUP, MANUAL_ADJUSTMENT, REVERSAL) — only debit MAIN wallet
    const returned = await tx
      .update(users)
      .set({
        walletBalance: sql`${users.walletBalance} - ${amount}`,
        updatedAt: new Date(),
      })
      .where(and(eq(users.id, userId), gte(users.walletBalance, amount.toFixed(2))))
      .returning({ walletBalance: users.walletBalance });

    if (!returned || returned.length === 0) throw new Error('Insufficient wallet balance or user not found');

    const newBalance = returned[0].walletBalance;

    const [txn] = await tx
      .insert(walletTransactions)
      .values({
        userId,
        type: 'DEBIT',
        walletType: 'MAIN',
        amount: amount.toFixed(2),
        closingBalance: newBalance,
        reason,
        refId: refId || null,
        note: note || null,
      })
      .returning({ id: walletTransactions.id });

    return { success: true, newBalance, txnId: txn.id };
  }

  /**
   * Get both wallet balances for a user
   */
  static async getBalance(userId: string): Promise<string> {
    const [user] = await db
      .select({ walletBalance: users.walletBalance })
      .from(users)
      .where(eq(users.id, userId));
    if (!user) throw new Error('User not found');
    return user.walletBalance;
  }

  static async getFullBalance(userId: string): Promise<{ mainBalance: string; commissionBalance: string; totalBalance: string }> {
    const [user] = await db
      .select({
        walletBalance: users.walletBalance,
        commissionWalletBalance: users.commissionWalletBalance,
      })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) throw new Error('User not found');

    const main = parseFloat(user.walletBalance);
    const commission = parseFloat(user.commissionWalletBalance);

    return {
      mainBalance: user.walletBalance,
      commissionBalance: user.commissionWalletBalance,
      totalBalance: (main + commission).toFixed(2),
    };
  }

  /**
   * Get transaction history (paginated)
   */
  static async getTransactions(
    userId: string,
    page: number = 1,
    limit: number = 20,
    filters?: {
      type?: 'CREDIT' | 'DEBIT';
      reason?: WalletReason;
      walletType?: WalletType;
      fromDate?: Date;
      toDate?: Date;
    }
  ) {
    const offset = (page - 1) * limit;
    const conditions = [eq(walletTransactions.userId, userId)];

    if (filters?.type) conditions.push(eq(walletTransactions.type, filters.type));
    if (filters?.reason) conditions.push(eq(walletTransactions.reason, filters.reason));
    if (filters?.walletType) conditions.push(eq(walletTransactions.walletType, filters.walletType));
    if (filters?.fromDate) conditions.push(gte(walletTransactions.createdAt, filters.fromDate));
    if (filters?.toDate) conditions.push(lte(walletTransactions.createdAt, filters.toDate));

    const transactions = await db
      .select()
      .from(walletTransactions)
      .where(and(...conditions))
      .orderBy(desc(walletTransactions.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(walletTransactions)
      .where(and(...conditions));

    return {
      transactions,
      pagination: {
        page,
        limit,
        total: Number(count),
        totalPages: Math.ceil(Number(count) / limit),
      },
    };
  }

  /**
   * Fund transfer: parent → child (only deducts parent if not SUPER_ADMIN)
   * Always transfers to MAIN wallet
   */
  static async transferFunds(
    parentId: string,
    childId: string,
    amount: number,
    utrNumber?: string
  ): Promise<{ success: boolean }> {
    return await db.transaction(async (tx) => {
      const [child] = await tx
        .select({ parentId: users.parentId })
        .from(users)
        .where(eq(users.id, childId));

      if (!child || child.parentId !== parentId) {
        throw new Error('Invalid transfer: target is not your direct child');
      }

      const [parent] = await tx
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, parentId));

      // SUPER_ADMIN is the master issuer — they don't get debited
      if (parent && parent.role !== 'SUPER_ADMIN') {
        await WalletService.debitWallet(
          parentId,
          amount,
          'TOPUP',
          utrNumber || undefined,
          `Fund transfer to child`,
          tx
        );
      }

      await WalletService.creditWallet(
        childId,
        amount,
        'TOPUP',
        utrNumber || undefined,
        `Fund received from parent`,
        tx,
        'MAIN'  // Injected funds always go to MAIN wallet
      );

      return { success: true };
    });
  }
}
