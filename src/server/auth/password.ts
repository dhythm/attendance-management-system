import { randomBytes, type ScryptOptions, scrypt, timingSafeEqual } from "node:crypto";

const PARAMS = { N: 16384, r: 8, p: 1 } as const;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

function derive(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, options, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await derive(password, salt, PARAMS);
  return [
    "scrypt",
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString("base64url"),
    key.toString("base64url"),
  ].join("$");
}

function parseStored(stored: string) {
  const [scheme, n, r, p, salt, key] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !key) return null;
  const options = { N: Number(n), r: Number(r), p: Number(p) };
  if (!Object.values(options).every(Number.isSafeInteger)) return null;
  return { options, salt: Buffer.from(salt, "base64url"), key: Buffer.from(key, "base64url") };
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parseStored(stored);
  if (!parsed || parsed.key.length !== KEY_LENGTH) return false;
  const candidate = await derive(password, parsed.salt, parsed.options);
  return timingSafeEqual(candidate, parsed.key);
}
