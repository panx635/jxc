import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { repoRoot } from "./db/env.mjs";

function run(command, args, cwd = repoRoot, env = process.env) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    stdio: "inherit",
    timeout: 300_000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`命令失败（退出码 ${result.status}）：${command} ${args.join(" ")}`);
}

const LOCAL_TEST_DATABASE_URL = "postgresql://postgres@127.0.0.1:55432/jxc_test";
const testDatabaseUrl =
  process.env.JXC_TEST_DATABASE_URL ||
  (process.env.CI && process.env.DATABASE_URL) ||
  LOCAL_TEST_DATABASE_URL;
const setupEnv = {
  ...process.env,
  DATABASE_URL: testDatabaseUrl,
  SEED_ADMIN_USERNAME: process.env.SEED_ADMIN_USERNAME || "admin",
  SEED_ADMIN_PASSWORD: process.env.SEED_ADMIN_PASSWORD || "admin12345",
  SEED_ADMIN_DISPLAY_NAME: process.env.SEED_ADMIN_DISPLAY_NAME || "管理员",
};

function newestMtime(target) {
  const stat = statSync(target);
  if (!stat.isDirectory()) return stat.mtimeMs;
  return readdirSync(target).reduce((newest, entry) => {
    if (entry === "node_modules" || entry === ".next") return newest;
    return Math.max(newest, newestMtime(path.join(target, entry)));
  }, stat.mtimeMs);
}

function needsBuild(webRoot) {
  const buildId = path.join(webRoot, ".next", "BUILD_ID");
  if (!existsSync(buildId)) return true;
  const builtAt = statSync(buildId).mtimeMs;
  return [
    path.join(webRoot, "src"),
    path.join(webRoot, "next.config.ts"),
    path.join(webRoot, "tsconfig.json"),
    path.join(repoRoot, "packages"),
    path.join(repoRoot, "pnpm-lock.yaml"),
  ].some((target) => newestMtime(target) > builtAt);
}

try {
  if (!process.env.JXC_TEST_DATABASE_URL && !process.env.CI) {
    run(process.execPath, ["scripts/db/local-pg.mjs", "start"]);
  }
  run(process.execPath, ["scripts/db/setup.mjs"], repoRoot, setupEnv);
  const webRoot = path.join(repoRoot, "apps", "web");
  if (needsBuild(webRoot)) {
    const nextBinary = path.join(webRoot, "node_modules", "next", "dist", "bin", "next");
    run(process.execPath, [nextBinary, "build"], webRoot);
  }
} catch (error) {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
}