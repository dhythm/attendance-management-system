import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { expect } from "vitest";
import { POST as signupHandler } from "@/app/api/auth/signup/route";

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

export async function signUp(overrides: Partial<Record<"loginId" | "password", string>> = {}) {
  const credentials = {
    loginId: overrides.loginId ?? uniqueLoginId(),
    password: overrides.password ?? "password-1234",
    displayName: "山田 太郎",
  };
  const result = await call(signupHandler, "/api/auth/signup", { body: credentials });
  expect(result.status).toBe(201);
  const cookie = sessionCookieFrom(result.response);
  if (!cookie) throw new Error("signup did not set a session cookie");
  return { ...credentials, cookie, user: result.json.user };
}
