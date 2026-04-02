import {
  pgTable,
  uuid,
  varchar,
  text,
  decimal,
  boolean,
  timestamp,
  pgEnum,
  jsonb,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ===================== ENUMS =====================

export const userRoleEnum = pgEnum('user_role', [
  'SUPER_ADMIN',
  'STATE_HEAD',
  'MASTER_DISTRIBUTOR',
  'DISTRIBUTOR',
  'RETAILER',
]);

export const kycStatusEnum = pgEnum('kyc_status', [
  'PENDING',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
]);

export const txnTypeEnum = pgEnum('txn_type', ['CREDIT', 'DEBIT']);

export const walletReasonEnum = pgEnum('wallet_reason', [
  'RECHARGE',
  'COMMISSION',
  'TOPUP',
  'WITHDRAWAL',
  'REVERSAL',
  'MANUAL_ADJUSTMENT',
]);

export const serviceTypeEnum = pgEnum('service_type', [
  'MOBILE',
  'DTH',
  'ELECTRICITY',
  'GAS',
  'WATER',
]);

export const rechargeStatusEnum = pgEnum('recharge_status', [
  'PENDING',
  'SUCCESS',
  'FAILED',
  'REFUNDED',
]);

export const commissionTypeEnum = pgEnum('commission_type', [
  'PERCENTAGE',
  'FLAT',
]);

export const commissionStatusEnum = pgEnum('commission_status', [
  'CREDITED',
  'REVERSED',
]);

export const withdrawalStatusEnum = pgEnum('withdrawal_status', [
  'PENDING',
  'PROCESSING',
  'PAID',
  'REJECTED',
]);

export const docTypeEnum = pgEnum('doc_type', [
  'AADHAAR_FRONT',
  'AADHAAR_BACK',
  'PAN',
  'GST',
  'SELFIE',
  'CANCELLED_CHEQUE',
]);

export const docStatusEnum = pgEnum('doc_status', [
  'PENDING',
  'APPROVED',
  'REJECTED',
]);

export const topupStatusEnum = pgEnum('topup_status', [
  'PENDING',
  'APPROVED',
  'REJECTED',
]);

// ===================== TABLES =====================

// Users table
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  phone: varchar('phone', { length: 20 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: userRoleEnum('role').notNull(),
  parentId: uuid('parent_id'),
  walletBalance: decimal('wallet_balance', { precision: 12, scale: 2 }).notNull().default('0.00'),
  kycStatus: kycStatusEnum('kyc_status').notNull().default('PENDING'),
  isActive: boolean('is_active').notNull().default(false),
  requiresPasswordChange: boolean('requires_password_change').notNull().default(true),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Wallet Transactions table
export const walletTransactions = pgTable('wallet_transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  type: txnTypeEnum('type').notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  closingBalance: decimal('closing_balance', { precision: 12, scale: 2 }).notNull(),
  reason: walletReasonEnum('reason').notNull(),
  refId: varchar('ref_id', { length: 255 }),
  note: text('note'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Recharge Transactions table
export const rechargeTransactions = pgTable('recharge_transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  retailerId: uuid('retailer_id').notNull().references(() => users.id),
  mobileNumber: varchar('mobile_number', { length: 20 }).notNull(),
  operator: varchar('operator', { length: 100 }).notNull(),
  serviceType: serviceTypeEnum('service_type').notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  apiProvider: varchar('api_provider', { length: 100 }),
  apiTxnId: varchar('api_txn_id', { length: 255 }),
  apiResponseRaw: jsonb('api_response_raw'),
  status: rechargeStatusEnum('status').notNull().default('PENDING'),
  failureReason: text('failure_reason'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Commission Configs table
export const commissionConfigs = pgTable('commission_configs', {
  id: uuid('id').defaultRandom().primaryKey(),
  serviceType: varchar('service_type', { length: 50 }).notNull(),
  role: userRoleEnum('role').notNull(),
  commissionType: commissionTypeEnum('commission_type').notNull(),
  commissionValue: decimal('commission_value', { precision: 8, scale: 4 }).notNull(),
  isActive: boolean('is_active').notNull().default(true),
  setBy: uuid('set_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Commission Distributions table
export const commissionDistributions = pgTable('commission_distributions', {
  id: uuid('id').defaultRandom().primaryKey(),
  rechargeTxnId: uuid('recharge_txn_id').notNull().references(() => rechargeTransactions.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  role: userRoleEnum('role').notNull(),
  commissionType: commissionTypeEnum('commission_type').notNull(),
  commissionValue: decimal('commission_value', { precision: 8, scale: 4 }).notNull(),
  amountCredited: decimal('amount_credited', { precision: 10, scale: 2 }).notNull(),
  status: commissionStatusEnum('status').notNull().default('CREDITED'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Withdrawal Requests table
export const withdrawalRequests = pgTable('withdrawal_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  amountRequested: decimal('amount_requested', { precision: 10, scale: 2 }).notNull(),
  tdsDeducted: decimal('tds_deducted', { precision: 10, scale: 2 }).notNull().default('0.00'),
  amountPayable: decimal('amount_payable', { precision: 10, scale: 2 }).notNull(),
  bankAccountNumber: varchar('bank_account_number', { length: 30 }).notNull(),
  ifscCode: varchar('ifsc_code', { length: 20 }).notNull(),
  accountHolderName: varchar('account_holder_name', { length: 255 }).notNull(),
  status: withdrawalStatusEnum('status').notNull().default('PENDING'),
  utrNumber: varchar('utr_number', { length: 100 }),
  requestedAt: timestamp('requested_at').notNull().defaultNow(),
  processedAt: timestamp('processed_at'),
  processedBy: uuid('processed_by').references(() => users.id),
  rejectionReason: text('rejection_reason'),
});

// KYC Documents table
export const kycDocuments = pgTable('kyc_documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  docType: docTypeEnum('doc_type').notNull(),
  fileUrl: varchar('file_url', { length: 500 }).notNull(),
  status: docStatusEnum('status').notNull().default('PENDING'),
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at'),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Topup Requests table
export const topupRequests = pgTable('topup_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  requestedBy: uuid('requested_by').notNull().references(() => users.id),
  creditedBy: uuid('credited_by').references(() => users.id),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  utrNumber: varchar('utr_number', { length: 100 }),
  status: topupStatusEnum('status').notNull().default('PENDING'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  processedAt: timestamp('processed_at'),
});

// Services table
export const services = pgTable('services', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  serviceType: serviceTypeEnum('service_type').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  apiEndpoint: varchar('api_endpoint', { length: 500 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ===================== RELATIONS =====================

export const usersRelations = relations(users, ({ one, many }) => ({
  parent: one(users, {
    fields: [users.parentId],
    references: [users.id],
    relationName: 'parentChild',
  }),
  children: many(users, { relationName: 'parentChild' }),
  createdByUser: one(users, {
    fields: [users.createdBy],
    references: [users.id],
    relationName: 'creatorCreated',
  }),
  walletTransactions: many(walletTransactions),
  rechargeTransactions: many(rechargeTransactions),
  commissionDistributions: many(commissionDistributions),
  withdrawalRequests: many(withdrawalRequests),
  kycDocuments: many(kycDocuments),
  topupRequestsMade: many(topupRequests, { relationName: 'requestedBy' }),
  topupRequestsCredited: many(topupRequests, { relationName: 'creditedBy' }),
}));

export const walletTransactionsRelations = relations(walletTransactions, ({ one }) => ({
  user: one(users, {
    fields: [walletTransactions.userId],
    references: [users.id],
  }),
}));

export const rechargeTransactionsRelations = relations(rechargeTransactions, ({ one, many }) => ({
  retailer: one(users, {
    fields: [rechargeTransactions.retailerId],
    references: [users.id],
  }),
  commissionDistributions: many(commissionDistributions),
}));

export const commissionConfigsRelations = relations(commissionConfigs, ({ one }) => ({
  setByUser: one(users, {
    fields: [commissionConfigs.setBy],
    references: [users.id],
  }),
}));

export const commissionDistributionsRelations = relations(commissionDistributions, ({ one }) => ({
  rechargeTransaction: one(rechargeTransactions, {
    fields: [commissionDistributions.rechargeTxnId],
    references: [rechargeTransactions.id],
  }),
  user: one(users, {
    fields: [commissionDistributions.userId],
    references: [users.id],
  }),
}));

export const withdrawalRequestsRelations = relations(withdrawalRequests, ({ one }) => ({
  user: one(users, {
    fields: [withdrawalRequests.userId],
    references: [users.id],
  }),
  processedByUser: one(users, {
    fields: [withdrawalRequests.processedBy],
    references: [users.id],
  }),
}));

export const kycDocumentsRelations = relations(kycDocuments, ({ one }) => ({
  user: one(users, {
    fields: [kycDocuments.userId],
    references: [users.id],
  }),
  reviewedByUser: one(users, {
    fields: [kycDocuments.reviewedBy],
    references: [users.id],
  }),
}));

export const topupRequestsRelations = relations(topupRequests, ({ one }) => ({
  requestedByUser: one(users, {
    fields: [topupRequests.requestedBy],
    references: [users.id],
    relationName: 'requestedBy',
  }),
  creditedByUser: one(users, {
    fields: [topupRequests.creditedBy],
    references: [users.id],
    relationName: 'creditedBy',
  }),
}));
