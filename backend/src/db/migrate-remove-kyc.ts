import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

/**
 * Migration: Remove KYC system
 * - Drops kyc_documents table
 * - Drops kyc_status column from users
 * - Drops kyc_status, doc_type, doc_status enums (if they exist)
 *
 * Run ONCE with: npx ts-node -e "require('./src/db/migrate-remove-kyc.ts')"
 * or: npx tsx src/db/migrate-remove-kyc.ts
 */
async function migrate() {
  const sql = neon(process.env.DATABASE_URL!);

  console.log('🗑️  Starting KYC removal migration...\n');

  try {
    // 1. Drop kyc_documents table (and its FK references)
    await sql`DROP TABLE IF EXISTS "kyc_documents" CASCADE`;
    console.log('✅ Dropped kyc_documents table');

    // 2. Drop kyc_status column from users
    await sql`ALTER TABLE "users" DROP COLUMN IF EXISTS "kyc_status"`;
    console.log('✅ Dropped kyc_status column from users');

    // 3. Drop KYC-related enums (safe if they don't exist)
    await sql`
      DO $$ BEGIN
        DROP TYPE IF EXISTS "kyc_status";
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `;
    await sql`
      DO $$ BEGIN
        DROP TYPE IF EXISTS "doc_type";
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `;
    await sql`
      DO $$ BEGIN
        DROP TYPE IF EXISTS "doc_status";
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `;
    console.log('✅ Dropped KYC enums (kyc_status, doc_type, doc_status)');

    console.log('\n🎉 KYC removal migration complete!');
    console.log('   - kyc_documents table dropped');
    console.log('   - kyc_status column removed from users');
    console.log('   - KYC enums dropped');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

migrate();
