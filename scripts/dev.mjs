import { spawn } from "node:child_process";
import path from "node:path";
import { databaseName, repoRoot, resolveDatabaseUrl } from "./db/env.mjs";
import { ensureDatabase } from "./db/database.mjs";
import { migrateUp } from "./db/migrate.mjs";
import { seedDatabase } from "./db/seed.mjs";
import { nextBinary } from "./lib/next-bin.mjs";

try {
  const connectionString = await resolveDatabaseUrl({ bootstrapLocal: true });
  process.env.DATABASE_URL = connectionString;

  await ensureDatabase(connectionString);
  await migrateUp(connectionString);
  const summary = await seedDatabase(connectionString);

  console.log(`[dev] 数据库 ${databaseName(connectionString)} 已就绪。`);
  console.log(`[dev] 管理员账号：${process.env.SEED_ADMIN_USERNAME || "admin"}${summary.adminCreated ? "（本次创建，密码见 SEED_ADMIN_PASSWORD 或开发默认值）" : ""}`);

  const port = process.env.PORT || "3000";
  console.log(`[dev] 开发服务器：http://localhost:${port}`);

  const child = spawn(process.execPath, [nextBinary(), "dev", "-p", port], {
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
