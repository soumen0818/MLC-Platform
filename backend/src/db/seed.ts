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
        kycStatus: 'APPROVED',
        requiresPasswordChange: true,
      });
      console.log('✅ Super Admin created.');
      console.log(`  Email: ${adminEmail}`);
      console.log(`  Password: ${process.env.SUPER_ADMIN_PASSWORD ? '********' : adminPassword}`);
      console.log('  Please change the password on first login.');
    } else {
      console.log('ℹ️ Super Admin already exists.');
    }

    // Default Commission Configs (Demo purposes)
    const services = ['MOBILE', 'DTH', 'ELECTRICITY'];
    const roles = ['STATE_HEAD', 'MASTER_DISTRIBUTOR', 'DISTRIBUTOR', 'RETAILER'];
    
    // Check if configs exist
    const configs = await db.select().from(schema.commissionConfigs);
    if (configs.length === 0) {
      console.log('⚙️ Adding default commission configs...');
      for (const service of services) {
        for (const role of roles) {
          await db.insert(schema.commissionConfigs).values({
            serviceType: service,
            role: role as any,
            commissionType: 'PERCENTAGE',
            commissionValue: role === 'RETAILER' ? '2.00' : role === 'DISTRIBUTOR' ? '0.50' : role === 'MASTER_DISTRIBUTOR' ? '0.30' : '0.20',
          });
        }
      }
      console.log('✅ Default commission configs added.');
    }

    console.log('🎉 Seeding complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seed();
