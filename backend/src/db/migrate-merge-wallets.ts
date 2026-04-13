import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

/**
 * Migration: Merge Wallets
 * - Adds any existing funds sitting in the old 'commission_wallet_balance'
 *   directly into the main 'wallet_balance'.
 * - Ensures no user loses their previously earned commissions after the single-wallet refactor.
 * 
 * Run ONCE with: npx tsx src/db/migrate-merge-wallets.ts
 */
async function migrate() {
  const sql = neon(process.env.DATABASE_URL!);

  console.log('🔄 Starting Wallet Consolidation Migration...\n');

  try {
    // 1. Mathematically add existing commission balances into the main wallet balance
    // We only update users who actually have a commission balance > 0 to save operations
    await sql`
      UPDATE "users" 
      SET "wallet_balance" = "wallet_balance" + "commission_wallet_balance"
      WHERE "commission_wallet_balance" > 0;
    `;
    
    console.log('✅ Successfully transferred all existing commission funds into Main Wallets!');
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

migrate();
