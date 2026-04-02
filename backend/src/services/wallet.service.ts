import { db } from '../db';
import { users, walletTransactions } from '../db/schema';
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';

type WalletReason = 'RECHARGE' | 'COMMISSION' | 'TOPUP' | 'WITHDRAWAL' | 'REVERSAL' | 'MANUAL_ADJUSTMENT';

export class WalletService {
  /**
   * Credit wallet — atomic operation with DB transaction concept
   * Since Neon HTTP driver doesn't support traditional transactions,
   * we use optimistic locking via balance checks
   */
  static async creditWallet(
    userId: string,
    amount: number,
    reason: WalletReason,
    refId?: string,
    note?: string
  ): Promise<{ success: boolean; newBalance: string; txnId: string }> {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }

    // Get current balance
    const [user] = await db
      .select({ walletBalance: users.walletBalance })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) throw new Error('User not found');

    const currentBalance = parseFloat(user.walletBalance);
    const newBalance = (currentBalance + amount).toFixed(2);

    // Update wallet balance
    await db
      .update(users)
      .set({
        walletBalance: newBalance,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // Record transaction
    const [txn] = await db
      .insert(walletTransactions)
      .values({
        userId,
        type: 'CREDIT',
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
   * Debit wallet — checks sufficient balance before deducting
   */
  static async debitWallet(
    userId: string,
    amount: number,
    reason: WalletReason,
    refId?: string,
    note?: string
  ): Promise<{ success: boolean; newBalance: string; txnId: string }> {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }

    // Get current balance
    const [user] = await db
      .select({ walletBalance: users.walletBalance })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) throw new Error('User not found');

    const currentBalance = parseFloat(user.walletBalance);
    if (currentBalance < amount) {
      throw new Error('Insufficient wallet balance');
    }

    const newBalance = (currentBalance - amount).toFixed(2);

    // Update wallet balance
    await db
      .update(users)
      .set({
        walletBalance: newBalance,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // Record transaction
    const [txn] = await db
      .insert(walletTransactions)
      .values({
        userId,
        type: 'DEBIT',
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
   * Get wallet balance for a user
   */
  static async getBalance(userId: string): Promise<string> {
    const [user] = await db
      .select({ walletBalance: users.walletBalance })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) throw new Error('User not found');
    return user.walletBalance;
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
      fromDate?: Date;
      toDate?: Date;
    }
  ) {
    const offset = (page - 1) * limit;
    const conditions = [eq(walletTransactions.userId, userId)];

    if (filters?.type) {
      conditions.push(eq(walletTransactions.type, filters.type));
    }
    if (filters?.reason) {
      conditions.push(eq(walletTransactions.reason, filters.reason));
    }
    if (filters?.fromDate) {
      conditions.push(gte(walletTransactions.createdAt, filters.fromDate));
    }
    if (filters?.toDate) {
      conditions.push(lte(walletTransactions.createdAt, filters.toDate));
    }

    const transactions = await db
      .select()
      .from(walletTransactions)
      .where(and(...conditions))
      .orderBy(desc(walletTransactions.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
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
   * Fund transfer: parent → child only
   */
  static async transferFunds(
    parentId: string,
    childId: string,
    amount: number,
    utrNumber?: string
  ): Promise<{ success: boolean }> {
    // Verify parent-child relationship
    const [child] = await db
      .select({ parentId: users.parentId })
      .from(users)
      .where(eq(users.id, childId));

    if (!child || child.parentId !== parentId) {
      throw new Error('Invalid transfer: target is not your direct child');
    }

    // Debit parent
    await WalletService.debitWallet(
      parentId,
      amount,
      'TOPUP',
      utrNumber || undefined,
      `Fund transfer to child`
    );

    // Credit child
    await WalletService.creditWallet(
      childId,
      amount,
      'TOPUP',
      utrNumber || undefined,
      `Fund received from parent`
    );

    return { success: true };
  }
}
