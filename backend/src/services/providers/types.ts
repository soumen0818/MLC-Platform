import { rechargeTransactions } from '../../db/schema';

export type RechargeProviderId = 'bharatpays' | 'setu';
export type RechargeServiceType = 'MOBILE' | 'DTH' | 'ELECTRICITY' | 'GAS' | 'WATER';
export type RechargeResolutionStatus = 'SUCCESS' | 'FAILED' | 'PENDING' | 'REFUNDED';

export interface RechargeRequestInput {
  retailerId: string;
  retailerName?: string | null;
  retailerEmail?: string | null;
  retailerPhone?: string | null;
  mobileNumber: string;
  operator: string;
  serviceType: RechargeServiceType;
  amount: number;
  provider: RechargeProviderId;
  circle?: string | null;
  planId?: string | null;
}

export interface ProviderRechargeResult {
  status: RechargeResolutionStatus;
  txnId?: string | null;
  reason?: string | null;
  raw?: unknown;
}

export interface ProviderStatusResult {
  status: RechargeResolutionStatus;
  txnId?: string | null;
  reason?: string | null;
  raw?: unknown;
}

export interface ProviderWebhookResult {
  rechargeTxnId?: string | null;
  status?: RechargeResolutionStatus;
  txnId?: string | null;
  reason?: string | null;
  raw?: unknown;
}

export interface RechargePlan {
  id: string;
  amount: string;
  description: string;
  categoryType?: string | null;
  categorySubType?: string | null;
  billerId?: string | null;
  additionalInfo?: Array<{ label: string; value: string }>;
}

export interface PlanLookupInput {
  serviceType: RechargeServiceType;
  operator: string;
  mobileNumber?: string | null;
  circle?: string | null;
}

export interface ProviderDescriptor {
  id: RechargeProviderId;
  name: string;
  tag: string;
  active: boolean;
  supportsPlanLookup: boolean;
  supportsServices: RechargeServiceType[];
  configured: boolean;
  notes?: string[];
}

export interface ProviderBalanceBreakdown {
  total?: string | null;
  trade?: string | null;
  recharge?: string | null;
}

export type RechargeTransactionRecord = typeof rechargeTransactions.$inferSelect;

export interface RechargeProvider {
  readonly id: RechargeProviderId;
  readonly name: string;
  readonly tag: string;
  isConfigured(): boolean;
  supportsService(serviceType: RechargeServiceType): boolean;
  supportsPlanLookup(serviceType: RechargeServiceType): boolean;
  initiateRecharge(input: RechargeRequestInput & { rechargeTxnId: string }): Promise<ProviderRechargeResult>;
  checkStatus(txn: RechargeTransactionRecord): Promise<ProviderStatusResult>;
  handleWebhook(payload: unknown, headers: Record<string, string | string[] | undefined>): Promise<ProviderWebhookResult | null>;
  getDescriptor(): ProviderDescriptor;
  getPlans?(input: PlanLookupInput): Promise<RechargePlan[]>;
  getOperationalStatus?(): Promise<{
    configured: boolean;
    healthy: boolean;
    balance?: string | null;
    balances?: ProviderBalanceBreakdown;
    message?: string | null;
  }>;
}
