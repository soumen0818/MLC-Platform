import { db } from '../db';
import { users, walletTransactions } from '../db/schema';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';

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
      // Commission: credit MAIN wallet (spendable & withdrawable) AND
      // increment commissionWalletBalance as a lifetime earnings counter only.
      const returned = await tx
        .update(users)
        .set({
          walletBalance: sql`${users.walletBalance} + ${amount}`,
          commissionWalletBalance: sql`${users.commissionWalletBalance} + ${amount}`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning({ walletBalance: users.walletBalance });

      if (!returned || returned.length === 0) throw new Error('User not found');
      newBalance = returned[0].walletBalance;
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
        walletType: walletType === 'COMMISSION' ? 'COMMISSION' : 'MAIN', // tag for ledger display
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
   * Always debits from MAIN wallet only.
   * Commission wallet is a read-only lifetime counter — never debited.
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

    // Always debit from MAIN wallet only for all reasons
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

    // commissionWalletBalance is a read-only lifetime earnings counter.
    // Commission credits land directly in walletBalance (MAIN), so
    // totalBalance == mainBalance (no separate commission pot to add).
    return {
      mainBalance: user.walletBalance,
      commissionBalance: user.commissionWalletBalance,  // display-only counter
      totalBalance: user.walletBalance,                  // same as main
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
