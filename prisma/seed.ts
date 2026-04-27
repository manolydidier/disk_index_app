import { PrismaClient, DiskStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.disk.upsert({
    where: { code: 'DB0001' },
    update: {},
    create: {
      code: 'DB0001',
      name: 'Disque Archive 1',
      rootPath: '/mnt/DB0001',
      description: 'Exemple de disque indexé',
      status: DiskStatus.DISCONNECTED
    }
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
