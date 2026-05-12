"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { deleteObject } from "@/lib/storage";

export async function deleteDocument(id: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const userId = session.user.id;

  const [doc] = await db
    .select({ storageKey: documents.storageKey })
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.userId, userId)))
    .limit(1);

  if (!doc) return;

  await db
    .delete(documents)
    .where(and(eq(documents.id, id), eq(documents.userId, userId)));

  await deleteObject(doc.storageKey).catch(() => {
    // Object may already be gone — DB delete is the source of truth.
  });

  revalidatePath("/documents");
  revalidatePath("/chat");
}
