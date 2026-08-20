import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: ts-node scripts/ensure-admin.ts <email> [name]');
    process.exit(1);
  }
  const name = process.argv[3];

  const user = await prisma.user.upsert({
    where: { email },
    update: { role: 'ADMIN', status: 'ACTIVE' },
    create: { email, name, role: 'ADMIN', status: 'ACTIVE' },
  });

  console.log(`${user.email}: role=${user.role} status=${user.status}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
