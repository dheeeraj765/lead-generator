import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);
  
  const user = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      email: 'demo@example.com',
      name: 'Demo User',
      passwordHash,
    },
  });
  
  console.log('Created user:', user);
  
  // Create some sample leads
  await prisma.lead.createMany({
    data: [
      {
        userId: user.id,
        businessName: 'Sample Dental Care',
        website: 'https://example.com',
        phone: '(555) 123-4567',
        address: '123 Main St, Chicago, IL',
        sourceUrl: 'https://example.com/search',
        keyword: 'dentist',
        location: 'Chicago',
        status: 'NEW',
      },
      {
        userId: user.id,
        businessName: 'Bright Smiles Clinic',
        website: 'https://example2.com',
        phone: '(555) 234-5678',
        address: '456 Oak Ave, Chicago, IL',
        sourceUrl: 'https://example.com/search',
        keyword: 'dentist',
        location: 'Chicago',
        status: 'CONTACTED',
      },
    ],
  });
  
  console.log('Created sample leads');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });