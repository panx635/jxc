import { Pool, type QueryResult, type QueryResultRow } from "pg";

const globalForDb = globalThis as unknown as { jxcPool?: Pool };

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("缺少 DATABASE_URL：应用无法连接 PostgreSQL。");
  }
  return url;
}

export function getPool(): Pool {
  if (!globalForDb.jxcPool) {
    const pool = new Pool({
      connectionString: connectionString(),
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    pool.on("error", (error) => {
      console.error("[db] idle client error", error);
    });
    globalForDb.jxcPool = pool;
  }
  return globalForDb.jxcPool;
}

export async function query<T extends QueryResultRow>(
  text: string,
  values: unknown[] = [],
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, values);
}
