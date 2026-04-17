import {
  PlanLookupInput,
  ProviderDescriptor,
  ProviderRechargeResult,
  ProviderStatusResult,
  ProviderWebhookResult,
  RechargePlan,
  RechargeProvider,
  RechargeRequestInput,
  RechargeServiceType,
  RechargeTransactionRecord,
} from './types';
import { fetchJson, getHeader, isRecord, normalizeLookupKey } from './utils';

type SetuFlowType = 'BILL_FETCH' | 'BILL_VALIDATE' | 'BILL_DIRECT';
type SetuPlanMode = 'NONE' | 'CATALOG' | 'PERSONALIZED';

interface SetuAuthResponse {
  success?: boolean;
  data?: {
    token?: string;
    expiresIn?: number;
  };
}

interface SetuApiResponse<T> {
  success?: boolean;
  traceId?: string;
  data?: T;
  message?: string;
  error?: {
    code?: string;
    message?: string;
  };
}

interface SetuFetchResponseData {
  refId?: string;
  status?: string;
  bills?: Array<{
    amount?: number;
    minAmount?: number;
    maxAmount?: number;
    amountMultiple?: number;
    exactness?: string;
  }>;
  exactness?: string;
  minAmount?: number;
  maxAmount?: number;
  amountMultiple?: number;
  failureReason?: {
    code?: string;
    message?: string;
  };
}

interface SetuPaymentResponseData {
  refId?: string;
  status?: string;
  transactionId?: string;
  billerRefId?: string;
  failureReason?: {
    code?: string;
    message?: string;
  };
  paymentDetails?: {
    paymentRefId?: string;
    amount?: number;
    mode?: string;
    timestamp?: string;
  };
}

interface SetuPlansResponseData {
  plans?: Array<{
    Id?: string;
    id?: string;
    amountInRupees?: string;
    amount?: number;
    billerId?: string;
    categoryType?: string;
    categorySubType?: { subType?: string };
    description?: string;
    additionalInfo?: Array<{ paramName?: string; paramValue?: string }>;
    status?: string;
  }>;
  total?: number;
  nextPage?: string | null;
}

interface SetuCustomerParamConfig {
  name: string;
  source?: 'mobileNumber' | 'circle' | 'operator' | 'planId' | 'amount' | 'custom';
  value?: string;
  required?: boolean;
}

interface SetuBillerConfig {
  billerId: string;
  flowType?: SetuFlowType;
  planMode?: SetuPlanMode;
  planRequirement?: 'MANDATORY' | 'OPTIONAL' | 'NONE';
  customerParams?: SetuCustomerParamConfig[];
}

interface SetuProviderConfig {
  partnerId?: string;
  clientId?: string;
  secret?: string;
  baseUrl?: string;
  authUrl?: string;
  webhookApiKey?: string;
  paymentMode?: string;
  paymentAccountInfo?: string;
  customerConvenienceFeePaise?: number;
  environment?: string;
  agent?: {
    id?: string;
    channel?: string;
    ip?: string;
    mac?: string;
    terminalId?: string;
    imei?: string;
    os?: string;
    app?: string;
    mobile?: string;
    geocode?: string;
    postalCode?: string;
    ifsc?: string;
  };
  billers?: Partial<Record<RechargeServiceType, Record<string, SetuBillerConfig>>>;
}

const DEFAULT_SETU_BASE_URL = 'https://uat.setu.co/api/v2';
const DEFAULT_SETU_AUTH_URL = 'https://uat.setu.co/api/v2/auth/token';

function normalizeStatus(status?: string | null): 'SUCCESS' | 'FAILED' | 'PENDING' | 'REFUNDED' {
  const value = (status || '').trim().toLowerCase();

  if (value === 'success' || value === 'payment_success') {
    return 'SUCCESS';
  }

  if (value === 'failure' || value === 'error' || value === 'payment_failure' || value === 'collection_failure') {
    return 'FAILED';
  }

  if (value === 'payment_refunded' || value === 'refunded') {
    return 'REFUNDED';
  }

  return 'PENDING';
}

