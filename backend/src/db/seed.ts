import { config } from 'dotenv';
config();

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import * as schema from './schema';

neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const db = drizzle(pool, { schema });

async function seed() {
  console.log('🌱 Seeding database...');

  try {
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12');
    
    // Use environment variables for Super Admin credentials
    const adminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@mlcplatform.com';
    const adminPassword = process.env.SUPER_ADMIN_PASSWORD || 'Admin@123!';
    
    if (!process.env.SUPER_ADMIN_EMAIL || !process.env.SUPER_ADMIN_PASSWORD) {
      console.warn('⚠️ SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD not set in .env.');
      console.warn('⚠️ Falling back to default demo credentials. DO NOT USE IN PRODUCTION!');
    }

    const passwordHash = await bcrypt.hash(adminPassword, saltRounds);

    const admins = await db.select().from(schema.users).where(eq(schema.users.role, 'SUPER_ADMIN'));

    if (admins.length === 0) {
      await db.insert(schema.users).values({
        name: 'System Admin',
        email: adminEmail,
        phone: '9999999999',
        passwordHash,
        role: 'SUPER_ADMIN',
        isActive: true,
        requiresPasswordChange: true,
      });
      console.log('✅ Super Admin created.');
      console.log(`  Email: ${adminEmail}`);
      console.log(`  Password: ${process.env.SUPER_ADMIN_PASSWORD ? '********' : adminPassword}`);
      console.log('  Please change the password on first login.');
    } else {
      console.log('ℹ️ Super Admin already exists.');
    }

    // Seed default services
    const currentServices = await db.select().from(schema.services);
    if (currentServices.length === 0) {
      await db.insert(schema.services).values([
        { name: 'Prepaid Mobile', serviceType: 'MOBILE', isActive: true, apiEndpoint: 'bharatpays' },
        { name: 'DTH Service', serviceType: 'DTH', isActive: true, apiEndpoint: 'bharatpays' },
      ]);
      console.log('✅ Default API Services created.');
    } else {
      console.log('ℹ️ Services already seeded.');
    }


    console.log('🎉 Seeding complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seed();
