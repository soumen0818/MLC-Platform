import { db } from '../db';
import { rechargeTransactions, users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { WalletService } from './wallet.service';
import { CommissionService } from './commission.service';

interface RechargeRequest {
  retailerId: string;
  mobileNumber: string;
  operator: string;
  serviceType: 'MOBILE' | 'DTH' | 'ELECTRICITY' | 'GAS' | 'WATER';
  amount: number;
}

interface ApiResponse {
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  txnId?: string;
  reason?: string;
  raw?: any;
}

export class RechargeService {
  /**
   * Process a recharge request
   */
  static async processRecharge(request: RechargeRequest): Promise<{
    txnId: string;
    status: string;
    message: string;
  }> {
    const { retailerId, mobileNumber, operator, serviceType, amount } = request;

    // 1. Verify retailer exists and is active
    const [retailer] = await db
      .select()
      .from(users)
      .where(eq(users.id, retailerId));

    if (!retailer) throw new Error('Retailer not found');
    if (!retailer.isActive) throw new Error('Account is not active');
    if (retailer.role !== 'RETAILER') throw new Error('Only retailers can process recharges');

    // 2. Check wallet balance
    const balance = parseFloat(retailer.walletBalance);
    if (balance < amount) {
      throw new Error('Insufficient wallet balance');
    }

    // 3. Create recharge transaction record
    const [rechargeTxn] = await db
      .insert(rechargeTransactions)
      .values({
        retailerId,
        mobileNumber,
        operator,
        serviceType,
        amount: amount.toFixed(2),
        status: 'PENDING',
      })
      .returning();

    try {
      // 4. Debit retailer's wallet
      await WalletService.debitWallet(
        retailerId,
        amount,
        'RECHARGE',
        rechargeTxn.id,
        `${serviceType} recharge for ${mobileNumber}`
      );

      // 5. Call third-party recharge API
      const apiResponse = await RechargeService.callRechargeApi(
        mobileNumber,
        amount,
        operator,
        serviceType
      );

      // 6. Update recharge transaction with API response
      await db
        .update(rechargeTransactions)
        .set({
          apiProvider: 'primary',
          apiTxnId: apiResponse.txnId || null,
          apiResponseRaw: apiResponse.raw || null,
          status: apiResponse.status,
          failureReason: apiResponse.reason || null,
          updatedAt: new Date(),
        })
        .where(eq(rechargeTransactions.id, rechargeTxn.id));

      // 7. Handle response
      if (apiResponse.status === 'SUCCESS') {
        // Distribute commissions up the chain
        await CommissionService.distributeCommissions(
          rechargeTxn.id,
          retailerId,
          amount,
          serviceType
        );

        return {
          txnId: rechargeTxn.id,
          status: 'SUCCESS',
          message: 'Recharge successful',
        };
      } else if (apiResponse.status === 'FAILED') {
        // Refund the retailer
        await WalletService.creditWallet(
          retailerId,
          amount,
          'REVERSAL',
          rechargeTxn.id,
          `Refund for failed ${serviceType} recharge`
        );

        return {
          txnId: rechargeTxn.id,
          status: 'FAILED',
          message: apiResponse.reason || 'Recharge failed',
        };
      } else {
        // PENDING — don't refund, wait for webhook
        return {
          txnId: rechargeTxn.id,
          status: 'PENDING',
          message: 'Recharge is being processed',
        };
      }
    } catch (error: any) {
      // Network error or timeout — mark as PENDING
      await db
        .update(rechargeTransactions)
        .set({
          status: 'PENDING',
          failureReason: error.message,
          updatedAt: new Date(),
        })
        .where(eq(rechargeTransactions.id, rechargeTxn.id));

      return {
        txnId: rechargeTxn.id,
        status: 'PENDING',
        message: 'Recharge submitted, awaiting confirmation',
      };
    }
  }

  /**
   * Abstract third-party recharge API call
   * In production, replace with actual API integration
   */
  private static async callRechargeApi(
    mobileNumber: string,
    amount: number,
    operator: string,
    serviceType: string
  ): Promise<ApiResponse> {
    try {
      const apiUrl = process.env.RECHARGE_API_URL;
      const apiKey = process.env.RECHARGE_API_KEY;

      if (!apiUrl || !apiKey) {
        // Demo mode — simulate successful recharge
        return {
          status: 'SUCCESS',
          txnId: `DEMO-${Date.now()}`,
          raw: { demo: true, message: 'Simulated recharge' },
        };
      }

      // Real API call would go here
      const response = await fetch(`${apiUrl}/recharge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          mobile: mobileNumber,
          amount,
          operator,
          type: serviceType,
        }),
      });

      const data = await response.json();

      if (data.status === 'success' || data.status === 1) {
        return { status: 'SUCCESS', txnId: data.txn_id, raw: data };
      } else if (data.status === 'pending' || data.status === 2) {
        return { status: 'PENDING', txnId: data.txn_id, raw: data };
      } else {
        return { status: 'FAILED', reason: data.message, raw: data };
      }
    } catch (error: any) {
      // On network error, return PENDING — never assume failure
      return { status: 'PENDING', reason: error.message };
    }
  }

  /**
   * Handle webhook callback from recharge API provider
   */
  static async handleWebhook(
    apiTxnId: string,
    status: 'SUCCESS' | 'FAILED',
    reason?: string
  ): Promise<void> {
    const [txn] = await db
      .select()
      .from(rechargeTransactions)
      .where(eq(rechargeTransactions.apiTxnId, apiTxnId));

    if (!txn) throw new Error('Transaction not found');
    if (txn.status !== 'PENDING') return; // Already resolved

    const amount = parseFloat(txn.amount);

    await db
      .update(rechargeTransactions)
      .set({
        status,
        failureReason: reason || null,
        updatedAt: new Date(),
      })
      .where(eq(rechargeTransactions.id, txn.id));

    if (status === 'SUCCESS') {
      // Distribute commissions
      await CommissionService.distributeCommissions(
        txn.id,
        txn.retailerId,
        amount,
        txn.serviceType
      );
    } else if (status === 'FAILED') {
      // Refund retailer
      await WalletService.creditWallet(
        txn.retailerId,
        amount,
        'REVERSAL',
        txn.id,
        `Refund for failed recharge (webhook)`
      );

      // Reverse any commissions if they were distributed
      await CommissionService.reverseCommissions(txn.id);
    }
  }
}