function toReason(input: unknown): string | null {
  if (typeof input === 'string') {
    return input;
  }

  if (isRecord(input)) {
    const message = typeof input.message === 'string' ? input.message : null;
    const code = typeof input.code === 'string' ? input.code : null;
    return [code, message].filter(Boolean).join(': ') || null;
  }

  return null;
}

function toPaise(amount: number): number {
  return Math.round(amount * 100);
}

function parseSetuConfig(): SetuProviderConfig {
  let billers: SetuProviderConfig['billers'] = {};

  if (process.env.SETU_BILLER_CONFIG) {
    try {
      const raw = JSON.parse(process.env.SETU_BILLER_CONFIG) as SetuProviderConfig['billers'];
      billers = raw || {};
    } catch (error) {
      console.error('[SetuProvider] Failed to parse SETU_BILLER_CONFIG:', error);
    }
  }

  return {
    partnerId: process.env.SETU_PARTNER_ID,
    clientId: process.env.SETU_CLIENT_ID,
    secret: process.env.SETU_SECRET,
    baseUrl: process.env.SETU_API_BASE_URL || DEFAULT_SETU_BASE_URL,
    authUrl: process.env.SETU_AUTH_URL || DEFAULT_SETU_AUTH_URL,
    webhookApiKey: process.env.SETU_WEBHOOK_API_KEY,
    paymentMode: process.env.SETU_PAYMENT_MODE || 'Wallet',
    paymentAccountInfo: process.env.SETU_PAYMENT_ACCOUNT_INFO,
    customerConvenienceFeePaise: process.env.SETU_CUSTOMER_CONVENIENCE_FEE_PAISE
      ? parseInt(process.env.SETU_CUSTOMER_CONVENIENCE_FEE_PAISE, 10)
      : undefined,
    environment: process.env.SETU_ENVIRONMENT || 'sandbox',
    agent: {
      id: process.env.SETU_AGENT_ID,
      channel: process.env.SETU_AGENT_CHANNEL || 'INT',
      ip: process.env.SETU_AGENT_IP,
      mac: process.env.SETU_AGENT_MAC,
      terminalId: process.env.SETU_AGENT_TERMINAL_ID,
      imei: process.env.SETU_AGENT_IMEI,
      os: process.env.SETU_AGENT_OS,
      app: process.env.SETU_AGENT_APP,
      mobile: process.env.SETU_AGENT_MOBILE,
      geocode: process.env.SETU_AGENT_GEOCODE,
      postalCode: process.env.SETU_AGENT_POSTAL_CODE,
      ifsc: process.env.SETU_AGENT_IFSC,
    },
    billers,
  };
}

export class SetuProvider implements RechargeProvider {
  readonly id = 'setu' as const;
  readonly name = 'Setu';
  readonly tag = 'BBPS';

  private tokenCache: { token: string; expiresAt: number } | null = null;

  private get config(): SetuProviderConfig {
    return parseSetuConfig();
  }

  isConfigured(): boolean {
    const config = this.config;
    return Boolean(
      config.partnerId &&
      config.clientId &&
      config.secret &&
      config.paymentAccountInfo &&
      config.agent?.id
    );
  }

  supportsService(serviceType: RechargeServiceType): boolean {
    const config = this.config;
    return Boolean(config.billers?.[serviceType] && Object.keys(config.billers[serviceType] || {}).length > 0);
  }

  supportsPlanLookup(serviceType: RechargeServiceType): boolean {
    const config = this.config;
    const billers = config.billers?.[serviceType] || {};
    return Object.values(billers).some(
      (biller) => biller.planMode === 'CATALOG' || biller.planRequirement === 'MANDATORY'
    );
  }

  getDescriptor(): ProviderDescriptor {
    const config = this.config;
    const supportedServices = (Object.keys(config.billers || {}) as RechargeServiceType[]).filter((serviceType) =>
      this.supportsService(serviceType)
    );

    const notes: string[] = [];
    if (!config.partnerId) notes.push('SETU_PARTNER_ID is missing.');
    if (!config.clientId || !config.secret) notes.push('SETU OAuth credentials are missing.');
    if (!config.paymentAccountInfo) notes.push('SETU_PAYMENT_ACCOUNT_INFO is missing.');
    if (!config.agent?.id) notes.push('SETU_AGENT_ID is missing.');
    if (supportedServices.length === 0) notes.push('No billers are configured in SETU_BILLER_CONFIG.');

    return {
      id: this.id,
      name: this.name,
      tag: this.tag,
      active: this.isConfigured() && supportedServices.length > 0,
      configured: this.isConfigured(),
      supportsPlanLookup: supportedServices.some((serviceType) => this.supportsPlanLookup(serviceType)),
      supportsServices: supportedServices,
      notes,
    };
  }

