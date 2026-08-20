/**
 * One-off: sets `logoUrl` on already-seeded asset rows, matched by name,
 * without the destructive full reseed (`npm run seed` wipes and recreates
 * everything). Safe to re-run — it only ever sets a value, and reads the
 * same `ASSETS` list the seed script itself uses, so the two never drift.
 *
 * Run with: npx ts-node --transpile-only scripts/backfill-asset-logos.ts
 */
import { PrismaClient } from '@prisma/client';
import { ASSETS } from '../prisma/seed';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  let updated = 0;
  let skipped = 0;

  for (const spec of ASSETS) {
    if (!spec.logoDomain) {
      skipped += 1;
      continue;
    }

    const result = await prisma.asset.updateMany({
      where: { name: spec.name },
      data: {
        logoUrl: `https://www.google.com/s2/favicons?domain=${spec.logoDomain}&sz=128`,
      },
    });

    if (result.count > 0) updated += result.count;
  }

  console.log(`Updated ${updated} asset(s), skipped ${skipped} with no logo domain.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
