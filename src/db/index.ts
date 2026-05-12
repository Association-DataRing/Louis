import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

const useSsl =
  /sslmode=(require|prefer|verify-ca|verify-full|no-verify)/i.test(
    connectionString
  ) || process.env.DATABASE_SSL === "true";

const client = postgres(connectionString, {
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
});

export const db = drizzle(client, { schema });