  async getPlans(input: PlanLookupInput): Promise<RechargePlan[]> {
    const config = this.resolveBillerConfig(input.serviceType, input.operator);

    if (config.planMode !== 'CATALOG') {
      throw new Error('This Setu biller does not expose catalog plans. Use manual validation/payment flow instead.');
    }

    const results: RechargePlan[] = [];
    let after: string | undefined;
    let remaining = 5;

    while (remaining > 0) {
      const query = new URLSearchParams({
        billerIds: config.billerId,
        limit: '250',
      });

      if (after) {
        query.set('after', after);
      }

      const response = await this.request<SetuPlansResponseData>(`/bbps/billers/plans?${query.toString()}`, {
        method: 'GET',
      });

      const plans = response.data?.plans || [];
      for (const plan of plans) {
        const planId = plan.Id || plan.id;
        if (!planId) {
          continue;
        }

        results.push({
          id: planId,
          amount: plan.amountInRupees || (typeof plan.amount === 'number' ? (plan.amount / 100).toFixed(2) : '0.00'),
          description: plan.description || planId,
          categoryType: plan.categoryType || null,
          categorySubType: plan.categorySubType?.subType || null,
          billerId: plan.billerId || config.billerId,
          additionalInfo: (plan.additionalInfo || []).map((item) => ({
            label: item.paramName || 'Detail',
            value: item.paramValue || '',
          })),
        });
      }

      const nextPage = response.data?.nextPage;
      if (!nextPage) {
        break;
      }

      const nextUrl = new URL(nextPage, this.config.baseUrl);
      after = nextUrl.searchParams.get('after') || undefined;
      if (!after) {
        break;
      }

      remaining -= 1;
    }

    return results;
  }

  async initiateRecharge(
    input: RechargeRequestInput & { rechargeTxnId: string }
  ): Promise<ProviderRechargeResult> {
    const billerConfig = this.resolveBillerConfig(input.serviceType, input.operator);

    if (this.requiresPlan(billerConfig) && !input.planId) {
      return {
        status: 'FAILED',
        reason: `Setu plan selection is required for ${input.operator} ${input.serviceType}.`,
      };
    }

    if (!this.isConfigured()) {
      return {
        status: 'FAILED',
        reason: 'Setu is not fully configured. Check OAuth, agent, and payment account settings.',
      };
    }

    try {
      if (billerConfig.flowType === 'BILL_DIRECT') {
        return await this.processDirectPayment(input, billerConfig);
      }

      return await this.processValidatedPayment(input, billerConfig);
    } catch (error: any) {
      return {
        status: 'PENDING',
        reason: error.message || 'Setu recharge request failed',
      };
    }
  }

  async checkStatus(txn: RechargeTransactionRecord): Promise<ProviderStatusResult> {
    try {
      const providerRefId = this.extractProviderRefId(txn);
      if (!providerRefId) {
        return {
          status: 'PENDING',
          reason: 'No Setu refId stored for this recharge.',
        };
      }

      const response = await this.request<SetuPaymentResponseData>('/bbps/bills/payment/response', {
        method: 'POST',
        body: JSON.stringify({ refId: providerRefId }),
      });

      return this.mapPaymentStatus(response.data, response);
    } catch (error: any) {
      return {
        status: 'PENDING',
        reason: error.message || 'Setu payment status check failed',
      };
    }
  }

