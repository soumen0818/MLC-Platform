-- Multi-wallet migration
-- 1. Create wallet_type enum (if not exists)
DO $$ BEGIN
  CREATE TYPE "wallet_type" AS ENUM ('MAIN', 'COMMISSION');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Add commission_wallet_balance column to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "commission_wallet_balance" NUMERIC(12, 2) NOT NULL DEFAULT 0.00;

-- 3. Add wallet_type column to wallet_transactions
ALTER TABLE "wallet_transactions" ADD COLUMN IF NOT EXISTS "wallet_type" "wallet_type" NOT NULL DEFAULT 'MAIN';