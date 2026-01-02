import { prisma } from '../lib/prisma';

async function findAdmin() {
  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    select: { id: true, email: true, name: true },
  });
  
  if (admin) {
    console.log('Admin user found:');
    console.log(JSON.stringify(admin, null, 2));
    console.log(`\nUse this ID for seeding: ${admin.id}`);
  } else {
    console.log('No admin user found. Please create one first.');
  }
  
  await prisma.$disconnect();
}

findAdmin().catch(console.error);

