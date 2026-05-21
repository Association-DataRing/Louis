import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

const useSsl =
  /sslmode=(require|prefer|verify-ca|verify-full|no-verify)/i.test(
    connectionString
  ) || process.env.DATABASE_SSL === "true";

// En prod managée (Scaleway/OVH/AWS RDS), on valide les certificats par
// défaut. Pour un Postgres self-hosted avec cert auto-signé, l'admin doit
// explicitement poser `DATABASE_SSL_REJECT_UNAUTHORIZED=false`.
const rejectUnauthorized =
  process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false";

const client = postgres(connectionString, {
  ssl: useSsl ? { rejectUnauthorized } : undefined,
});

export const db = drizzle(client, { schema });