  async handleWebhook(
    payload: unknown,
    headers: Record<string, string | string[] | undefined>
  ): Promise<ProviderWebhookResult | null> {
    const configuredKey = this.config.webhookApiKey;
    if (configuredKey) {
      const receivedKey = getHeader(headers, 'X-BILL-WEBHOOK-API-KEY');
      if (!receivedKey || receivedKey !== configuredKey) {
        throw new Error('Invalid Setu webhook API key');
      }
    }

    if (!isRecord(payload)) {
      return null;
    }

    const event = typeof payload.event === 'string' ? payload.event : null;
    const data = isRecord(payload.data) ? payload.data : payload;
    const paymentDetails = isRecord(data.paymentDetails) ? data.paymentDetails : null;
    const localTxnId =
      (paymentDetails && typeof paymentDetails.paymentRefId === 'string' ? paymentDetails.paymentRefId : null) ||
      (typeof payload.customerId === 'string' ? payload.customerId : null);

    const statusFromEvent =
      event === 'bill_payment_success'
        ? 'SUCCESS'
        : event === 'bill_payment_failure' || event === 'bill_collection_failure'
          ? 'FAILED'
          : event === 'bill_payment_refunded'
            ? 'REFUNDED'
            : undefined;

    const status = statusFromEvent || normalizeStatus(typeof data.status === 'string' ? data.status : undefined);
    const txnId =
      (typeof data.transactionId === 'string' ? data.transactionId : null) ||
      (typeof payload.txnId === 'string' ? payload.txnId : null) ||
      (typeof payload.orderId === 'string' ? payload.orderId : null);

    if (!localTxnId) {
      return null;
    }

    return {
      rechargeTxnId: localTxnId,
      status,
      txnId,
      reason: toReason(data.failureReason) || (typeof payload.status === 'string' ? payload.status : null),
      raw: payload,
    };
  }

  async getOperationalStatus(): Promise<{
    configured: boolean;
    healthy: boolean;
    balance?: string | null;
    message?: string | null;
  }> {
    const configured = this.isConfigured();
    if (!configured) {
      return {
        configured: false,
        healthy: false,
        message: 'Missing Setu credentials or agent/payment configuration.',
      };
    }

    try {
      await this.getAccessToken();
      return {
        configured: true,
        healthy: true,
        message: `${this.config.environment || 'sandbox'} credentials look valid.`,
      };
    } catch (error: any) {
      return {
        configured: true,
        healthy: false,
        message: error.message || 'Unable to mint Setu OAuth token.',
      };
    }
  }

  private async processValidatedPayment(
    input: RechargeRequestInput & { rechargeTxnId: string },
    billerConfig: SetuBillerConfig
  ): Promise<ProviderRechargeResult> {
    const fetchRequest = {
      agent: this.buildAgent(),
      biller: { id: billerConfig.billerId },
      customer: {
        mobile: input.mobileNumber,
        customerParams: this.buildCustomerParams(input, billerConfig),
      },
    };

    const fetchResponse = await this.request<SetuApiResponse<{ refId?: string }>['data']>('/bbps/bills/fetch/request', {
      method: 'POST',
      body: JSON.stringify(fetchRequest),
    });

    const fetchRefId = fetchResponse.data?.refId;
    if (!fetchRefId) {
      throw new Error('Setu fetch request did not return a refId.');
    }

    const fetchStatus = await this.pollFetchStatus(fetchRefId);
    if (fetchStatus.status === 'FAILED') {
      return {
        status: 'FAILED',
        reason: fetchStatus.reason || 'Setu validation failed.',
        txnId: fetchRefId,
        raw: {
          providerRefId: fetchRefId,
          fetch: fetchStatus.raw,
        },
      };
    }

    if (fetchStatus.status === 'PENDING') {
      return {
        status: 'PENDING',
        txnId: fetchRefId,
        raw: {
          providerRefId: fetchRefId,
          fetch: fetchStatus.raw,
        },
      };
    }

    const paymentRequest = {
      refId: fetchRefId,
      paymentDetails: this.buildPaymentDetails(input),
      remitter: this.buildRemitter(input),
    };

    const paymentResponse = await this.request<SetuApiResponse<{ refId?: string }>['data']>('/bbps/bills/payment/request', {
      method: 'POST',
      body: JSON.stringify(paymentRequest),
    });

    const paymentRefId = paymentResponse.data?.refId || fetchRefId;
    const paymentStatus = await this.pollPaymentStatus(paymentRefId);

    return {
      status: paymentStatus.status,
      txnId: paymentStatus.txnId || paymentRefId,
      reason: paymentStatus.reason,
      raw: {
        providerRefId: paymentRefId,
        fetchRefId,
        fetch: fetchStatus.raw,
        payment: paymentStatus.raw,
      },
    };
  }

