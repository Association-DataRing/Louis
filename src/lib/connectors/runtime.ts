import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { connectorKeys, type ConnectorKey } from "@/db/schema";
import { decrypt } from "@/lib/crypto";
import type { ConnectorType } from "./catalog";

/**
 * Load and decrypt connector credentials for a given user + type.
 * Returns the first active row, or null when no matching connector is set up.
 */
export async function loadConnectorCredentials<T extends Record<string, string>>(
  userId: string,
  type: ConnectorType
): Promise<{ key: ConnectorKey; credentials: T } | null> {
  const [key] = await db
    .select()
    .from(connectorKeys)
    .where(
      and(
        eq(connectorKeys.userId, userId),
        eq(connectorKeys.type, type),
        eq(connectorKeys.isActive, true)
      )
    )
    .limit(1);

  if (!key) return null;

  const json = decrypt({
    ciphertext: key.credentialsCiphertext,
    iv: key.credentialsIv,
    tag: key.credentialsTag,
  });

  return { key, credentials: JSON.parse(json) as T };
}

export async function listActiveConnectorTypes(
  userId: string
): Promise<ConnectorType[]> {
  const rows = await db
    .select({ type: connectorKeys.type })
    .from(connectorKeys)
    .where(
      and(
        eq(connectorKeys.userId, userId),
        eq(connectorKeys.isActive, true)
      )
    );
  return Array.from(new Set(rows.map((r) => r.type)));
}
