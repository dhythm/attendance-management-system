import { afterAll, beforeAll } from "vitest";
import { closeDb, getDb } from "@/server/db/client";

// Booting PGlite and migrating takes seconds when many files start at once; keep it out of the
// first test's timeout.
beforeAll(() => getDb(), 60_000);
afterAll(closeDb);
