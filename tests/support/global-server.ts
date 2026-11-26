import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { testSetupEnv } from "./test-database";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const baseUrl = process.env.JXC_BASE_URL || "http://127.0.0.1:3101";

function newestMtime(target: string): number {
  const stat = statSync(target);
  if (!stat.isDirectory()) return stat.mtimeMs;
  return readdirSync(target).reduce((newest, entry) => {
    if (entry === "node_modules" || entry === ".next") return newest;
    return Math.max(newest, newestMtime(path.join(target, entry)));
  }, stat.mtimeMs);
}

function needsBuild(webRoot: string): boolean {
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

async function isHealthy(): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/api/health`);
    return response.ok;
  } catch {
    return false;
  }
}

function run(
  command: string,
  args: string[],
  { cwd = repoRoot, env = process.env }: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): void {
  const result = spawnSync(command, args, {
    cwd,
    env,
    stdio: "inherit",
    timeout: 300_000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`命令失败（退出码 ${result.status}）：${command} ${args.join(" ")}`);
  }
}

async function stop(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) return;
  child.kill();
  await new Promise((resolve) => setTimeout(resolve, 1_500));
  if (child.exitCode === null && process.platform === "win32" && child.pid) {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  }
}

export default async function setup() {
  if (await isHealthy()) return;

  if (!process.env.JXC_TEST_DATABASE_URL && !process.env.CI) {
    run(process.execPath, ["scripts/db/local-pg.mjs", "start"]);
  }
  run(process.execPath, ["scripts/db/setup.mjs"], { env: testSetupEnv() });
  const webRoot = path.join(repoRoot, "apps", "web");
  if (needsBuild(webRoot)) {
    const nextBinary = path.join(webRoot, "node_modules", "next", "dist", "bin", "next");
    run(process.execPath, [nextBinary, "build"], { cwd: webRoot });
  }

  let output = "";
  const child = spawn(process.execPath, ["scripts/server.mjs"], {
    cwd: repoRoot,
    env: { ...testSetupEnv(), PORT: "3101", JXC_INSECURE_COOKIES: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.on("data", (chunk: Buffer) => {
    output += chunk.toString();
    process.stdout.write(chunk);
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    output += chunk.toString();
    process.stderr.write(chunk);
  });

  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`HTTP 测试服务器提前退出：\n${output}`);
    }
    if (await isHealthy()) {
      return async () => { await stop(child); };
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  await stop(child);
  throw new Error(`HTTP 测试服务器未在 120 秒内就绪：\n${output}`);
}