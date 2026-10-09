import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/options";
import { hasPermission, type PermissionKey } from "@/lib/auth/permissions";

export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  return session;
}

export async function requirePermission(organizationId: string, permission: PermissionKey) {
  const session = await requireSession();
  if (!(await hasPermission(session.user.id, organizationId, permission))) redirect("/forbidden");
  return session;
}
