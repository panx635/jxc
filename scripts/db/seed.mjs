import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveDatabaseUrl } from "./env.mjs";
import { withClient } from "./database.mjs";
import { hashPassword } from "../lib/passwords.mjs";

const DEFAULT_UNITS = ["根", "个", "套", "米", "箱", "件", "包"];

function seedConfig(env) {
  const username = env.SEED_ADMIN_USERNAME?.trim() || "admin";
  const password = env.SEED_ADMIN_PASSWORD || "admin12345";
  const displayName = env.SEED_ADMIN_DISPLAY_NAME?.trim() || "管理员";
  const shopName = env.SEED_SHOP_NAME?.trim() || "五金水暖";
  if (!username) throw new Error("SEED_ADMIN_USERNAME 不能为空。");
  if (!password) throw new Error("SEED_ADMIN_PASSWORD 不能为空。");
  return { username, password, displayName, shopName };
}

export async function seedDatabase(connectionString, env = process.env) {
  const config = seedConfig(env);
  const summary = { adminCreated: false, counts: null };

  await withClient(connectionString, async (client) => {
    await client.query("begin");
    try {
      await client.query(
        `insert into shop_profile (id, name)
         values (1, $1)
         on conflict (id) do nothing`,
        [config.shopName],
      );

      await client.query(
        `insert into warehouse (name)
         values ($1)
         on conflict (name) do nothing`,
        ["主仓"],
      );

      for (const unitName of DEFAULT_UNITS) {
        await client.query(
          `insert into unit (name)
           values ($1)
           on conflict (name) do nothing`,
          [unitName],
        );
      }

      const existingAdmin = await client.query("select id from app_user where username = $1", [config.username]);
      if (existingAdmin.rowCount === 0) {
        const passwordHash = await hashPassword(config.password);
        await client.query(
          `insert into app_user (username, display_name, password_hash, role, can_view_cost, is_active)
           values ($1, $2, $3, 'admin', true, true)`,
          [config.username, config.displayName, passwordHash],
        );
        summary.adminCreated = true;
      }

      const { rows } = await client.query(
        `select (select count(*) from app_user) as app_user,
                (select count(*) from warehouse) as warehouse,
                (select count(*) from unit) as unit,
                (select count(*) from shop_profile) as shop_profile`,
      );
      summary.counts = Object.fromEntries(
        Object.entries(rows[0]).map(([key, value]) => [key, Number(value)]),
      );

      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  });

  return summary;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const connectionString = await resolveDatabaseUrl({ bootstrapLocal: true });
    const summary = await seedDatabase(connectionString);
    console.log(
      `[db] 种子完成：管理员${summary.adminCreated ? "已创建" : "已存在"}；` +
        `账号 ${summary.counts.app_user}、仓库 ${summary.counts.warehouse}、单位 ${summary.counts.unit}、店铺 ${summary.counts.shop_profile}`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exitCode = 1;
  }
}