  private async processDirectPayment(
    input: RechargeRequestInput & { rechargeTxnId: string },
    billerConfig: SetuBillerConfig
  ): Promise<ProviderRechargeResult> {
    const requestBody = {
      agent: this.buildAgent(),
      biller: { id: billerConfig.billerId },
      customer: {
        mobile: input.mobileNumber,
        customerParams: this.buildCustomerParams(input, billerConfig),
      },
      paymentDetails: this.buildPaymentDetails(input),
      remitter: this.buildRemitter(input),
    };

    const paymentResponse = await this.request<SetuApiResponse<{ refId?: string }>['data']>('/bbps/bills/payment/request', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    const paymentRefId = paymentResponse.data?.refId;
    if (!paymentRefId) {
      throw new Error('Setu direct payment request did not return a refId.');
    }

    const paymentStatus = await this.pollPaymentStatus(paymentRefId);

    return {
      status: paymentStatus.status,
      txnId: paymentStatus.txnId || paymentRefId,
      reason: paymentStatus.reason,
      raw: {
        providerRefId: paymentRefId,
        payment: paymentStatus.raw,
      },
    };
  }

  private async pollFetchStatus(refId: string): Promise<ProviderStatusResult> {
    return this.pollUntilSettled<SetuFetchResponseData>(
      '/bbps/bills/fetch/response',
      refId,
      (data, raw) => {
        const status = normalizeStatus(data?.status);
        return {
          status,
          txnId: refId,
          reason: toReason(data?.failureReason),
          raw,
        };
      }
    );
  }

  private async pollPaymentStatus(refId: string): Promise<ProviderStatusResult> {
    return this.pollUntilSettled<SetuPaymentResponseData>(
      '/bbps/bills/payment/response',
      refId,
      (data, raw) => this.mapPaymentStatus(data, raw)
    );
  }

  private async pollUntilSettled<T>(
    path: string,
    refId: string,
    mapper: (data: T | undefined, raw: unknown) => ProviderStatusResult
  ): Promise<ProviderStatusResult> {
    const deadline = Date.now() + 15000;
    let lastRaw: unknown = null;

    while (Date.now() < deadline) {
      const response = await this.request<T>(path, {
        method: 'POST',
        body: JSON.stringify({ refId }),
      });

      lastRaw = response;
      const mapped = mapper(response.data, response);
      if (mapped.status !== 'PENDING') {
        return mapped;
      }

      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    return {
      status: 'PENDING',
      txnId: refId,
      raw: lastRaw || { refId },
    };
  }

  private mapPaymentStatus(data: SetuPaymentResponseData | undefined, raw: unknown): ProviderStatusResult {
    const status = normalizeStatus(data?.status);
    return {
      status,
      txnId: data?.transactionId || data?.refId || null,
      reason: toReason(data?.failureReason),
      raw,
    };
  }

  private buildAgent(): Record<string, string> {
    const agent = this.config.agent || {};
    if (!agent.id) {
      throw new Error('SETU_AGENT_ID is required.');
    }

    const channel = agent.channel || 'INT';
    const payload: Record<string, string> = {
      id: agent.id,
      channel,
    };

    for (const [key, value] of Object.entries(agent)) {
      if (key === 'id' || key === 'channel' || !value) {
        continue;
      }

      payload[key] = value;
    }

    return payload;
  }

  private buildRemitter(input: RechargeRequestInput): Record<string, string> {
    return {
      name: input.retailerName || 'Retailer',
      ...(input.retailerEmail ? { email: input.retailerEmail } : {}),
    };
  }

  private buildPaymentDetails(input: RechargeRequestInput & { rechargeTxnId: string }): Record<string, string | number> {
    const paymentAccountInfo = this.config.paymentAccountInfo;
    if (!paymentAccountInfo) {
      throw new Error('SETU_PAYMENT_ACCOUNT_INFO is required for Setu payments.');
    }

    return {
      mode: this.config.paymentMode || 'Wallet',
      amount: toPaise(input.amount),
      paymentRefId: input.rechargeTxnId,
      timestamp: new Date().toISOString(),
      accountInfo: paymentAccountInfo,
      ...(typeof this.config.customerConvenienceFeePaise === 'number'
        ? { custConvFee: this.config.customerConvenienceFeePaise }
        : {}),
    };
  }

  private buildCustomerParams(
    input: RechargeRequestInput,
    billerConfig: SetuBillerConfig
  ): Array<{ name: string; value: string }> {
    const params = billerConfig.customerParams || [];
    const resolved: Array<{ name: string; value: string }> = [];

    for (const param of params) {
      let value = param.value;

      if (!value && param.source) {
        if (param.source === 'mobileNumber') value = input.mobileNumber;
        if (param.source === 'circle') value = input.circle || '';
        if (param.source === 'operator') value = input.operator;
        if (param.source === 'planId') value = input.planId || '';
        if (param.source === 'amount') value = input.amount.toFixed(2);
      }

      if (!value && param.required !== false) {
        throw new Error(`Setu customer param "${param.name}" is required for ${input.operator} ${input.serviceType}.`);
      }

      if (value) {
        resolved.push({
          name: param.name,
          value,
        });
      }
    }

    return resolved;
  }

  private requiresPlan(billerConfig: SetuBillerConfig): boolean {
    return (
      billerConfig.planRequirement === 'MANDATORY' ||
      (billerConfig.customerParams || []).some(
        (param) => param.source === 'planId' && param.required !== false
      )
    );
  }

  private resolveBillerConfig(
    serviceType: RechargeServiceType,
    operator: string
  ): SetuBillerConfig {
    const serviceConfig = this.config.billers?.[serviceType];
    if (!serviceConfig) {
      throw new Error(`Setu is not configured for ${serviceType}.`);
    }

    const lookupKey = normalizeLookupKey(operator);
    const exact = serviceConfig[lookupKey];
    const fallback = serviceConfig.default;

    const config = exact || fallback;
    if (!config) {
      throw new Error(`Setu biller mapping not found for ${serviceType} / ${operator}.`);
    }

    return {
      flowType: 'BILL_FETCH',
      planMode: 'NONE',
      planRequirement: 'NONE',
      customerParams: [],
      ...config,
    };
  }

  private async getAccessToken(): Promise<string> {
    if (this.tokenCache && this.tokenCache.expiresAt > Date.now() + 30_000) {
      return this.tokenCache.token;
    }

    const config = this.config;
    if (!config.clientId || !config.secret || !config.authUrl) {
      throw new Error('SETU_CLIENT_ID, SETU_SECRET, or SETU_AUTH_URL is missing.');
    }

    const { response, data } = await fetchJson<SetuAuthResponse>(
      config.authUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientID: config.clientId,
          secret: config.secret,
        }),
      },
      10000
    );

