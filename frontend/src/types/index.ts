// ===================== USER TYPES =====================
export type UserRole = 'SUPER_ADMIN' | 'STATE_HEAD' | 'MASTER_DISTRIBUTOR' | 'DISTRIBUTOR' | 'RETAILER';
export type TxnType = 'CREDIT' | 'DEBIT';
export type WalletReason = 'RECHARGE' | 'COMMISSION' | 'TOPUP' | 'WITHDRAWAL' | 'REVERSAL' | 'MANUAL_ADJUSTMENT';
export type ServiceType = 'MOBILE' | 'DTH' | 'ELECTRICITY' | 'GAS' | 'WATER';
export type RechargeStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';
export type WithdrawalStatus = 'PENDING' | 'PROCESSING' | 'PAID' | 'REJECTED';
export type CommissionType = 'PERCENTAGE' | 'FLAT';
export type TopupStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  parentId: string | null;
  walletBalance: string;
  commissionWalletBalance?: string; // Read-only lifetime earnings counter
  isActive: boolean;
  requiresPasswordChange: boolean;
  upiId?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
  redirectTo: string;
}

export interface WalletTransaction {
  id: string;
  userId: string;
  type: TxnType;
  amount: string;
  closingBalance: string;
  reason: WalletReason;
  refId: string | null;
  note: string | null;
  createdAt: string;
}

export interface RechargeTransaction {
  id: string;
  retailerId: string;
  mobileNumber: string;
  operator: string;
  serviceType: ServiceType;
  amount: string;
  apiProvider: string | null;
  apiTxnId: string | null;
  status: RechargeStatus;
  failureReason: string | null;
  createdAt: string;
}

export interface CommissionDistribution {
  id: string;
  rechargeTxnId: string;
  userId: string;
  role: UserRole;
  commissionType: CommissionType;
  commissionValue: string;
  amountCredited: string;
  status: 'CREDITED' | 'REVERSED';
  createdAt: string;
}

export interface CommissionConfig {
  id: string;
  serviceType: string;
  role: UserRole;
  commissionType: CommissionType;
  commissionValue: string;
  isActive: boolean;
  createdAt: string;
}

export interface WithdrawalRequest {
  id: string;
  userId: string;
  amountRequested: string;
  tdsDeducted: string;
  amountPayable: string;
  bankAccountNumber: string;
  ifscCode: string;
  accountHolderName: string;
  status: WithdrawalStatus;
  utrNumber: string | null;
  requestedAt: string;
  processedAt: string | null;
  rejectionReason: string | null;
}

export interface TopupRequest {
  id: string;
  requestedBy: string;
  creditedBy: string | null;
  amount: string;
  utrNumber: string;
  status: TopupStatus;
  createdAt: string;
}

export interface Service {
  id: string;
  name: string;
  serviceType: ServiceType;
  isActive: boolean;
  apiEndpoint: string | null;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface DashboardStats {
  walletBalance?: string;
  totalUsers?: number;
  activeUsers?: number;
  todayRecharges?: number;
  todayRechargeAmount?: string;
  todayCommissionsPaid?: string;
  todayCommission?: string;
  pendingWithdrawals?: number;
  childrenCount?: number;
}

// Role display helpers
export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  STATE_HEAD: 'State Head',
  MASTER_DISTRIBUTOR: 'Master Distributor',
  DISTRIBUTOR: 'Distributor',
  RETAILER: 'Retailer',
};

export const ROLE_COLORS: Record<UserRole, string> = {
  SUPER_ADMIN: '#2D5BE3',
  STATE_HEAD: '#6C4FD4',
  MASTER_DISTRIBUTOR: '#00CEFF',
  DISTRIBUTOR: '#00B894',
  RETAILER: '#FFA502',
};

export const ROLE_PATHS: Record<UserRole, string> = {
  SUPER_ADMIN: '/admin',
  STATE_HEAD: '/state-head',
  MASTER_DISTRIBUTOR: '/master',
  DISTRIBUTOR: '/distributor',
  RETAILER: '/retailer',
};
