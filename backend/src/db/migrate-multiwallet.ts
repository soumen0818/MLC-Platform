import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

async function migrate() {
  const sql = neon(process.env.DATABASE_URL!);

  console.log('Applying multi-wallet migration...');

  try {
    // 1. Create wallet_type enum
    await sql`
      DO $$ BEGIN
        CREATE TYPE "wallet_type" AS ENUM ('MAIN', 'COMMISSION');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `;
    console.log('✅ wallet_type enum created or already exists');

    // 2. Add commission_wallet_balance to users
    await sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "commission_wallet_balance" NUMERIC(12, 2) NOT NULL DEFAULT 0.00`;
    console.log('✅ commission_wallet_balance column added to users');

    // 3. Add wallet_type to wallet_transactions
    await sql`ALTER TABLE "wallet_transactions" ADD COLUMN IF NOT EXISTS "wallet_type" "wallet_type" NOT NULL DEFAULT 'MAIN'`;
    console.log('✅ wallet_type column added to wallet_transactions');

    console.log('\n🎉 Multi-wallet migration complete!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

migrate();