    const token = data?.data?.token;
    const expiresIn = data?.data?.expiresIn || 1800;

    if (!response.ok || !token) {
      throw new Error('Setu auth token request failed.');
    }

    this.tokenCache = {
      token,
      expiresAt: Date.now() + expiresIn * 1000,
    };

    return token;
  }

  private async request<T>(path: string, init: RequestInit): Promise<SetuApiResponse<T>> {
    const config = this.config;
    if (!config.baseUrl || !config.partnerId) {
      throw new Error('SETU_API_BASE_URL or SETU_PARTNER_ID is missing.');
    }

    const token = await this.getAccessToken();
    const url = new URL(path.replace(/^\//, ''), `${config.baseUrl.replace(/\/+$/, '')}/`);

    const { response, data } = await fetchJson<SetuApiResponse<T>>(
      url,
      {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-PARTNER-ID': config.partnerId,
          ...(init.headers || {}),
        },
      },
      15000
    );

    if (!response.ok || data?.success === false) {
      throw new Error(
        data?.error?.message ||
        data?.message ||
        `Setu request failed with HTTP ${response.status}.`
      );
    }

    return data;
  }

  private extractProviderRefId(txn: RechargeTransactionRecord): string | null {
    if (isRecord(txn.apiResponseRaw) && typeof txn.apiResponseRaw.providerRefId === 'string') {
      return txn.apiResponseRaw.providerRefId;
    }

    if (txn.apiTxnId) {
      return txn.apiTxnId;
    }

    return null;
  }
}
