import { db } from '../db';
import { users, commissionConfigs, commissionDistributions } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { WalletService } from './wallet.service';

type UserRole = 'SUPER_ADMIN' | 'STATE_HEAD' | 'MASTER_DISTRIBUTOR' | 'DISTRIBUTOR' | 'RETAILER';

// Helper type for optional transaction
type DatabaseTx = any;

export class CommissionService {
  /**
   * Distribute commissions up the hierarchy after a successful recharge.
   * Starts from the retailer's parent and walks up to the top.
   */
  static async distributeCommissions(
    rechargeTxnId: string,
    retailerId: string,
    rechargeAmount: number,
    serviceType: string,
    tx: DatabaseTx = db
  ): Promise<{ distributedTo: Array<{ userId: string; role: string; amount: number }> }> {
    const distributed: Array<{ userId: string; role: string; amount: number }> = [];

    // Get retailer to start the chain
    let [currentUser] = await tx
      .select({
        id: users.id,
        parentId: users.parentId,
        role: users.role,
      })
      .from(users)
      .where(eq(users.id, retailerId));

    if (!currentUser) throw new Error('Retailer not found');

    let processingUser: any = currentUser;

    // Walk up the hierarchy, including the requesting retailer
    while (processingUser) {

      // Get commission config for this role + service type
      const [config] = await tx
        .select()
        .from(commissionConfigs)
        .where(
          and(
            eq(commissionConfigs.serviceType, serviceType),
            eq(commissionConfigs.role, processingUser.role as UserRole),
            eq(commissionConfigs.isActive, true)
          )
        );

      if (config) {
        const commValue = parseFloat(config.commissionValue);
        const creditAmount =
          config.commissionType === 'PERCENTAGE'
            ? (rechargeAmount * commValue) / 100
            : commValue;

        if (creditAmount > 0) {
          // Credit COMMISSION sub-wallet (locked for recharges only)
          await WalletService.creditWallet(
            processingUser.id,
            creditAmount,
            'COMMISSION',
            rechargeTxnId,
            `Commission for ${serviceType} recharge of ₹${rechargeAmount}`,
            tx,
            'COMMISSION'  // ← Routes to commissionWalletBalance
          );

          // Record commission distribution
          await tx.insert(commissionDistributions).values({
            rechargeTxnId,
            userId: processingUser.id,
            role: processingUser.role as UserRole,
            commissionType: config.commissionType as 'PERCENTAGE' | 'FLAT',
            commissionValue: config.commissionValue,
            amountCredited: creditAmount.toFixed(2),
            status: 'CREDITED',
          });

          distributed.push({
            userId: processingUser.id,
            role: processingUser.role,
            amount: creditAmount,
          });
        }
      }

      // Move to parent for next iteration
      if (processingUser.parentId) {
        const [parentUser] = await tx
          .select({
            id: users.id,
            parentId: users.parentId,
            role: users.role,
          })
          .from(users)
          .where(eq(users.id, processingUser.parentId));
        processingUser = parentUser;
      } else {
        processingUser = null;
      }
    }

    return { distributedTo: distributed };
  }

  /**
   * Reverse commissions for a failed/refunded recharge
   */
  static async reverseCommissions(rechargeTxnId: string, tx: DatabaseTx = db): Promise<void> {
    // Get all commission distributions for this recharge
    const distributions = await tx
      .select()
      .from(commissionDistributions)
      .where(
        and(
          eq(commissionDistributions.rechargeTxnId, rechargeTxnId),
          eq(commissionDistributions.status, 'CREDITED')
        )
      );

    for (const dist of distributions) {
      const amount = parseFloat(dist.amountCredited);

      // Debit the commission back
      await WalletService.debitWallet(
        dist.userId,
        amount,
        'REVERSAL',
        rechargeTxnId,
        `Commission reversal for failed recharge`,
        tx
      );

      // Update distribution status
      await tx
        .update(commissionDistributions)
        .set({ status: 'REVERSED' })
        .where(eq(commissionDistributions.id, dist.id));
    }
  }
}
