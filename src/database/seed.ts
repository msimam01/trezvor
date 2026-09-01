import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Check if admin already exists
  const existingAdmin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
  });

  if (existingAdmin) {
    console.log('✅ Admin user already exists, skipping seed');
    return;
  }

  // Create default admin
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@gasbot.com';
  const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'admin123456';

  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  // Generate referral code for admin
  const referralCode = `ADMIN-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  const admin = await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash: hashedPassword,
      username: 'admin',
      firstName: 'Admin',
      role: 'ADMIN',
      status: 'active',
      referralCode,
      nairaBalance: 0.0,
      unpaidAffiliateBalance: 0.0,
    },
  });

  console.log('✅ Default admin user created:');
  console.log(`   Email: ${adminEmail}`);
  console.log(`   Password: ${adminPassword}`);
  console.log(`   Referral Code: ${referralCode}`);
  console.log('⚠️  Please change the default password immediately after first login!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
