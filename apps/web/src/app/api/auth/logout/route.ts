import { NextResponse } from "next/server";
import { isSameOrigin, jsonError } from "@/server/http";
import { getSessionToken, revokeSession, SESSION_COOKIE, sessionCookieOptions } from "@/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return jsonError(403, "forbidden_origin", "请求来源不受信任。");
  }

  const token = await getSessionToken();
  if (token) await revokeSession(token);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", {
    ...sessionCookieOptions(new Date(0)),
    maxAge: 0,
  });
  return response;
}
