import path from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

type DbHandle = { db: Db; close: () => Promise<void> };

const migrationsFolder = path.join(process.cwd(), "drizzle");

async function connectPostgres(url: string): Promise<DbHandle> {
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: url });
  return { db: drizzle(pool, { schema }), close: () => pool.end() };
}

async function connectPglite(dataDir: string): Promise<DbHandle> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const client = new PGlite(dataDir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder });
  return { db, close: () => client.close() };
}

function connect(): Promise<DbHandle> {
  const url = process.env.DATABASE_URL;
  if (url) return connectPostgres(url);
  return connectPglite(process.env.PGLITE_DATA_DIR || "memory://");
}

const globalKey = Symbol.for("attendance-management-system.db");
type GlobalWithDb = typeof globalThis & { [globalKey]?: Promise<DbHandle> };
const holder = globalThis as GlobalWithDb;

function handle(): Promise<DbHandle> {
  if (!holder[globalKey]) {
    holder[globalKey] = connect().catch((error: unknown) => {
      delete holder[globalKey];
      throw error;
    });
  }
  return holder[globalKey];
}

export async function getDb(): Promise<Db> {
  return (await handle()).db;
}

export async function closeDb(): Promise<void> {
  const pending = holder[globalKey];
  if (!pending) return;
  delete holder[globalKey];
  await (await pending).close();
}
