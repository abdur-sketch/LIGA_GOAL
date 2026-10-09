import { hash } from "bcryptjs";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";

const input = z.object({ email: z.string().email(), name: z.string().min(2), password: z.string().min(12) }).parse({ email: process.env.ADMIN_EMAIL, name: process.env.ADMIN_NAME, password: process.env.ADMIN_PASSWORD });
const db = new PrismaClient();
try {
  const user = await db.user.upsert({ where: { email: input.email.toLowerCase() }, update: { name: input.name, isActive: true, isPlatformAdmin: true, passwordHash: await hash(input.password, 12) }, create: { email: input.email.toLowerCase(), name: input.name, isPlatformAdmin: true, passwordHash: await hash(input.password, 12) } });
  console.log(`Super Admin siap: ${user.email}`);
} finally { await db.$disconnect(); }
