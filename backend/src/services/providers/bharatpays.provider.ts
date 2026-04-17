import {
  PlanLookupInput,
  ProviderDescriptor,
  ProviderRechargeResult,
  ProviderStatusResult,
  ProviderWebhookResult,
  RechargeProvider,
  RechargeRequestInput,
  RechargeServiceType,
  RechargeTransactionRecord,
} from './types';
import { fetchJson, isRecord } from './utils';

interface BharatPaysResponse {
  success?: boolean;
  message?: string;
  status?: string;
  totalBalance?: string;
  tradeBalance?: string;
  rechargeBalance?: string;
  data?: {
    recharge_id?: string;
    opr_txn_id?: string;
    mobile?: string;
    amount?: string;
    status?: string;
    reference_id?: string;
    remark?: string;
    totalBalance?: string;
    tradeBalance?: string;
    rechargeBalance?: string;
    total_balance?: string;
    trade_balance?: string;
    recharge_balance?: string;
    total?: string | number;
    trade?: string | number;
    recharge?: string | number;
    balance?: string | number;
  };
}

const BHARATPAYS_OPERATOR_CODES: Record<string, string> = {
  airtel: '1',
  jio: '2',
  vi: '3',
  vodafone: '3',
  bsnl: '4',
};

function toBalanceString(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toFixed(4);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const numeric = parseFloat(trimmed);
    if (Number.isFinite(numeric)) {
      return trimmed;
    }
  }

  return null;
}

function pickBalance(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const balance = toBalanceString(source[key]);
    if (balance !== null) {
      return balance;
    }
  }

  return null;
}

function resolveBharatPaysBalances(data: BharatPaysResponse): {
  total: string | null;
  trade: string | null;
  recharge: string | null;
} {
  const topLevel = isRecord(data) ? data : {};
  const nested = isRecord(data?.data) ? data.data : {};

  const trade =
    pickBalance(topLevel, ['tradeBalance', 'trade_balance', 'trade']) ||
    pickBalance(nested, ['tradeBalance', 'trade_balance', 'trade']);

  const recharge =
    pickBalance(topLevel, ['rechargeBalance', 'recharge_balance', 'recharge']) ||
    pickBalance(nested, ['rechargeBalance', 'recharge_balance', 'recharge']);

  let total =
    pickBalance(topLevel, ['totalBalance', 'total_balance', 'total', 'balance']) ||
    pickBalance(nested, ['totalBalance', 'total_balance', 'total', 'balance']);

  if (!total && (trade || recharge)) {
    const tradeAmount = trade ? parseFloat(trade) : 0;
    const rechargeAmount = recharge ? parseFloat(recharge) : 0;
    total = (tradeAmount + rechargeAmount).toFixed(4);
  }

  return { total, trade, recharge };
}

function normalizeOperationalMessage(message?: string): string | null {
  if (!message) {
    return null;
  }

  if (/unknown ip/i.test(message)) {
    return 'Whitelist your backend public IP in BharatPays to fetch live balances.';
  }

  return message;
}

function mapApiStatus(data: BharatPaysResponse): ProviderRechargeResult {
  if (data?.success === true) {
    const rechargeData = data.data ?? {};
    const apiStatus = (rechargeData.status || '').toUpperCase();

    if (apiStatus === 'SUCCESS') {
      return {
        status: 'SUCCESS',
        txnId: rechargeData.recharge_id || rechargeData.opr_txn_id || null,
        raw: data,
      };
    }

    if (apiStatus === 'PENDING') {
      return {
        status: 'PENDING',
        txnId: rechargeData.recharge_id || rechargeData.opr_txn_id || null,
        raw: data,
      };
    }

    if (apiStatus === 'REFUNDED') {
      return {
        status: 'REFUNDED',
        txnId: rechargeData.recharge_id || rechargeData.opr_txn_id || null,
        reason: rechargeData.remark || data.message || 'Recharge refunded by provider',
        raw: data,
      };
    }

    return {
      status: 'FAILED',
      txnId: rechargeData.recharge_id || rechargeData.opr_txn_id || null,
      reason: rechargeData.remark || data.message || 'Recharge failed at operator',
      raw: data,
    };
  }

  return {
    status: 'FAILED',
    reason: data?.message || 'Recharge request rejected by provider',
    raw: data,
  };
}

export class BharatPaysProvider implements RechargeProvider {
  readonly id = 'bharatpays' as const;
  readonly name = 'BharatPays';
  readonly tag = 'BBPS';

  isConfigured(): boolean {
    return Boolean(process.env.BHARATPAYS_API_TOKEN);
  }

  supportsService(serviceType: RechargeServiceType): boolean {
    return ['MOBILE', 'DTH', 'ELECTRICITY', 'GAS', 'WATER'].includes(serviceType);
  }

  supportsPlanLookup(): boolean {
    return false;
  }

  getDescriptor(): ProviderDescriptor {
    const configured = this.isConfigured();

    return {
      id: this.id,
      name: this.name,
      tag: this.tag,
      active: configured,
      configured,
      supportsPlanLookup: false,
      supportsServices: ['MOBILE', 'DTH', 'ELECTRICITY', 'GAS', 'WATER'],
      notes: configured
        ? ['Legacy provider kept active for backward compatibility.']
        : ['Set BHARATPAYS_API_TOKEN to enable BharatPays recharges.'],
    };
  }

