import { appendFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const localDir = path.join(repoRoot, ".local");
const dataDir = path.join(localDir, "pgdata");
const logFile = path.join(localDir, "postgres.log");
const LOCAL_PG_PORT = 55432;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", timeout: options.timeout ?? 120_000 });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`命令失败（退出码 ${result.status}）：${command} ${args.join(" ")}`);
  }
  return result;
}

function candidateBinDirs() {
  const dirs = [];
  if (process.env.PG_BIN) dirs.push(process.env.PG_BIN);

  if (process.platform === "win32") {
    for (const drive of ["C", "D", "E", "F"]) {
      const base = `${drive}:\\Program Files\\PostgreSQL`;
      if (!existsSync(base)) continue;
      const versions = readdirSync(base)
        .filter((name) => /^\d+/.test(name))
        .sort((a, b) => Number.parseInt(b, 10) - Number.parseInt(a, 10));
      for (const version of versions) dirs.push(path.join(base, version, "bin"));
    }
  } else {
    const bases = ["/usr/lib/postgresql", "/usr/pgsql", "/opt/homebrew/opt", "/usr/local/opt"];
    for (const base of bases) {
      if (!existsSync(base)) continue;
      for (const name of readdirSync(base)) {
        const dir = path.join(base, name, "bin");
        if (existsSync(path.join(dir, "pg_ctl"))) dirs.push(dir);
      }
    }
  }

  const which = spawnSync(process.platform === "win32" ? "where" : "sh",
    process.platform === "win32" ? ["pg_ctl"] : ["-c", "command -v pg_ctl"],
    { encoding: "utf8" });
  if (which.status === 0) {
    const found = which.stdout.trim().split(/\r?\n/)[0];
    if (found) dirs.push(path.dirname(found));
  }
  return dirs;
}

export function findPgBin() {
  for (const dir of candidateBinDirs()) {
    const pgCtl = path.join(dir, process.platform === "win32" ? "pg_ctl.exe" : "pg_ctl");
    const initdb = path.join(dir, process.platform === "win32" ? "initdb.exe" : "initdb");
    if (existsSync(pgCtl) && existsSync(initdb)) {
      return { dir, pgCtl, initdb };
    }
  }
  throw new Error([
    "找不到 PostgreSQL 的 initdb / pg_ctl。",
    "请安装 PostgreSQL 18，或设置 DATABASE_URL 指向已有数据库。",
    "如果二进制不在 PATH，可设置 PG_BIN=<PostgreSQL bin 目录>。",
  ].join("\n"));
}

function isRunning(bin) {
  if (!existsSync(path.join(dataDir, "PG_VERSION"))) return false;
  const result = spawnSync(bin.pgCtl, ["-D", dataDir, "status"], { stdio: "ignore" });
  return result.status === 0;
}

export async function ensureLocalCluster() {
  const bin = findPgBin();
  mkdirSync(localDir, { recursive: true });

  if (!existsSync(path.join(dataDir, "PG_VERSION"))) {
    console.log("[db] 初始化本地 PostgreSQL 集群 .local/pgdata ...");
    run(bin.initdb, [
      "-D", dataDir,
      "-U", "postgres",
      "-A", "trust",
      "--encoding=UTF8",
      "--locale=C",
    ], { timeout: 120_000 });
    appendFileSync(path.join(dataDir, "postgresql.conf"), [
      "",
      "# jxc local dev cluster",
      `port = ${LOCAL_PG_PORT}`,
      "listen_addresses = '127.0.0.1'",
      "",
    ].join("\n"));
  }

  if (!isRunning(bin)) {
    console.log("[db] 启动本地 PostgreSQL（127.0.0.1:" + LOCAL_PG_PORT + "）...");
    run(bin.pgCtl, ["-D", dataDir, "-l", logFile, "-w", "start"], { timeout: 60_000 });
  }
  return { dataDir, port: LOCAL_PG_PORT };
}

export function stopLocalCluster() {
  if (!existsSync(path.join(dataDir, "PG_VERSION"))) {
    console.log("[db] 没有本地集群（.local/pgdata 不存在）。");
    return;
  }
  const bin = findPgBin();
  if (!isRunning(bin)) {
    console.log("[db] 本地集群已停止。");
    return;
  }
  run(bin.pgCtl, ["-D", dataDir, "-m", "fast", "-w", "stop"], { timeout: 60_000 });
  console.log("[db] 本地集群已停止。");
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const command = process.argv[2] ?? "start";
  try {
    if (command === "stop") {
      stopLocalCluster();
    } else if (command === "start") {
      const info = await ensureLocalCluster();
      console.log(`[db] 本地集群已在 ${info.port} 端口运行。`);
    } else if (command === "status") {
      const bin = findPgBin();
      console.log(isRunning(bin) ? "[db] 运行中。" : "[db] 未运行。");
    } else {
      throw new Error(`未知命令：${command}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}