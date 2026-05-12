/**
 * One-shot DB setup : enables required Postgres extensions then runs
 * drizzle-kit push to apply the schema. Idempotent.
 *
 * Usage: npm run db:setup
 */
import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "../src/db";

async function main() {
  console.log("Enabling pgvector extension…");
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);
  console.log("Done. Run `npm run db:push` next to push the schema.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
