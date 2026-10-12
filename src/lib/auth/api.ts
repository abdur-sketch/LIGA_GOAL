import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { db } from "@/lib/db";
import { hasPermission, type PermissionKey } from "@/lib/auth/permissions";
import { withIdentityDatabase } from "@/lib/tenant-db";

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) { super(message); }
}

export type ApiActor = { id: string; isActive: boolean; isPlatformAdmin: boolean; deletedAt: Date | null };

export async function getApiActor(): Promise<ApiActor> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new ApiError(401, "Sesi autentikasi diperlukan.");
  const user = await withIdentityDatabase(() => db.user.findUnique({ where: { id: session.user.id }, select: { id: true, isActive: true, emailVerifiedAt: true, isPlatformAdmin: true, deletedAt: true } }));
  if (!user?.isActive || !user.emailVerifiedAt || user.deletedAt) throw new ApiError(401, "Akun tidak aktif atau belum diverifikasi.");
  return { id: user.id, isActive: user.isActive, isPlatformAdmin: user.isPlatformAdmin, deletedAt: user.deletedAt };
}

export async function authorizeOrganization(user: Awaited<ReturnType<typeof getApiActor>>, organizationId: string, permission: PermissionKey) {
  if (user.isPlatformAdmin) return;
  if (!(await hasPermission(user.id, organizationId, permission))) throw new ApiError(403, "Anda tidak memiliki izin untuk tindakan ini.");
}

export async function capabilities(user: Awaited<ReturnType<typeof getApiActor>>, organizationId: string, permissions: PermissionKey[]) {
  if (user.isPlatformAdmin) return Object.fromEntries(permissions.map((permission) => [permission, true]));
  const values = await Promise.all(permissions.map(async (permission) => [permission, await hasPermission(user.id, organizationId, permission)] as const));
  return Object.fromEntries(values);
}
