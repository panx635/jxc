import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const LOCAL_PG_PORT = 55432;
export const LOCAL_DB_NAME = "jxc_dev";
export const LOCAL_DATABASE_URL = `postgresql://postgres@127.0.0.1:${LOCAL_PG_PORT}/${LOCAL_DB_NAME}`;

export function loadEnvFiles() {
  for (const name of [".env.local", ".env"]) {
    const file = path.join(repoRoot, name);
    if (!existsSync(file)) continue;
    const source = readFileSync(file, "utf8");
    for (const rawLine of source.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const equals = line.indexOf("=");
      if (equals <= 0) continue;
      const key = line.slice(0, equals).trim();
      if (!key || key in process.env) continue;
      let value = line.slice(equals + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}

export function parseDatabaseUrl(connectionString) {
  const url = new URL(connectionString);
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error(`DATABASE_URL 必须是 postgres:// 或 postgresql://，收到 ${url.protocol}`);
  }
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!database) throw new Error("DATABASE_URL 必须包含数据库名。");
  return { url, database };
}

export function withDatabaseName(connectionString, databaseName) {
  const url = new URL(connectionString);
  url.pathname = "/" + encodeURIComponent(databaseName);
  return url.toString();
}

export function databaseName(connectionString) {
  return parseDatabaseUrl(connectionString).database;
}

export async function resolveDatabaseUrl({ bootstrapLocal = false } = {}) {
  loadEnvFiles();
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  if (bootstrapLocal) {
    const { ensureLocalCluster } = await import("./local-pg.mjs");
    await ensureLocalCluster();
    return LOCAL_DATABASE_URL;
  }

  throw new Error([
    "缺少 DATABASE_URL。生产 / 测试服务器必须显式配置；本地开发可以运行 `pnpm dev`，",
    "它会在本机初始化 .local/pgdata 并代你导出连接串。",
  ].join("\n"));
}