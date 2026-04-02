import { config } from 'dotenv';
config();

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import * as schema from './schema';

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

async function seed() {
  console.log('🌱 Seeding database...');

  try {
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12');
    const passwordHash = await bcrypt.hash('Admin@123!', saltRounds);

    const admins = await db.select().from(schema.users).where(eq(schema.users.role, 'SUPER_ADMIN'));

    if (admins.length === 0) {
      await db.insert(schema.users).values({
        name: 'System Admin',
        email: 'admin@mlcplatform.com',
        phone: '9999999999',
        passwordHash,
        role: 'SUPER_ADMIN',
        isActive: true,
        kycStatus: 'APPROVED',
        requiresPasswordChange: true,
      });
      console.log('✅ Super Admin created.');
      console.log('  Email: admin@mlcplatform.com');
      console.log('  Password: Admin@123!');
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
