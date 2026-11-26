import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { repoRoot } from "./db/env.mjs";

function run(command, args, cwd = repoRoot) {
  const result = spawnSync(command, args, {
    cwd,
    env: process.env,
    stdio: "inherit",
    timeout: 300_000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`命令失败（退出码 ${result.status}）：${command} ${args.join(" ")}`);
}

try {
  run(process.execPath, ["scripts/db/setup.mjs"]);
  const webRoot = path.join(repoRoot, "apps", "web");
  if (!existsSync(path.join(webRoot, ".next", "BUILD_ID"))) {
    const nextBinary = path.join(webRoot, "node_modules", "next", "dist", "bin", "next");
    run(process.execPath, [nextBinary, "build"], webRoot);
  }
} catch (error) {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
}