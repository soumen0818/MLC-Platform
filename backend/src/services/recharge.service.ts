import { db } from '../db';
import { rechargeTransactions, users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { WalletService } from './wallet.service';
import { CommissionService } from './commission.service';
import { getRechargeProvider, listRechargeProviders } from './providers';
import {
  PlanLookupInput,
  ProviderBalanceBreakdown,
  ProviderDescriptor,
  ProviderRechargeResult,
  ProviderWebhookResult,
  RechargeProviderId,
  RechargeRequestInput,
  RechargeServiceType,
  RechargeTransactionRecord,
} from './providers/types';
import { isRecord } from './providers/utils';

interface RechargeResponse {
  txnId: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING' | 'REFUNDED';
  message: string;
}

function mergeProviderRaw(
  existing: unknown,
  update: Record<string, unknown>
): Record<string, unknown> {
  const previous = isRecord(existing) ? existing : {};
  return {
    ...previous,
    ...update,
    updatedAt: new Date().toISOString(),
  };
}

function resolveDefaultProvider(serviceType: RechargeServiceType): RechargeProviderId {
  const envOverride = process.env[`RECHARGE_DEFAULT_PROVIDER_${serviceType}`];
  const defaultProvider = envOverride || process.env.RECHARGE_DEFAULT_PROVIDER || 'bharatpays';

  if (defaultProvider !== 'bharatpays' && defaultProvider !== 'setu') {
    return 'bharatpays';
  }

  return defaultProvider;
}

export class RechargeService {
  static async processRecharge(
    request: Omit<RechargeRequestInput, 'retailerName' | 'retailerEmail' | 'retailerPhone' | 'provider'> & {
      provider?: RechargeProviderId;
    }
  ): Promise<RechargeResponse> {
    const providerId = request.provider || resolveDefaultProvider(request.serviceType);
    const provider = getRechargeProvider(providerId);

    const [retailer] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        role: users.role,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.id, request.retailerId));

    if (!retailer) throw new Error('Retailer not found');
    if (!retailer.isActive) throw new Error('Account is not active');
    if (retailer.role !== 'RETAILER') throw new Error('Only retailers can process recharges');

    if (!provider.supportsService(request.serviceType)) {
      throw new Error(`${provider.name} is not configured for ${request.serviceType} recharges.`);
    }

    let rechargeTxnId = '';
    try {
      await db.transaction(async (tx) => {
        await WalletService.debitWallet(
          request.retailerId,
          request.amount,
          'RECHARGE',
          undefined,
          `${request.serviceType} recharge for ${request.mobileNumber} via ${provider.name}`,
          tx
        );

        const [rechargeTxn] = await tx
          .insert(rechargeTransactions)
          .values({
            retailerId: request.retailerId,
            mobileNumber: request.mobileNumber,
            operator: request.operator,
            serviceType: request.serviceType,
            amount: request.amount.toFixed(2),
            apiProvider: providerId,
            status: 'PENDING',
            apiResponseRaw: {
              provider: providerId,
              requestedProvider: providerId,
              circle: request.circle || null,
              planId: request.planId || null,
            },
          })
          .returning({ id: rechargeTransactions.id });

        rechargeTxnId = rechargeTxn.id;
      });
    } catch (error: any) {
      throw new Error(error.message || 'Failed to initialize recharge transaction');
    }

    try {
      const providerResult = await provider.initiateRecharge({
        ...request,
        provider: providerId,
        retailerName: retailer.name,
        retailerEmail: retailer.email,
        retailerPhone: retailer.phone,
        rechargeTxnId,
      });

      await this.applyResolution(
        rechargeTxnId,
        providerId,
        providerResult,
      );

      return {
        txnId: rechargeTxnId,
        status: providerResult.status,
        message: this.statusMessage(providerResult),
      };
    } catch (error: any) {
      await db
        .update(rechargeTransactions)
        .set({
          apiProvider: providerId,
          status: 'PENDING',
          failureReason: error.message || 'Recharge provider request failed',
          apiResponseRaw: mergeProviderRaw(null, {
            provider: providerId,
            initError: error.message || 'Provider request failed',
          }),
          updatedAt: new Date(),
        })
        .where(eq(rechargeTransactions.id, rechargeTxnId));

      return {
        txnId: rechargeTxnId,
        status: 'PENDING',
        message: 'Recharge submitted, awaiting confirmation',
      };
    }
  }

  static async applyResolution(
    rechargeTxnId: string,
    providerId: RechargeProviderId,
    resolution: ProviderRechargeResult | ProviderWebhookResult
  ): Promise<void> {
    const status = resolution.status || 'PENDING';

    await db.transaction(async (dbTx) => {
      const [txn] = await dbTx
        .select()
        .from(rechargeTransactions)
        .where(eq(rechargeTransactions.id, rechargeTxnId));

      if (!txn) {
        throw new Error('Recharge transaction not found');
      }

      if (txn.status !== 'PENDING') {
        return;
      }

      const raw = mergeProviderRaw(txn.apiResponseRaw, {
        provider: providerId,
        lastEvent: status,
        lastPayload: resolution.raw ?? null,
      });

      if (status === 'SUCCESS') {
        await dbTx
          .update(rechargeTransactions)
          .set({
            apiProvider: providerId,
            apiTxnId: resolution.txnId || txn.apiTxnId,
            apiResponseRaw: raw,
            status: 'SUCCESS',
            failureReason: null,
            updatedAt: new Date(),
          })
          .where(eq(rechargeTransactions.id, rechargeTxnId));

        await CommissionService.distributeCommissions(
          rechargeTxnId,
          txn.retailerId,
          parseFloat(txn.amount),
          txn.serviceType,
          txn.operator,
          dbTx
        );

        return;
      }

      if (status === 'FAILED' || status === 'REFUNDED') {
        await dbTx
          .update(rechargeTransactions)
          .set({
            apiProvider: providerId,
            apiTxnId: resolution.txnId || txn.apiTxnId,
            apiResponseRaw: raw,
            status,
            failureReason: resolution.reason || (status === 'REFUNDED' ? 'Recharge refunded by provider' : 'Recharge failed'),
            updatedAt: new Date(),
          })
          .where(eq(rechargeTransactions.id, rechargeTxnId));

        await WalletService.creditWallet(
          txn.retailerId,
          parseFloat(txn.amount),
          'REVERSAL',
          rechargeTxnId,
          status === 'REFUNDED' ? 'Refund for provider reversal' : `Refund for failed ${txn.serviceType} recharge`,
          dbTx,
          'MAIN'
        );

        await CommissionService.reverseCommissions(rechargeTxnId, dbTx);
        return;
      }

      await dbTx
        .update(rechargeTransactions)
        .set({
          apiProvider: providerId,
          apiTxnId: resolution.txnId || txn.apiTxnId,
          apiResponseRaw: raw,
          status: 'PENDING',
          failureReason: resolution.reason || txn.failureReason,
          updatedAt: new Date(),
        })
        .where(eq(rechargeTransactions.id, rechargeTxnId));
    });
  }

  static async checkStatus(txn: RechargeTransactionRecord): Promise<ProviderRechargeResult> {
    const providerId = (txn.apiProvider as RechargeProviderId | null) || 'bharatpays';
    const provider = getRechargeProvider(providerId);
    return provider.checkStatus(txn);
  }

  static async handleProviderWebhook(
    providerId: RechargeProviderId,
    payload: unknown,
    headers: Record<string, string | string[] | undefined>
  ): Promise<{ received: true; ignored?: boolean }> {
    const provider = getRechargeProvider(providerId);
    const resolution = await provider.handleWebhook(payload, headers);

    if (!resolution || !resolution.rechargeTxnId || !resolution.status) {
      return { received: true, ignored: true };
    }

    await this.applyResolution(resolution.rechargeTxnId, providerId, resolution);
    return { received: true };
  }

  static listProviders(): ProviderDescriptor[] {
    return listRechargeProviders().map((provider) => provider.getDescriptor());
  }

  static async listProviderStatuses(): Promise<Array<ProviderDescriptor & {
    healthy?: boolean;
    balance?: string | null;
    balances?: ProviderBalanceBreakdown;
    message?: string | null;
  }>> {
    const providers = listRechargeProviders();
    const results = await Promise.all(
      providers.map(async (provider) => {
        const descriptor = provider.getDescriptor();
        const operationalStatus = provider.getOperationalStatus
          ? await provider.getOperationalStatus()
          : { configured: descriptor.configured, healthy: descriptor.configured, balance: null, message: null };

        return {
          ...descriptor,
          healthy: operationalStatus.healthy,
          balance: operationalStatus.balance ?? null,
          balances: operationalStatus.balances ?? undefined,
          message: operationalStatus.message ?? null,
        };
      })
    );

    return results;
  }

  static async getPlans(
    providerId: RechargeProviderId,
    input: PlanLookupInput
  ) {
    const provider = getRechargeProvider(providerId);
    if (!provider.getPlans) {
      throw new Error(`${provider.name} does not provide plan lookup.`);
    }

    return provider.getPlans(input);
  }

  private static statusMessage(result: ProviderRechargeResult): string {
    if (result.status === 'SUCCESS') {
      return 'Recharge successful';
    }

    if (result.status === 'FAILED') {
      return result.reason || 'Recharge failed';
    }

    if (result.status === 'REFUNDED') {
      return result.reason || 'Recharge refunded';
    }

    return 'Recharge is being processed';
  }
}
