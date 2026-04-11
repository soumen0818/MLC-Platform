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

    // 1. Verify retailer exists and is active (stateless check first)
    const [retailer] = await db
      .select()
      .from(users)
      .where(eq(users.id, retailerId));

    if (!retailer) throw new Error('Retailer not found');
    if (!retailer.isActive) throw new Error('Account is not active');
    if (retailer.role !== 'RETAILER') throw new Error('Only retailers can process recharges');

    // 2. Lock funds and create pending transaction atomically
    let rechargeTxnId: string = '';
    try {
      await db.transaction(async (tx) => {
        // Atomic wallet debit ensures no double-spending
        await WalletService.debitWallet(
          retailerId,
          amount,
          'RECHARGE',
          undefined,
          `${serviceType} recharge for ${mobileNumber}`,
          tx
        );

        // Create pending transaction record
        const [rechargeTxn] = await tx
          .insert(rechargeTransactions)
          .values({
            retailerId,
            mobileNumber,
            operator,
            serviceType,
            amount: amount.toFixed(2),
            status: 'PENDING',
          })
          .returning({ id: rechargeTransactions.id });

        rechargeTxnId = rechargeTxn.id;
      });
    } catch (error: any) {
      throw new Error(error.message || 'Failed to initialize recharge transaction');
    }

    try {
      // 3. Call third-party recharge API (outside transaction to avoid blocking DB connection!)
      const apiResponse = await RechargeService.callRechargeApi(
        mobileNumber,
        amount,
        operator,
        serviceType
      );

      // 4. Handle response atomically based on API result
      if (apiResponse.status === 'SUCCESS') {
        await db.transaction(async (tx) => {
          // Update status
          await tx
            .update(rechargeTransactions)
            .set({
              apiProvider: 'primary',
              apiTxnId: apiResponse.txnId || null,
              apiResponseRaw: apiResponse.raw || null,
              status: 'SUCCESS',
              failureReason: apiResponse.reason || null,
              updatedAt: new Date(),
            })
            .where(eq(rechargeTransactions.id, rechargeTxnId));

          // Distribute commissions atomically up the chain
          await CommissionService.distributeCommissions(
            rechargeTxnId,
            retailerId,
            amount,
            serviceType,
            tx
          );
        });

        return {
          txnId: rechargeTxnId,
          status: 'SUCCESS',
          message: 'Recharge successful',
        };
      } else if (apiResponse.status === 'FAILED') {
        await db.transaction(async (tx) => {
          // Update status
          await tx
            .update(rechargeTransactions)
            .set({
              apiProvider: 'primary',
              apiTxnId: apiResponse.txnId || null,
              apiResponseRaw: apiResponse.raw || null,
              status: 'FAILED',
              failureReason: apiResponse.reason || null,
              updatedAt: new Date(),
            })
            .where(eq(rechargeTransactions.id, rechargeTxnId));

          // Refund the retailer seamlessly within the transaction
          await WalletService.creditWallet(
            retailerId,
            amount,
            'REVERSAL',
            rechargeTxnId,
            `Refund for failed ${serviceType} recharge`,
            tx
          );
        });

        return {
          txnId: rechargeTxnId,
          status: 'FAILED',
          message: apiResponse.reason || 'Recharge failed',
        };
      } else {
        // PENDING — keep transaction open, waiting for webhook resolution
        await db
          .update(rechargeTransactions)
          .set({
            apiProvider: 'primary',
            apiTxnId: apiResponse.txnId || null,
            apiResponseRaw: apiResponse.raw || null,
            status: 'PENDING',
            updatedAt: new Date(),
          })
          .where(eq(rechargeTransactions.id, rechargeTxnId));

        return {
          txnId: rechargeTxnId,
          status: 'PENDING',
          message: 'Recharge is being processed',
        };
      }
    } catch (error: any) {
      // Network error or timeout — mark as PENDING since money could have left the API provider
      await db
        .update(rechargeTransactions)
        .set({
          status: 'PENDING',
          failureReason: error.message,
          updatedAt: new Date(),
        })
        .where(eq(rechargeTransactions.id, rechargeTxnId!));

      return {
        txnId: rechargeTxnId!,
        status: 'PENDING',
        message: 'Recharge submitted, awaiting confirmation',
      };
    }
  }

  /**
   * Abstract third-party recharge API call — supports Setu BBPS API
   */
  private static async callRechargeApi(
    mobileNumber: string,
    amount: number,
    operator: string,
    serviceType: string
  ): Promise<ApiResponse> {
    try {
      const apiUrl = process.env.RECHARGE_API_URL;      // e.g. https://dg-sandbox.setu.co
      const clientId = process.env.RECHARGE_API_KEY;    // Setu clientId
      const clientSecret = process.env.RECHARGE_CLIENT_SECRET;

      if (!apiUrl || !clientId || !clientSecret) {
        // Demo mode — simulate recharge (90% success rate)
        const isSuccess = Math.random() > 0.1;
        if (isSuccess) {
          return {
            status: 'SUCCESS',
            txnId: `DEMO-${Date.now()}`,
            raw: { demo: true, message: 'Simulated successful recharge' },
          };
        } else {
          return {
            status: 'FAILED',
            reason: 'Simulated failure from Provider',
            raw: { demo: true },
          };
        }
      }

      // Step 1: Exchange credentials for a short-lived JWT from Setu
      const tokenRes = await fetch(`${apiUrl}/api/v2/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientID: clientId,
          secret: clientSecret,
        }),
      });

      if (!tokenRes.ok) {
        return { status: 'FAILED', reason: `Setu auth failed: ${tokenRes.status}` };
      }

      const tokenData: any = await tokenRes.json();
      const bearerToken: string = tokenData?.data?.token;

      if (!bearerToken) {
        return { status: 'FAILED', reason: 'Setu auth token missing in response' };
      }

      // Step 2: Submit the recharge request to Setu BBPS
      const response = await fetch(`${apiUrl}/api/v2/biller-payments/bbps/recharge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${bearerToken}`,
          'X-Setu-Product-Instance-ID': clientId,
        },
        body: JSON.stringify({
          billerId: operator,       // Setu uses billerID to identify operator
          customerMobileNumber: mobileNumber,
          amount: {
            value: Math.round(amount * 100), // Setu uses paise (smallest unit)
            currencyCode: 'INR',
          },
          amountType: 'EXACT',
          additionalInfo: { serviceType },
        }),
      });

      const data: any = await response.json();

      // Setu BBPS response mapping
      if (data?.status === 'SUCCESS' || data?.payment?.status === 'SUCCESS') {
        return {
          status: 'SUCCESS',
          txnId: data?.payment?.id || data?.referenceId || `SETU-${Date.now()}`,
          raw: data,
        };
      } else if (data?.status === 'PENDING' || data?.payment?.status === 'PENDING') {
        return {
          status: 'PENDING',
          txnId: data?.payment?.id || data?.referenceId,
          raw: data,
        };
      } else {
        return {
          status: 'FAILED',
          reason: data?.error?.message || data?.message || 'Recharge failed',
          raw: data,
        };
      }
    } catch (error: any) {
      // On network error, assume PENDING (safe — don't refund prematurely)
      return { status: 'PENDING', reason: error.message };
    }
  }

  /**
   * Handle webhook callback from recharge API provider safely in transaction
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
    if (txn.status !== 'PENDING') return; // Idempotency check

    const amount = parseFloat(txn.amount);

    if (status === 'SUCCESS') {
      await db.transaction(async (dbTx) => {
        await dbTx
          .update(rechargeTransactions)
          .set({
            status: 'SUCCESS',
            failureReason: reason || null,
            updatedAt: new Date(),
          })
          .where(eq(rechargeTransactions.id, txn.id));

        await CommissionService.distributeCommissions(
          txn.id,
          txn.retailerId,
          amount,
          txn.serviceType,
          dbTx
        );
      });
    } else if (status === 'FAILED') {
      await db.transaction(async (dbTx) => {
        await dbTx
          .update(rechargeTransactions)
          .set({
            status: 'FAILED',
            failureReason: reason || null,
            updatedAt: new Date(),
          })
          .where(eq(rechargeTransactions.id, txn.id));

        // Note: For webhook failures, we must refund the user AND reverse any accidentally processed commissions
        await WalletService.creditWallet(
          txn.retailerId,
          amount,
          'REVERSAL',
          txn.id,
          `Refund for failed recharge (webhook)`,
          dbTx
        );

        await CommissionService.reverseCommissions(txn.id, dbTx);
      });
    }
  }
}
