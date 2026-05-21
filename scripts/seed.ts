/**
 * Seed initial admin user.
 *
 * Usage (generate a strong random password):
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD="$(openssl rand -base64 16)" npm run db:seed
 *
 * Requires DATABASE_URL in .env. Idempotent: upserts on email conflict.
 *
 * SECURITY: never deploy with a hard-coded password. The seed accepts any
 * value but you are responsible for choosing one with sufficient entropy.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { users } from "../src/db/schema";

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "admin@louis.local";
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME ?? "Admin";

  if (!password) {
    console.error(
      "ADMIN_PASSWORD is required. Generate a strong one with:\n" +
        '  ADMIN_PASSWORD="$(openssl rand -base64 16)" npm run db:seed'
    );
    process.exit(1);
  }

  if (password.length < 12) {
    console.error(
      "ADMIN_PASSWORD must be at least 12 characters. Generate a strong one with:\n" +
        '  ADMIN_PASSWORD="$(openssl rand -base64 16)" npm run db:seed'
    );
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    await db
      .update(users)
      .set({ passwordHash, name, isActive: true, role: "admin" })
      .where(eq(users.id, existing.id));
    console.log(`Updated existing admin: ${email}`);
  } else {
    await db
      .insert(users)
      .values({ email, name, passwordHash, role: "admin" });
    console.log(`Created admin: ${email}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
