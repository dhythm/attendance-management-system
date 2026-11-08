import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { expect } from "vitest";
import { POST as loginHandler } from "@/app/api/auth/login/route";
import type { Role } from "@/domain/role";
import { hashPassword } from "@/server/auth/password";
import { closeDb, getDb } from "@/server/db/client";
import { createUser } from "@/server/repositories/users";

type Handler<P> = (request: NextRequest, ctx: { params: Promise<P> }) => Promise<Response>;

type RequestOptions = { method?: string; body?: unknown; cookie?: string | null; rawBody?: string };

export function request(path: string, options: RequestOptions = {}): NextRequest {
  const headers = new Headers();
  if (options.cookie) headers.set("cookie", options.cookie);
  let body: string | undefined;
  if (options.rawBody !== undefined) body = options.rawBody;
  else if (options.body !== undefined) body = JSON.stringify(options.body);
  if (body !== undefined) headers.set("content-type", "application/json");
  return new NextRequest(new URL(path, "http://localhost"), {
    method: options.method ?? (body === undefined ? "GET" : "POST"),
    headers,
    body,
  });
}

export async function call<P = Record<string, never>>(
  handler: Handler<P>,
  path: string,
  options: RequestOptions & { params?: P } = {},
) {
  const params = options.params ?? ({} as P);
  const response = await handler(request(path, options), { params: Promise.resolve(params) });
  const text = await response.text();
  return { response, status: response.status, json: text ? JSON.parse(text) : null };
}

export function sessionCookieFrom(response: Response): string | null {
  const header = response.headers.getSetCookie().find((c) => c.startsWith("session="));
  return header ? (header.split(";")[0] ?? null) : null;
}

export function uniqueLoginId(prefix = "user"): string {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}

export async function logIn(loginId: string, password: string): Promise<string> {
  const result = await call(loginHandler, "/api/auth/login", { body: { loginId, password } });
  expect(result.status).toBe(200);
  const cookie = sessionCookieFrom(result.response);
  if (!cookie) throw new Error("login did not set a session cookie");
  return cookie;
}

export async function createAccount(role: Role = "employee") {
  const loginId = uniqueLoginId(role);
  const password = "password-1234";
  const user = await createUser(await getDb(), {
    loginId,
    displayName: `${role} ${loginId}`,
    passwordHash: await hashPassword(password),
    role,
  });
  if (user === "LOGIN_ID_TAKEN") throw new Error(`login ID collision: ${loginId}`);
  return { loginId, password, user, cookie: await logIn(loginId, password) };
}

// PGlite memory:// is recreated on reconnect; PostgreSQL gets a throwaway migrated database.
export async function useFreshDatabase(): Promise<() => Promise<void>> {
  await closeDb();
  const serverUrl = process.env.DATABASE_URL;
  if (!serverUrl) return closeDb;

  const { Client, Pool } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { migrate } = await import("drizzle-orm/node-postgres/migrator");
  const name = `ams_test_${randomUUID().replaceAll("-", "")}`;
  const onServer = async (sql: string) => {
    const client = new Client({ connectionString: serverUrl });
    await client.connect();
    try {
      await client.query(sql);
    } finally {
      await client.end();
    }
  };

  await onServer(`CREATE DATABASE "${name}"`);
  const url = new URL(serverUrl);
  url.pathname = `/${name}`;
  const pool = new Pool({ connectionString: url.toString() });
  try {
    await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
  } finally {
    await pool.end();
  }
  process.env.DATABASE_URL = url.toString();

  return async () => {
    await closeDb();
    process.env.DATABASE_URL = serverUrl;
    await onServer(`DROP DATABASE "${name}" WITH (FORCE)`);
  };
}
