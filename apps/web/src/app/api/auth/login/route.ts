import { NextResponse } from "next/server";
import { findLoginUser, recordLogin } from "@jxc/access-control";
import { accessStore } from "@/server/access-store";
import { isSameOrigin, jsonError } from "@/server/http";
import { verifyAgainstDummy, verifyPassword } from "@/server/password";
import { createSession, SESSION_COOKIE, sessionCookieOptions } from "@/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function trimmedText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return jsonError(403, "forbidden_origin", "请求来源不受信任。");
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError(400, "invalid_body", "请求体不是合法 JSON。");
  }
  if (typeof payload !== "object" || payload === null) {
    return jsonError(400, "invalid_body", "请求体格式不正确。");
  }

  const body = payload as { username?: unknown; password?: unknown };
  const username = trimmedText(body.username);
  const password = typeof body.password === "string" ? body.password : "";
  if (!username || !password) {
    return jsonError(400, "missing_credentials", "请输入用户名和密码。");
  }

  const user = await findLoginUser(accessStore, username);
  if (!user || !user.isActive) {
    await verifyAgainstDummy(password);
    return jsonError(401, "invalid_credentials", "用户名或密码不正确。");
  }

  if (!(await verifyPassword(user.passwordHash, password))) {
    return jsonError(401, "invalid_credentials", "用户名或密码不正确。");
  }

  const session = await createSession(user.id);
  await recordLogin(accessStore, user.id);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, session.token, sessionCookieOptions(session.expiresAt));
  return response;
}