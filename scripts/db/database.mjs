import pg from "pg";
import { parseDatabaseUrl, withDatabaseName } from "./env.mjs";

const { Client } = pg;

function quoteIdentifier(identifier) {
  return '"' + String(identifier).replaceAll('"', '""') + '"';
}

export function maintenanceUrl(connectionString) {
  return withDatabaseName(connectionString, "postgres");
}

async function connect(connectionString) {
  const client = new Client({ connectionString, connectionTimeoutMillis: 5_000 });
  await client.connect();
  return client;
}

export async function ensureDatabase(connectionString) {
  const { database } = parseDatabaseUrl(connectionString);
  const client = await connect(maintenanceUrl(connectionString));
  try {
    const { rowCount } = await client.query("select 1 from pg_database where datname = $1", [database]);
    if (rowCount === 0) {
      await client.query(`create database ${quoteIdentifier(database)}`);
      console.log(`[db] 创建数据库 ${database}`);
    }
  } finally {
    await client.end();
  }
}

export async function dropDatabase(connectionString) {
  const { database } = parseDatabaseUrl(connectionString);
  const client = await connect(maintenanceUrl(connectionString));
  try {
    await client.query(`drop database if exists ${quoteIdentifier(database)} with (force)`);
  } finally {
    await client.end();
  }
}

export async function withClient(connectionString, fn) {
  const client = await connect(connectionString);
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

export async function tableNames(connectionString) {
  return withClient(connectionString, async (client) => {
    const { rows } = await client.query(
      "select table_name from information_schema.tables where table_schema = 'public' order by table_name",
    );
    return rows.map((row) => row.table_name);
  });
}
