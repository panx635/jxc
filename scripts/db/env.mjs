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

export function tailFile(file, maxLines = 40) {
  try {
    if (!existsSync(file)) return "";
    return readFileSync(file, "utf8").trim().split(/\r?\n/).slice(-maxLines).join("\n");
  } catch {
    return "";
  }
}

export async function resolveDatabaseUrl({ bootstrapLocal = false } = {}) {
  loadEnvFiles();
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const dataDir = path.join(repoRoot, ".local", "pgdata");
  const initialized = existsSync(path.join(dataDir, "PG_VERSION"));
  if (initialized || bootstrapLocal) {
    const { ensureLocalCluster } = await import("./local-pg.mjs");
    await ensureLocalCluster();
    return LOCAL_DATABASE_URL;
  }

  throw new Error([
    "缺少 DATABASE_URL。请选择一种方式：",
    "  1. 复制 .env.example 为 .env.local，填入可用的 PostgreSQL 连接串；",
    "  2. 或直接运行 `pnpm dev`：本机检测到 PostgreSQL 安装时会自动初始化 .local/pgdata 并启动本地集群。",
  ].join("\n"));
}
