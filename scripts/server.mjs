import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { resolveDatabaseUrl, repoRoot } from "./db/env.mjs";
import { nextBinary } from "./lib/next-bin.mjs";

try {
  const buildId = path.join(repoRoot, "apps", "web", ".next", "BUILD_ID");
  if (!existsSync(buildId)) {
    throw new Error("还没有生产构建。请先运行 `pnpm build`。");
  }

  const connectionString = await resolveDatabaseUrl({ bootstrapLocal: false });
  process.env.DATABASE_URL = connectionString;

  const port = process.env.PORT || "3000";
  const child = spawn(process.execPath, [nextBinary(), "start", "-p", port], {
    cwd: path.join(repoRoot, "apps", "web"),
    stdio: "inherit",
    env: process.env,
  });
  child.on("exit", (code) => {
    process.exitCode = code ?? 0;
  });
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => child.kill());
  }
} catch (error) {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
}