  async initiateRecharge(
    input: RechargeRequestInput & { rechargeTxnId: string }
  ): Promise<ProviderRechargeResult> {
    const apiToken = process.env.BHARATPAYS_API_TOKEN;

    if (!apiToken) {
      return {
        status: 'FAILED',
        reason: 'BharatPays is not configured. Add BHARATPAYS_API_TOKEN first.',
      };
    }

    const oprCode = BHARATPAYS_OPERATOR_CODES[input.operator.trim().toLowerCase()];
    if (!oprCode) {
      return {
        status: 'FAILED',
        reason: `Unknown BharatPays operator: ${input.operator}.`,
      };
    }

    try {
      const url = new URL('https://bbps.bharatpays.in/api-user/recharge');
      url.searchParams.set('api_token', apiToken);
      url.searchParams.set('opr_code', oprCode);
      url.searchParams.set('amount', input.amount.toString());
      url.searchParams.set('mobile', input.mobileNumber);
      url.searchParams.set('reference_id', input.rechargeTxnId);

      const { data } = await fetchJson<BharatPaysResponse>(
        url,
        {
          method: 'GET',
          headers: { Accept: 'application/json' },
        },
        10000
      );

      return mapApiStatus(data);
    } catch (error: any) {
      return {
        status: 'PENDING',
        reason: error.message || 'BharatPays request failed',
      };
    }
  }

  async checkStatus(txn: RechargeTransactionRecord): Promise<ProviderStatusResult> {
    const apiToken = process.env.BHARATPAYS_API_TOKEN;

    if (!apiToken) {
      return {
        status: 'PENDING',
        reason: 'BharatPays token not configured',
      };
    }

    try {
      const rechargeDate = txn.createdAt.toISOString().split('T')[0];
      const url = new URL('https://bbps.bharatpays.in/api-user/status-check');
      url.searchParams.set('api_token', apiToken);
      url.searchParams.set('reference_id', txn.id);
      url.searchParams.set('recharge_date', rechargeDate);

      const { data } = await fetchJson<BharatPaysResponse>(
        url,
        {
          method: 'GET',
          headers: { Accept: 'application/json' },
        },
        10000
      );

      return mapApiStatus(data);
    } catch (error: any) {
      return {
        status: 'PENDING',
        reason: error.message || 'BharatPays status check failed',
      };
    }
  }

  async handleWebhook(payload: unknown): Promise<ProviderWebhookResult | null> {
    if (!isRecord(payload)) {
      return null;
    }

    const refId = typeof payload.refId === 'string' ? payload.refId : null;
    const txnId = typeof payload.txnId === 'string' ? payload.txnId : null;
    const status = typeof payload.status === 'string' ? payload.status.toLowerCase() : '';

    if (!refId || !status) {
      return null;
    }

    if (status === 'success') {
      return {
        rechargeTxnId: refId,
        status: 'SUCCESS',
        txnId,
        raw: payload,
      };
    }

    if (status === 'failure' || status === 'failed') {
      return {
        rechargeTxnId: refId,
        status: 'FAILED',
        txnId,
        reason: 'Confirmed failed via BharatPays callback',
        raw: payload,
      };
    }

    if (status === 'refunded') {
      return {
        rechargeTxnId: refId,
        status: 'REFUNDED',
        txnId,
        reason: 'Refunded by provider callback',
        raw: payload,
      };
    }

    return {
      rechargeTxnId: refId,
      status: 'PENDING',
      txnId,
      raw: payload,
    };
  }

  async getOperationalStatus(): Promise<{
    configured: boolean;
    healthy: boolean;
    balance?: string | null;
    balances?: { total?: string | null; trade?: string | null; recharge?: string | null };
    message?: string | null;
  }> {
    const apiToken = process.env.BHARATPAYS_API_TOKEN;
    const username = process.env.BHARATPAYS_USERNAME;

    if (!apiToken || !username) {
      return {
        configured: false,
        healthy: false,
        message: 'BHARATPAYS_API_TOKEN or BHARATPAYS_USERNAME is missing.',
      };
    }

    try {
      const url = new URL('https://bbps.bharatpays.in/api-user/balance');
      url.searchParams.set('username', username);
      url.searchParams.set('api_token', apiToken);

      const { response, data } = await fetchJson<BharatPaysResponse>(
        url,
        {
          method: 'GET',
          headers: { Accept: 'application/json' },
        },
        5000
      );

      const balances = resolveBharatPaysBalances(data);
      const normalizedMessage = normalizeOperationalMessage(data?.message);

      if (response.ok && ((data?.status || '').toLowerCase() === 'ok' || data?.success === true)) {
        return {
          configured: true,
          healthy: true,
          balance: balances.total,
          balances,
          message: 'Connected',
        };
      }

      return {
        configured: true,
        healthy: false,
        balance: balances.total,
        balances,
        message: normalizedMessage || `Unexpected HTTP ${response.status}`,
      };
    } catch (error: any) {
      return {
        configured: true,
        healthy: false,
        message: error.message || 'Balance check failed',
      };
    }
  }

  async getPlans(_input: PlanLookupInput): Promise<never> {
    throw new Error('BharatPays does not expose plan lookup through this integration.');
  }
}
