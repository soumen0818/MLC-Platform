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

/**
 * BharatPays Prepaid Operator Code Mapping
 * From: https://bbps.bharatpays.in → Operator Codes → Prepaid
 */
const BHARATPAYS_OPERATOR_CODES: Record<string, string> = {
  'Airtel': '1',
  'airtel': '1',
  'AIRTEL': '1',
  'Jio': '2',
  'jio': '2',
  'JIO': '2',
  'Vi': '3',
  'vi': '3',
  'VI': '3',
  'Vodafone': '3',
  'BSNL': '4',
  'bsnl': '4',
};

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
      // 3. Call BharatPays recharge API (outside transaction to avoid blocking DB connection!)
      const apiResponse = await RechargeService.callRechargeApi(
        mobileNumber,
        amount,
        operator,
        serviceType,
        rechargeTxnId // Pass our DB ID as reference_id for BharatPays
      );

      // 4. Handle response atomically based on API result
      if (apiResponse.status === 'SUCCESS') {
        await db.transaction(async (tx) => {
          // Update status
          await tx
            .update(rechargeTransactions)
            .set({
              apiProvider: 'bharatpays',
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
            operator,
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
              apiProvider: 'bharatpays',
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
        // PENDING — keep transaction open, waiting for webhook/callback resolution
        await db
          .update(rechargeTransactions)
          .set({
            apiProvider: 'bharatpays',
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
   * Call BharatPays Recharge API
   * Endpoint: https://bbps.bharatpays.in/api-user/recharge
   * Params: api_token, opr_code, amount, mobile, reference_id
   */
  private static async callRechargeApi(
    mobileNumber: string,
    amount: number,
    operator: string,
    serviceType: string,
    referenceId: string
  ): Promise<ApiResponse> {
    try {
      const apiToken = process.env.BHARATPAYS_API_TOKEN;

      if (!apiToken) {
        console.error('[RechargeService] BHARATPAYS_API_TOKEN is not configured!');
        return {
          status: 'FAILED',
          reason: 'Recharge service is not configured. Please contact admin.',
        };
      }

      // Map operator name to BharatPays operator code
      const oprCode = BHARATPAYS_OPERATOR_CODES[operator];
      if (!oprCode) {
        return {
          status: 'FAILED',
          reason: `Unknown operator: ${operator}. Supported: Airtel, Jio, Vi, BSNL`,
        };
      }

      // Build BharatPays recharge URL with query parameters
      const url = new URL('https://bbps.bharatpays.in/api-user/recharge');
      url.searchParams.set('api_token', apiToken);
      url.searchParams.set('opr_code', oprCode);
      url.searchParams.set('amount', amount.toString());
      url.searchParams.set('mobile', mobileNumber);
      url.searchParams.set('reference_id', referenceId);

      console.log(`[RechargeService] Calling BharatPays: mobile=${mobileNumber}, amount=${amount}, opr_code=${oprCode}`);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      const data: any = await response.json();

      console.log(`[RechargeService] BharatPays response:`, JSON.stringify(data));

      // BharatPays response mapping
      // Response: { success: true/false, message: "...", data: { recharge_id, opr_txn_id, mobile, amount, status, reference_id, remark } }
      if (data?.success === true) {
        const rechargeData = data?.data || {};
        const apiStatus = (rechargeData.status || '').toUpperCase();

        if (apiStatus === 'SUCCESS') {
          return {
            status: 'SUCCESS',
            txnId: rechargeData.recharge_id || rechargeData.opr_txn_id || null,
            raw: data,
          };
        } else if (apiStatus === 'PENDING') {
          return {
            status: 'PENDING',
            txnId: rechargeData.recharge_id || rechargeData.opr_txn_id || null,
            raw: data,
          };
        } else {
          // API returned success:true but status is FAILED or unknown
          return {
            status: 'FAILED',
            txnId: rechargeData.recharge_id || null,
            reason: rechargeData.remark || data.message || 'Recharge failed at operator',
            raw: data,
          };
        }
      } else {
        // success: false
        return {
          status: 'FAILED',
          reason: data?.message || 'Recharge request rejected by provider',
          raw: data,
        };
      }
    } catch (error: any) {
      console.error('[RechargeService] BharatPays API error:', error.message);
      // On network error, assume PENDING (safe — don't refund prematurely)
      return { status: 'PENDING', reason: error.message };
    }
  }

  /**
   * Handle callback from BharatPays recharge provider
   * Callback format: ?number=...&amount=...&txnId=...&refId=...&status=...&operatorId=...&operatorCode=...&balance=...
   */
  static async handleCallback(params: {
    refId: string;       // Our reference_id (our DB txn ID)
    txnId: string;       // BharatPays recharge_id
    status: string;      // Success / Failure / Refunded
    number?: string;
    amount?: string;
    operatorId?: string;
    operatorCode?: string;
    balance?: string;
  }): Promise<void> {
    const { refId, txnId, status } = params;

    // Find our transaction by ID (refId is our DB ID)
    const [txn] = await db
      .select()
      .from(rechargeTransactions)
      .where(eq(rechargeTransactions.id, refId));

    if (!txn) {
      console.error(`[Callback] Transaction not found for refId: ${refId}`);
      throw new Error('Transaction not found');
    }

    if (txn.status !== 'PENDING') {
      console.log(`[Callback] Transaction ${refId} already resolved as ${txn.status} — skipping`);
      return; // Idempotency check
    }

    const amount = parseFloat(txn.amount);
    const normalizedStatus = status?.toLowerCase();

    if (normalizedStatus === 'success') {
      await db.transaction(async (dbTx) => {
        await dbTx
          .update(rechargeTransactions)
          .set({
            apiTxnId: txnId || txn.apiTxnId,
            apiResponseRaw: params,
            status: 'SUCCESS',
            updatedAt: new Date(),
          })
          .where(eq(rechargeTransactions.id, txn.id));

        await CommissionService.distributeCommissions(
          txn.id,
          txn.retailerId,
          amount,
          txn.operator,
          dbTx
        );
      });
      console.log(`[Callback] Transaction ${refId} resolved → SUCCESS`);
    } else if (normalizedStatus === 'failure' || normalizedStatus === 'failed') {
      await db.transaction(async (dbTx) => {
        await dbTx
          .update(rechargeTransactions)
          .set({
            apiTxnId: txnId || txn.apiTxnId,
            apiResponseRaw: params,
            status: 'FAILED',
            failureReason: 'Confirmed failed via BharatPays callback',
            updatedAt: new Date(),
          })
          .where(eq(rechargeTransactions.id, txn.id));

        await WalletService.creditWallet(
          txn.retailerId,
          amount,
          'REVERSAL',
          txn.id,
          'Refund — recharge failed (provider callback)',
          dbTx
        );

        await CommissionService.reverseCommissions(txn.id, dbTx);
      });
      console.log(`[Callback] Transaction ${refId} resolved → FAILED, retailer refunded`);
    } else if (normalizedStatus === 'refunded') {
      await db.transaction(async (dbTx) => {
        await dbTx
          .update(rechargeTransactions)
          .set({
            apiTxnId: txnId || txn.apiTxnId,
            apiResponseRaw: params,
            status: 'REFUNDED',
            failureReason: 'Refunded by operator via BharatPays callback',
            updatedAt: new Date(),
          })
          .where(eq(rechargeTransactions.id, txn.id));

        await WalletService.creditWallet(
          txn.retailerId,
          amount,
          'REVERSAL',
          txn.id,
          'Refund — recharge refunded by operator',
          dbTx
        );

        await CommissionService.reverseCommissions(txn.id, dbTx);
      });
      console.log(`[Callback] Transaction ${refId} resolved → REFUNDED, retailer refunded`);
    }
  }

  /**
   * Check status of a transaction via BharatPays Status Check API
   * Endpoint: https://bbps.bharatpays.in/api-user/status-check
   * Params: api_token, reference_id, recharge_date (YYYY-MM-DD)
   */
  static async checkStatus(referenceId: string, rechargeDate: string): Promise<ApiResponse> {
    const apiToken = process.env.BHARATPAYS_API_TOKEN;

    if (!apiToken) {
      return { status: 'PENDING', reason: 'No API token configured — demo mode' };
    }

    try {
      const url = new URL('https://bbps.bharatpays.in/api-user/status-check');
      url.searchParams.set('api_token', apiToken);
      url.searchParams.set('reference_id', referenceId);
      url.searchParams.set('recharge_date', rechargeDate);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      const data: any = await response.json();

      if (data?.success === true) {
        const rechargeData = data?.data || {};
        const apiStatus = (rechargeData.status || '').toUpperCase();

        if (apiStatus === 'SUCCESS') return { status: 'SUCCESS', txnId: rechargeData.recharge_id, raw: data };
        if (apiStatus === 'FAILED') return { status: 'FAILED', txnId: rechargeData.recharge_id, reason: rechargeData.remark, raw: data };
        return { status: 'PENDING', txnId: rechargeData.recharge_id, raw: data };
      }

      return { status: 'PENDING', reason: data?.message, raw: data };
    } catch (error: any) {
      return { status: 'PENDING', reason: error.message };
    }
  }
}
