CREATE TYPE "public"."commission_status" AS ENUM('CREDITED', 'REVERSED');--> statement-breakpoint
CREATE TYPE "public"."commission_type" AS ENUM('PERCENTAGE', 'FLAT');--> statement-breakpoint
CREATE TYPE "public"."doc_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."doc_type" AS ENUM('AADHAAR_FRONT', 'AADHAAR_BACK', 'PAN', 'GST', 'SELFIE', 'CANCELLED_CHEQUE');--> statement-breakpoint
CREATE TYPE "public"."kyc_status" AS ENUM('PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."recharge_status" AS ENUM('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');--> statement-breakpoint
CREATE TYPE "public"."service_type" AS ENUM('MOBILE', 'DTH', 'ELECTRICITY', 'GAS', 'WATER');--> statement-breakpoint
CREATE TYPE "public"."topup_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."txn_type" AS ENUM('CREDIT', 'DEBIT');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('SUPER_ADMIN', 'STATE_HEAD', 'MASTER_DISTRIBUTOR', 'DISTRIBUTOR', 'RETAILER');--> statement-breakpoint
CREATE TYPE "public"."wallet_reason" AS ENUM('RECHARGE', 'COMMISSION', 'TOPUP', 'WITHDRAWAL', 'REVERSAL', 'MANUAL_ADJUSTMENT');--> statement-breakpoint
CREATE TYPE "public"."withdrawal_status" AS ENUM('PENDING', 'PROCESSING', 'PAID', 'REJECTED');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "commission_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_type" varchar(50) NOT NULL,
	"role" "user_role" NOT NULL,
	"commission_type" "commission_type" NOT NULL,
	"commission_value" numeric(8, 4) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"set_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "commission_distributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recharge_txn_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "user_role" NOT NULL,
	"commission_type" "commission_type" NOT NULL,
	"commission_value" numeric(8, 4) NOT NULL,
	"amount_credited" numeric(10, 2) NOT NULL,
	"status" "commission_status" DEFAULT 'CREDITED' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kyc_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"doc_type" "doc_type" NOT NULL,
	"file_url" varchar(500) NOT NULL,
	"status" "doc_status" DEFAULT 'PENDING' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recharge_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"retailer_id" uuid NOT NULL,
	"mobile_number" varchar(20) NOT NULL,
	"operator" varchar(100) NOT NULL,
	"service_type" "service_type" NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"api_provider" varchar(100),
	"api_txn_id" varchar(255),
	"api_response_raw" jsonb,
	"status" "recharge_status" DEFAULT 'PENDING' NOT NULL,
	"failure_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"service_type" "service_type" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"api_endpoint" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "topup_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requested_by" uuid NOT NULL,
	"credited_by" uuid,
	"amount" numeric(10, 2) NOT NULL,
	"utr_number" varchar(100),
	"status" "topup_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(20) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"role" "user_role" NOT NULL,
	"parent_id" uuid,
	"wallet_balance" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"kyc_status" "kyc_status" DEFAULT 'PENDING' NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"requires_password_change" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wallet_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "txn_type" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"closing_balance" numeric(12, 2) NOT NULL,
	"reason" "wallet_reason" NOT NULL,
	"ref_id" varchar(255),
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "withdrawal_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"amount_requested" numeric(10, 2) NOT NULL,
	"tds_deducted" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"amount_payable" numeric(10, 2) NOT NULL,
	"bank_account_number" varchar(30) NOT NULL,
	"ifsc_code" varchar(20) NOT NULL,
	"account_holder_name" varchar(255) NOT NULL,
	"status" "withdrawal_status" DEFAULT 'PENDING' NOT NULL,
	"utr_number" varchar(100),
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp,
	"processed_by" uuid,
	"rejection_reason" text
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "commission_configs" ADD CONSTRAINT "commission_configs_set_by_users_id_fk" FOREIGN KEY ("set_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "commission_distributions" ADD CONSTRAINT "commission_distributions_recharge_txn_id_recharge_transactions_id_fk" FOREIGN KEY ("recharge_txn_id") REFERENCES "public"."recharge_transactions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "commission_distributions" ADD CONSTRAINT "commission_distributions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kyc_documents" ADD CONSTRAINT "kyc_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kyc_documents" ADD CONSTRAINT "kyc_documents_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recharge_transactions" ADD CONSTRAINT "recharge_transactions_retailer_id_users_id_fk" FOREIGN KEY ("retailer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "topup_requests" ADD CONSTRAINT "topup_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "topup_requests" ADD CONSTRAINT "topup_requests_credited_by_users_id_fk" FOREIGN KEY ("credited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_processed_by_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
