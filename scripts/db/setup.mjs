import { databaseName, resolveDatabaseUrl } from "./env.mjs";
import { ensureDatabase } from "./database.mjs";
import { migrateUp } from "./migrate.mjs";
import { seedDatabase } from "./seed.mjs";

try {
  const connectionString = await resolveDatabaseUrl({ bootstrapLocal: true });
  await ensureDatabase(connectionString);
  await migrateUp(connectionString);
  const summary = await seedDatabase(connectionString);
  console.log(
    `[db] 就绪：${databaseName(connectionString)}（管理员${summary.adminCreated ? "已创建" : "已存在"}，单位 ${summary.counts.unit} 个）`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
}