import { db } from '../db';
import { users, commissionConfigs, commissionDistributions } from '../db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { WalletService } from './wallet.service';
import { normalizeLookupKey } from './providers/utils';

type UserRole = 'SUPER_ADMIN' | 'STATE_HEAD' | 'MASTER_DISTRIBUTOR' | 'DISTRIBUTOR' | 'RETAILER';

type DatabaseTx = any;

function canonicalCommissionKey(serviceType: string, operator?: string | null): string | null {
  const normalizedServiceType = (serviceType || '').trim().toUpperCase();
  const normalizedOperator = normalizeLookupKey(operator || '');

  if (normalizedServiceType === 'MOBILE') {
    if (normalizedOperator === 'jio') return 'Jio';
    if (normalizedOperator === 'airtel') return 'Airtel';
    if (normalizedOperator === 'vi' || normalizedOperator === 'vodafone' || normalizedOperator === 'vodafoneidea') return 'Vi';
    if (normalizedOperator === 'bsnl') return 'BSNL';
  }

  if (normalizedServiceType === 'DTH') {
    if (normalizedOperator === 'tatasky' || normalizedOperator === 'tataplay') return 'TataSky';
    if (normalizedOperator === 'dishtv' || normalizedOperator === 'dishtvindia') return 'DishTV';
    if (normalizedOperator === 'airtel' || normalizedOperator === 'airteldth') return 'Airtel DTH';
  }

  return null;
}

export function resolveCommissionLookupKeys(serviceType: string, operator?: string | null): string[] {
  const keys: string[] = [];
  const canonicalOperatorKey = canonicalCommissionKey(serviceType, operator);
  const normalizedServiceType = (serviceType || '').trim().toUpperCase();

  if (canonicalOperatorKey) {
    keys.push(canonicalOperatorKey);
  }

  if (normalizedServiceType) {
    keys.push(normalizedServiceType);
  }

  return [...new Set(keys)];
}

export class CommissionService {
  static async distributeCommissions(
    rechargeTxnId: string,
    retailerId: string,
    rechargeAmount: number,
    serviceType: string,
    operator: string | null = null,
    tx: DatabaseTx = db
  ): Promise<{ distributedTo: Array<{ userId: string; role: string; amount: number }> }> {
    const distributed: Array<{ userId: string; role: string; amount: number }> = [];
    const lookupKeys = resolveCommissionLookupKeys(serviceType, operator);

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

    while (processingUser) {
      const matchingConfigs = await tx
        .select()
        .from(commissionConfigs)
        .where(
          and(
            inArray(commissionConfigs.serviceType, lookupKeys),
            eq(commissionConfigs.role, processingUser.role as UserRole),
            eq(commissionConfigs.isActive, true)
          )
        );

      const config = lookupKeys
        .map((key) => matchingConfigs.find((candidate: any) => candidate.serviceType === key))
        .find(Boolean);

      if (config) {
        const commValue = parseFloat(config.commissionValue);
        const creditAmount =
          config.commissionType === 'PERCENTAGE'
            ? (rechargeAmount * commValue) / 100
            : commValue;

        if (creditAmount > 0) {
          const commissionLabel = (lookupKeys[0] || serviceType).trim();

          await WalletService.creditWallet(
            processingUser.id,
            creditAmount,
            'COMMISSION',
            rechargeTxnId,
            `Commission for ${commissionLabel} recharge of Rs ${rechargeAmount}`,
            tx,
            'COMMISSION'
          );

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

  static async reverseCommissions(rechargeTxnId: string, tx: DatabaseTx = db): Promise<void> {
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

      await WalletService.debitWallet(
        dist.userId,
        amount,
        'REVERSAL',
        rechargeTxnId,
        'Commission reversal for failed recharge',
        tx
      );

      await tx
        .update(commissionDistributions)
        .set({ status: 'REVERSED' })
        .where(eq(commissionDistributions.id, dist.id));
    }
  }
}
