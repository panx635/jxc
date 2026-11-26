import assert from "node:assert/strict";
import { databaseName, resolveDatabaseUrl, withDatabaseName } from "./env.mjs";
import { dropDatabase, ensureDatabase, tableNames, withClient } from "./database.mjs";
import { listMigrations, migrateDown, migrateUp } from "./migrate.mjs";
import { seedDatabase } from "./seed.mjs";

const EXPECTED_TABLES = ["app_user", "shop_profile", "unit", "user_session", "warehouse"];

async function adminPasswordHash(connectionString, username) {
  return withClient(connectionString, async (client) => {
    const { rows } = await client.query("select password_hash from app_user where username = $1", [username]);
    return rows[0]?.password_hash ?? null;
  });
}

async function migrationCount(connectionString) {
  return withClient(connectionString, async (client) => {
    const { rows } = await client.query("select count(*)::int as count from schema_migrations");
    return rows[0].count;
  });
}

const baseUrl = await resolveDatabaseUrl({ bootstrapLocal: true });
const scratchName = `jxc_verify_${process.pid}_${Date.now().toString(36)}`;
const scratchUrl = withDatabaseName(baseUrl, scratchName);
const username = process.env.SEED_ADMIN_USERNAME?.trim() || "admin";
const migrations = listMigrations();

console.log(`[verify] 使用一次性数据库 ${scratchName}（服务：${databaseName(baseUrl)}）`);

try {
  await dropDatabase(scratchUrl);
  await ensureDatabase(scratchUrl);

  const firstUp = await migrateUp(scratchUrl);
  assert.equal(firstUp.length, migrations.length, "首次迁移应全部应用");
  let tables = await tableNames(scratchUrl);
  for (const table of EXPECTED_TABLES) assert.ok(tables.includes(table), `迁移后应有表 ${table}`);
  console.log("[verify] 迁移应用：通过");

  const down = await migrateDown(scratchUrl, { all: true });
  assert.equal(down.length, migrations.length, "回滚应覆盖全部迁移");
  tables = await tableNames(scratchUrl);
  for (const table of EXPECTED_TABLES) assert.ok(!tables.includes(table), `回滚后不应有表 ${table}`);
  assert.equal(await migrationCount(scratchUrl), 0, "回滚后迁移账本应为空");
  console.log("[verify] 迁移回滚：通过");

  await migrateUp(scratchUrl);
  assert.equal(await migrationCount(scratchUrl), migrations.length, "回滚后应能重新应用全部迁移");
  console.log("[verify] 回滚后重放：通过");

  const firstSeed = await seedDatabase(scratchUrl);
  const firstHash = await adminPasswordHash(scratchUrl, username);
  assert.equal(firstSeed.adminCreated, true, "首次种子应创建管理员");
  assert.equal(firstSeed.counts.shop_profile, 1, "店铺档案只有一行");
  assert.equal(firstSeed.counts.warehouse, 1, "默认仓只有一条");
  assert.equal(firstSeed.counts.unit, 7, "基础单位应有 7 个");

  const secondSeed = await seedDatabase(scratchUrl);
  const secondHash = await adminPasswordHash(scratchUrl, username);
  assert.equal(secondSeed.adminCreated, false, "重复种子不应新建管理员");
  assert.equal(secondSeed.counts.app_user, firstSeed.counts.app_user, "重复种子不应增加账号");
  assert.equal(secondSeed.counts.warehouse, 1, "重复种子不应增加仓库");
  assert.equal(secondSeed.counts.unit, 7, "重复种子不应增加单位");
  assert.equal(secondSeed.counts.shop_profile, 1, "重复种子不应增加店铺档案");
  assert.equal(secondHash, firstHash, "重复种子不应重置管理员密码");
  console.log("[verify] 种子可重复执行：通过");

  console.log("[verify] 全部通过。");
} catch (error) {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
} finally {
  try {
    await dropDatabase(scratchUrl);
    console.log(`[verify] 已清理 ${scratchName}`);
  } catch (cleanupError) {
    console.error("[verify] 清理一次性数据库失败", cleanupError);
    process.exitCode = 1;
  }
}
