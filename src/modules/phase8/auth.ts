import { createHash, randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/auth/api";
import { withIdentityDatabase } from "@/lib/tenant-db";

const RESET_TTL_MS = 30 * 60 * 1000;

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function requestPasswordReset(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await withIdentityDatabase(() =>
    db.user.findUnique({ where: { email: normalizedEmail } }),
  );
  if (!user?.isActive || user.deletedAt) return null;

  const token = randomBytes(32).toString("base64url");
  await withIdentityDatabase(async () => {
    await db.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    await db.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: digest(token),
        expiresAt: new Date(Date.now() + RESET_TTL_MS),
      },
    });
  });
  return token;
}

export async function confirmPasswordReset(token: string, password: string) {
  const tokenHash = digest(token);
  const record = await withIdentityDatabase(() =>
    db.passwordResetToken.findUnique({ where: { tokenHash } }),
  );
  if (!record || record.usedAt || record.expiresAt <= new Date()) {
    throw new ApiError(
      400,
      "Tautan pemulihan tidak valid atau sudah kedaluwarsa.",
    );
  }
  const passwordHash = await hash(password, 12);
  await withIdentityDatabase(async () => {
    const claimed = await db.passwordResetToken.updateMany({
      where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1)
      throw new ApiError(
        400,
        "Tautan pemulihan tidak valid atau sudah kedaluwarsa.",
      );
    await db.user.update({
      where: { id: record.userId },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });
    await db.auditLog.createMany({
      data: [
        {
          actorId: record.userId,
          action: "UPDATE",
          resourceType: "PASSWORD",
          resourceId: record.userId,
        },
      ],
    });
  });
}

export async function revokeAllSessions(userId: string) {
  return withIdentityDatabase(async () => {
    const user = await db.user.update({
      where: { id: userId },
      data: { sessionVersion: { increment: 1 } },
      select: { sessionVersion: true },
    });
    await db.auditLog.createMany({
      data: [
        {
          actorId: userId,
          action: "LOGOUT",
          resourceType: "SESSION",
          resourceId: userId,
        },
      ],
    });
    return user.sessionVersion;
  });
}
