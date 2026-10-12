import { NextResponse, type NextRequest } from "next/server";
import { ApiError, getApiActor } from "@/lib/auth/api";
import { rootDb } from "@/lib/db";
import {
  withActorDatabase,
  withPlatformDatabase,
  withPublicDatabase,
} from "@/lib/tenant-db";

type Handler<Context> = (
  request: NextRequest,
  context: Context,
) => Promise<Response>;

async function organizationFromRequest(request: NextRequest) {
  const queryValue = request.nextUrl.searchParams.get("organizationId");
  if (queryValue) return queryValue;
  if (!request.headers.get("content-type")?.includes("application/json"))
    return null;
  const body = (await request
    .clone()
    .json()
    .catch(() => null)) as { organizationId?: unknown } | null;
  return typeof body?.organizationId === "string" ? body.organizationId : null;
}

function boundaryError(error: unknown) {
  if (error instanceof ApiError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  console.error("runtime-database-boundary-error", error);
  return NextResponse.json(
    { error: "Terjadi kesalahan internal." },
    { status: 500 },
  );
}

/**
 * Authenticates before choosing scope. The selected tenant is still untrusted:
 * the wrapped DAL must authorize the actor before returning tenant data.
 */
export function withRuntimeDatabaseRoute<Context>(
  handler: Handler<Context>,
): Handler<Context> {
  return async (request, context) => {
    try {
      const actor = await getApiActor();
      const organizationId = await organizationFromRequest(request);
      if (organizationId)
        return withActorDatabase(actor, organizationId, () =>
          handler(request, context),
        );
      if (actor.isPlatformAdmin)
        return withPlatformDatabase(
          rootDb,
          async () => handler(request, context),
          "platform",
        );
      if (
        request.method === "GET" &&
        request.nextUrl.pathname === "/api/admin/organizations"
      )
        return handler(request, context);
      throw new ApiError(400, "organizationId wajib diisi.");
    } catch (error) {
      return boundaryError(error);
    }
  };
}

/** Only public DAL functions with explicit published-data predicates belong here. */
export function withPublicDatabaseRoute<Context>(
  handler: Handler<Context>,
): Handler<Context> {
  return async (request, context) => {
    try {
      return await withPublicDatabase(() => handler(request, context));
    } catch (error) {
      return boundaryError(error);
    }
  };
}
