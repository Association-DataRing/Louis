import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  pipelineAgents,
  pipelines,
  providerKeys,
  type Pipeline,
} from "@/db/schema";
import { PIPELINE_PRESETS } from "./presets";

/**
 * Sème les pipelines préfabriqués pour un utilisateur — appelé au premier
 * login et idempotent : on crée uniquement les slugs encore absents. La
 * provider key par défaut de l'utilisateur sert d'allocation initiale
 * pour chaque agent ; l'utilisateur peut ensuite réattribuer dans /board.
 */
export async function seedPresetsForUser(userId: string): Promise<Pipeline[]> {
  const existing = await db
    .select({ slug: pipelines.slug })
    .from(pipelines)
    .where(eq(pipelines.userId, userId));
  const existingSlugs = new Set(existing.map((e) => e.slug));

  const [defaultKey] = await db
    .select()
    .from(providerKeys)
    .where(
      and(
        eq(providerKeys.userId, userId),
        eq(providerKeys.isActive, true),
        eq(providerKeys.isDefault, true)
      )
    )
    .limit(1);
  const fallbackProviderKeyId = defaultKey?.id ?? null;

  const created: Pipeline[] = [];

  for (const preset of PIPELINE_PRESETS) {
    if (existingSlugs.has(preset.slug)) continue;

    const [row] = await db
      .insert(pipelines)
      .values({
        userId,
        slug: preset.slug,
        name: preset.name,
        description: preset.description,
        isPreset: true,
        mode: preset.mode ?? "sequential",
        rounds: preset.rounds ?? 1,
      })
      .returning();
    created.push(row);

    if (preset.agents.length > 0) {
      await db.insert(pipelineAgents).values(
        preset.agents.map((agent, position) => ({
          pipelineId: row.id,
          role: agent.role,
          label: agent.label,
          providerKeyId: fallbackProviderKeyId,
          modelOverride: null,
          systemPrompt: agent.systemPrompt ?? null,
          toolAllowlist:
            agent.toolAllowlist === undefined ? null : agent.toolAllowlist,
          position,
        }))
      );
    }
  }

  return created;
}
