import { hash } from "bcryptjs";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";

async function main() {
  const input = z
    .object({
      email: z.string().email(),
      name: z.string().min(2),
      password: z.string().min(12),
    })
    .parse({
      email: process.env.ADMIN_EMAIL,
      name: process.env.ADMIN_NAME,
      password: process.env.ADMIN_PASSWORD,
    });
  const migrationUrl = process.env.MIGRATION_DATABASE_URL;
  if (!migrationUrl)
    throw new Error(
      "MIGRATION_DATABASE_URL wajib untuk bootstrap administratif.",
    );
  const db = new PrismaClient({ datasources: { db: { url: migrationUrl } } });
  try {
    const passwordHash = await hash(input.password, 12);
    const user = await db.user.upsert({
      where: { email: input.email.toLowerCase() },
      update: {
        name: input.name,
        isActive: true,
        isPlatformAdmin: true,
        passwordHash,
      },
      create: {
        email: input.email.toLowerCase(),
        name: input.name,
        isPlatformAdmin: true,
        passwordHash,
      },
    });
    console.log(`Super Admin siap: ${user.email}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
