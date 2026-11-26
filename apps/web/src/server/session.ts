import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { query } from "./db";

export const SESSION_COOKIE = "jxc_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type UserRole = "admin" | "clerk";

export type SessionUser = {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  canViewCost: boolean;
};

type SessionUserRow = {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  canViewCost: boolean;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionCookieOptions(expires?: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production" && process.env.JXC_INSECURE_COOKIES !== "1",
    ...(expires ? { expires } : {}),
  };
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await query(
    "insert into user_session (token_hash, user_id, expires_at) values ($1, $2, $3)",
    [hashToken(token), userId, expiresAt],
  );
  return { token, expiresAt };
}

export async function revokeSession(token: string): Promise<void> {
  await query("update user_session set revoked_at = now() where token_hash = $1 and revoked_at is null", [
    hashToken(token),
  ]);
}

export async function getSessionToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = await getSessionToken();
  if (!token) return null;

  const { rows } = await query<SessionUserRow>(
    `select u.id::text as id,
            u.username,
            u.display_name as "displayName",
            u.role,
            u.can_view_cost as "canViewCost"
       from user_session s
       join app_user u on u.id = s.user_id
      where s.token_hash = $1
        and s.revoked_at is null
        and s.expires_at > now()
        and u.is_active
      limit 1`,
    [hashToken(token)],
  );
  return rows[0] ?? null;
}