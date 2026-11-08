import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { expect } from "vitest";
import { POST as loginHandler } from "@/app/api/auth/login/route";
import type { Role } from "@/domain/role";
import { hashPassword } from "@/server/auth/password";
import { getDb } from "@/server/db/client";
import { createUser } from "@/server/repositories/users";

type Handler = (request: NextRequest) => Promise<Response>;

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

export async function call(handler: Handler, path: string, options: RequestOptions = {}) {
  const response = await handler(request(path, options));
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
