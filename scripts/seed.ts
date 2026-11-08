import { closeDb, getDb } from "@/server/db/client";
import { demoAccounts, readSeedPassword, seedDemoData } from "@/server/db/seed";

async function main() {
  const password = readSeedPassword(process.env);
  await seedDemoData(await getDb(), { password, now: new Date() });
  const loginIds = demoAccounts.map((a) => a.loginId).join(", ");
  console.log(`デモデータを投入しました（ログインID: ${loginIds}）`);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await closeDb();
}
