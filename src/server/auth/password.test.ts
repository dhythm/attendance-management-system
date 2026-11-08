import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("verifies the original password", async () => {
    const stored = await hashPassword("correct horse battery");
    expect(await verifyPassword("correct horse battery", stored)).toBe(true);
  });

  it("rejects a different password", async () => {
    const stored = await hashPassword("correct horse battery");
    expect(await verifyPassword("wrong horse battery", stored)).toBe(false);
  });

  it("does not store the password and salts each hash", async () => {
    const a = await hashPassword("same password");
    const b = await hashPassword("same password");
    expect(a).not.toContain("same password");
    expect(a).not.toBe(b);
  });

  it("rejects a malformed stored hash instead of throwing", async () => {
    expect(await verifyPassword("anything", "not-a-hash")).toBe(false);
  });
});
