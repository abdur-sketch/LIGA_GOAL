import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

const REQUEST_ID = /^[a-zA-Z0-9._-]{8,128}$/;

export function proxy(request: NextRequest) {
  const supplied = request.headers.get("x-request-id");
  const requestId = supplied && REQUEST_ID.test(supplied) ? supplied : randomUUID();
  const headers = new Headers(request.headers);
  headers.set("x-request-id", requestId);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
