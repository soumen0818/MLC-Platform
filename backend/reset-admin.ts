import { config } from 'dotenv';
config();

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import * as schema from './src/db/schema';

// This script forces a reset of the Super Admin password
async function resetAdminPassword() {
  console.log('🔄 Resetting Super Admin Password...');

  try {
    const sql = neon(process.env.DATABASE_URL!);
    const db = drizzle(sql, { schema });

    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12');

    // Make sure we have the password from .env
    const adminPassword = process.env.SUPER_ADMIN_PASSWORD || 'superadmin';
    const newPasswordHash = await bcrypt.hash(adminPassword, saltRounds);

    console.log(`Setting password to the value inside your .env SUPER_ADMIN_PASSWORD...`);

    const result = await db.update(schema.users)
      .set({ 
        passwordHash: newPasswordHash,
        requiresPasswordChange: true // Forces them to change it on next login if applicable
      })
      .where(eq(schema.users.role, 'SUPER_ADMIN'))
      .returning({ email: schema.users.email });

    if (result.length > 0) {
      console.log(`✅ Successfully updated password for Super Admin: ${result[0].email}`);
      console.log(`🔑 New password is: ${adminPassword}`);
    } else {
      console.log(`❌ No user found with role 'SUPER_ADMIN'.`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Password reset failed:', error);
    process.exit(1);
  }
}

resetAdminPassword();
