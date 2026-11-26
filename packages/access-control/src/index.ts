/**
 * 权限与配置领域包（@jxc/access-control）。
 *
 * 拥有：user / can_view_cost / audit_log / 三组可配。
 * 只读依赖：全局横切。
 *
 * 边界纪律：
 * - 不 import next/*、React 或 app 层代码；不承载 HTTP。
 * - 账号与店铺档案的 SQL 只在这里；应用层只提供连接池适配器。
 * - 本票只落登录所需的读取与登录时间记录；账号 CRUD、audit_log 与配置由后续实施票扩展。
 */

export type UserRole = "admin" | "clerk";

/** 由应用层实现的窄连接口：领域包不依赖 pg，也不关心连接池。 */
export type SqlClient = {
  query(text: string, values?: readonly unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
};

export type LoginUser = {
  id: string;
  username: string;
  displayName: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  canViewCost: boolean;
};

function asRole(value: unknown): UserRole {
  if (value === "admin" || value === "clerk") return value;
  throw new Error(`数据库里有未知角色：${String(value)}`);
}

export async function findLoginUser(db: SqlClient, username: string): Promise<LoginUser | null> {
  const { rows } = await db.query(
    `select id::text as id,
            username,
            display_name,
            password_hash,
            role,
            is_active,
            can_view_cost
       from app_user
      where username = $1`,
    [username],
  );
  const row = rows[0];
  if (!row) return null;

  return {
    id: String(row.id),
    username: String(row.username),
    displayName: String(row.display_name),
    passwordHash: String(row.password_hash),
    role: asRole(row.role),
    isActive: Boolean(row.is_active),
    canViewCost: Boolean(row.can_view_cost),
  };
}

export async function recordLogin(db: SqlClient, userId: string): Promise<void> {
  await db.query("update app_user set last_login_at = now() where id = $1", [userId]);
}

export async function getShopName(db: SqlClient): Promise<string | null> {
  const { rows } = await db.query("select name from shop_profile where id = 1");
  const name = rows[0]?.name;
  return typeof name === "string" ? name : null;
}
