import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { repoRoot, resolveDatabaseUrl } from "./env.mjs";
import { withClient } from "./database.mjs";

const MIGRATIONS_DIR = path.join(repoRoot, "db", "migrations");
const LOCK_KEY = 76174001;

function normalize(sql) {
  return sql.replace(/\r\n/g, "\n");
}

export function listMigrations() {
  const fileNames = readdirSync(MIGRATIONS_DIR);
  const migrations = [];
  const versions = new Set();
  for (const fileName of fileNames.filter((name) => name.endsWith(".up.sql")).sort()) {
    const match = /^(\d+)_(.+)\.up\.sql$/.exec(fileName);
    if (!match) throw new Error(`迁移文件名不合法：${fileName}`);
    const [, version, name] = match;
    if (versions.has(version)) throw new Error(`迁移版本重复：${version}`);
    versions.add(version);

    const downFileName = `${version}_${name}.down.sql`;
    if (!fileNames.includes(downFileName)) {
      throw new Error(`迁移 ${fileName} 缺少对应的 ${downFileName}，无法回滚。`);
    }
    const upSql = normalize(readFileSync(path.join(MIGRATIONS_DIR, fileName), "utf8"));
    const downSql = normalize(readFileSync(path.join(MIGRATIONS_DIR, downFileName), "utf8"));
    migrations.push({
      version,
      name,
      upSql,
      downSql,
      checksum: createHash("sha256").update(upSql).digest("hex"),
    });
  }
  return migrations;
}

const CREATE_LEDGER = `create table if not exists schema_migrations (
  version text primary key,
  name text not null,
  checksum text not null,
  applied_at timestamptz not null default now()
)`;

async function readApplied(client) {
  const { rows } = await client.query("select to_regclass('public.schema_migrations') as ledger");
  if (!rows[0]?.ledger) return [];
  const result = await client.query("select version, name, checksum, applied_at from schema_migrations order by version");
  return result.rows;
}

export async function migrateUp(connectionString, { steps = Infinity } = {}) {
  const migrations = listMigrations();
  const appliedNow = [];

  await withClient(connectionString, async (client) => {
    await client.query(CREATE_LEDGER);
    await client.query("select pg_advisory_lock($1)", [LOCK_KEY]);
    try {
      const applied = new Map((await readApplied(client)).map((row) => [row.version, row.checksum]));
      for (const migration of migrations) {
        if (applied.has(migration.version)) {
          if (applied.get(migration.version) !== migration.checksum) {
            throw new Error(`迁移 ${migration.version} 已被修改：已应用的 SQL 校验和与当前文件不一致。`);
          }
          continue;
        }
        if (appliedNow.length >= steps) break;

        await client.query("begin");
        try {
          await client.query(migration.upSql);
          await client.query(
            "insert into schema_migrations (version, name, checksum) values ($1, $2, $3)",
            [migration.version, migration.name, migration.checksum],
          );
          await client.query("commit");
        } catch (error) {
          await client.query("rollback");
          throw error;
        }
        appliedNow.push(migration.version);
        console.log(`[db] 迁移已应用：${migration.version}_${migration.name}`);
      }
    } finally {
      await client.query("select pg_advisory_unlock($1)", [LOCK_KEY]);
    }
  });

  return appliedNow;
}

export async function migrateDown(connectionString, { steps = 1, all = false } = {}) {
  const migrations = new Map(listMigrations().map((migration) => [migration.version, migration]));
  const rolledBack = [];

  await withClient(connectionString, async (client) => {
    await client.query(CREATE_LEDGER);
    await client.query("select pg_advisory_lock($1)", [LOCK_KEY]);
    try {
      const applied = await readApplied(client);
      const targets = (all ? applied : applied.slice(-steps)).reverse();

      for (const row of targets) {
        const migration = migrations.get(row.version);
        if (!migration) throw new Error(`找不到已应用迁移 ${row.version} 的当前文件。`);

        await client.query("begin");
        try {
          await client.query(migration.downSql);
          await client.query("delete from schema_migrations where version = $1", [row.version]);
          await client.query("commit");
        } catch (error) {
          await client.query("rollback");
          throw error;
        }
        rolledBack.push(row.version);
        console.log(`[db] 迁移已回滚：${row.version}_${migration.name}`);
      }
    } finally {
      await client.query("select pg_advisory_unlock($1)", [LOCK_KEY]);
    }
  });

  return rolledBack;
}

export async function migrationStatus(connectionString) {
  const migrations = listMigrations();
  return withClient(connectionString, async (client) => {
    const applied = new Map((await readApplied(client)).map((row) => [row.version, row]));
    return migrations.map((migration) => ({
      version: migration.version,
      name: migration.name,
      state: applied.has(migration.version) ? "applied" : "pending",
      appliedAt: applied.get(migration.version)?.applied_at ?? null,
    }));
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const args = process.argv.slice(2);
    const command = args[0] ?? "up";
    let steps = command === "down" ? 1 : Number.POSITIVE_INFINITY;
    let all = false;
    for (let index = 1; index < args.length; index += 1) {
      if (args[index] === "--all") all = true;
      else if (args[index] === "--steps") {
        steps = Number(args[index + 1]);
        index += 1;
      } else {
        throw new Error(`未知参数：${args[index]}`);
      }
    }

    const connectionString = await resolveDatabaseUrl({ bootstrapLocal: true });
    if (command === "up") {
      await migrateUp(connectionString, { steps });
    } else if (command === "down") {
      if (!all && (!Number.isInteger(steps) || steps < 1)) throw new Error("--steps 必须是正整数。");
      await migrateDown(connectionString, { steps, all });
    } else if (command === "status") {
      for (const row of await migrationStatus(connectionString)) {
        console.log(`${row.version}_${row.name}\t${row.state}\t${row.appliedAt ?? ""}`);
      }
    } else {
      throw new Error(`未知命令：${command}（可用 up / down / status）`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exitCode = 1;
  }
}