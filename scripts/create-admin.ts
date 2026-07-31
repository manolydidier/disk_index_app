import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

async function main() {
  const email = 'admin@diskindexer.local';
  const password = 'ChangeMe123!';
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      role: 'ADMIN',
      isActive: true
    },
    create: {
      email,
      name: 'Administrateur',
      passwordHash,
      role: 'ADMIN',
      isActive: true
    }
  });

  console.log('Admin prêt :', user.email);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });