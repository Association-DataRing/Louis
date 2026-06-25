"use server";

import type { ActionResult as BaseActionResult } from "@/lib/actions/result";

import { revalidatePath } from "next/cache";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/permissions";
import { db } from "@/db";
import {
  pipelineAgents,
  pipelines,
  type Pipeline,
  type PipelineAgent,
} from "@/db/schema";
import { findPreset, seedPresetsForUser } from "@/lib/orchestrator";

export type ActionResult = BaseActionResult;
export type ActionResultWith<T> = BaseActionResult<T>;

const pipelineMetaSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullable().optional(),
  mode: z.enum(["sequential", "council", "parallel", "iterative", "maestro"]).optional(),
  rounds: z.number().int().min(1).max(6).optional(),
});

const ragScopeSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("inherit") }),
  z.object({ mode: z.literal("none") }),
  z.object({ mode: z.literal("project") }),
  z.object({ mode: z.literal("folders"), folderIds: z.array(z.uuid()).max(50) }),
  z.object({
    mode: z.literal("documents"),
    documentIds: z.array(z.uuid()).max(200),
  }),
]);

const AGENT_ROLE_VALUES = [
  "default-chat",
  "orchestrator",
  "research",
  "drafting",
  "reviewer",
  "citator",
  "legifrance",
] as const;

const agentUpdateSchema = z.object({
  label: z.string().trim().min(1).max(80).optional(),
  role: z.enum(AGENT_ROLE_VALUES).optional(),
  providerKeyId: z.uuid().nullable().optional(),
  modelOverride: z.string().trim().max(120).nullable().optional(),
  systemPrompt: z.string().max(8000).nullable().optional(),
  toolAllowlist: z.array(z.string()).nullable().optional(),
  ragScope: ragScopeSchema.nullable().optional(),
  temperature: z.number().min(0).max(2).nullable().optional(),
});

const agentInsertSchema = z.object({
  role: z.enum(AGENT_ROLE_VALUES),
  label: z.string().trim().min(1).max(80),
  providerKeyId: z.uuid().nullable().optional(),
  modelOverride: z.string().trim().max(120).nullable().optional(),
  systemPrompt: z.string().max(8000).nullable().optional(),
  toolAllowlist: z.array(z.string()).nullable().optional(),
});

export interface PipelineWithAgents {
  pipeline: Pipeline;
  agents: PipelineAgent[];
}

export async function listPipelines(): Promise<PipelineWithAgents[]> {
  const userId = await requireUserId();
  const rows = await db
    .select()
    .from(pipelines)
    .where(eq(pipelines.userId, userId))
    .orderBy(asc(pipelines.isPreset), asc(pipelines.name));

  if (rows.length === 0) {
    await seedPresetsForUser(userId);
    return listPipelines();
  }

  const allAgents = await db
    .select()
    .from(pipelineAgents)
    .where(
      sql`${pipelineAgents.pipelineId} IN (${sql.join(
        rows.map((r) => sql`${r.id}`),
        sql`, `
      )})`
    )
    .orderBy(asc(pipelineAgents.position));

  return rows.map((p) => ({
    pipeline: p,
    agents: allAgents.filter((a) => a.pipelineId === p.id),
  }));
}

export async function getPipeline(id: string): Promise<PipelineWithAgents | null> {
  const userId = await requireUserId();
  const [pipeline] = await db
    .select()
    .from(pipelines)
    .where(and(eq(pipelines.id, id), eq(pipelines.userId, userId)))
    .limit(1);
  if (!pipeline) return null;

  const agents = await db
    .select()
    .from(pipelineAgents)
    .where(eq(pipelineAgents.pipelineId, pipeline.id))
    .orderBy(asc(pipelineAgents.position));

  return { pipeline, agents };
}

export async function clonePipeline(
  sourceId: string,
  newName?: string
): Promise<ActionResultWith<{ id: string }>> {
  const userId = await requireUserId();
  const source = await getPipeline(sourceId);
  if (!source) return { ok: false, error: "Pipeline source introuvable." };

  const baseName = newName ?? `${source.pipeline.name} (copie)`;
  const slug = await uniqueSlug(userId, source.pipeline.slug);

  // Transaction : pipeline + ses agents insérés atomiquement, sinon un échec
  // après l'insert du pipeline laisse un pipeline sans aucun agent.
  const newId = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(pipelines)
      .values({
        userId,
        slug,
        name: baseName,
        description: source.pipeline.description,
        isPreset: false,
      })
      .returning({ id: pipelines.id });

    if (source.agents.length > 0) {
      await tx.insert(pipelineAgents).values(
        source.agents.map((a, i) => ({
          pipelineId: created.id,
          role: a.role,
          label: a.label,
          providerKeyId: a.providerKeyId,
          modelOverride: a.modelOverride,
          systemPrompt: a.systemPrompt,
          toolAllowlist: a.toolAllowlist,
          position: i,
        }))
      );
    }
    return created.id;
  });

  revalidatePath("/board");
  return { ok: true, id: newId };
}

export async function clonePresetBySlug(
  slug: string
): Promise<ActionResultWith<{ id: string }>> {
  const userId = await requireUserId();
  const preset = findPreset(slug);
  if (!preset) return { ok: false, error: "Preset inconnu." };

  const newSlug = await uniqueSlug(userId, slug);

  // Transaction : pipeline + agents atomiques (cf. clonePipeline).
  const newId = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(pipelines)
      .values({
        userId,
        slug: newSlug,
        name: `${preset.name} (copie)`,
        description: preset.description,
        isPreset: false,
        mode: preset.mode ?? "sequential",
        rounds: preset.rounds ?? 1,
      })
      .returning({ id: pipelines.id });

    if (preset.agents.length > 0) {
      await tx.insert(pipelineAgents).values(
        preset.agents.map((a, i) => ({
          pipelineId: created.id,
          role: a.role,
          label: a.label,
          providerKeyId: null,
          modelOverride: null,
          systemPrompt: a.systemPrompt ?? null,
          toolAllowlist:
            a.toolAllowlist === undefined ? null : a.toolAllowlist,
          position: i,
        }))
      );
    }
    return created.id;
  });

  revalidatePath("/board");
  return { ok: true, id: newId };
}

export async function updatePipelineMeta(
  id: string,
  data: {
    name: string;
    description?: string | null;
    mode?: "sequential" | "council" | "parallel" | "iterative" | "maestro";
    rounds?: number;
  }
): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = pipelineMetaSchema.safeParse(data);
  if (!parsed.success) return { ok: false, error: "Champs invalides." };

  await db
    .update(pipelines)
    .set({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      ...(parsed.data.mode !== undefined && { mode: parsed.data.mode }),
      ...(parsed.data.rounds !== undefined && { rounds: parsed.data.rounds }),
      updatedAt: new Date(),
    })
    .where(and(eq(pipelines.id, id), eq(pipelines.userId, userId)));

  revalidatePath("/board");
  revalidatePath(`/board/${id}`);
  revalidatePath("/chat");
  return { ok: true };
}

export async function deletePipeline(id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  // Garde-fou : on refuse de supprimer le dernier pipeline restant à
  // l'utilisateur — sinon plus rien à exécuter dans le chat.
  const count = await db.$count(pipelines, eq(pipelines.userId, userId));
  if (count <= 1) {
    return {
      ok: false,
      error: "Impossible de supprimer votre dernière pipeline.",
    };
  }
  await db
    .delete(pipelines)
    .where(and(eq(pipelines.id, id), eq(pipelines.userId, userId)));
  revalidatePath("/board");
  revalidatePath("/chat");
  return { ok: true };
}

export async function updatePipelineAgent(
  agentId: string,
  data: z.infer<typeof agentUpdateSchema>
): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = agentUpdateSchema.safeParse(data);
  if (!parsed.success) return { ok: false, error: "Champs invalides." };

  const [owned] = await db
    .select({ id: pipelineAgents.id })
    .from(pipelineAgents)
    .innerJoin(pipelines, eq(pipelines.id, pipelineAgents.pipelineId))
    .where(and(eq(pipelineAgents.id, agentId), eq(pipelines.userId, userId)))
    .limit(1);
  if (!owned) return { ok: false, error: "Agent introuvable." };

  await db
    .update(pipelineAgents)
    .set({
      ...(parsed.data.label !== undefined && { label: parsed.data.label }),
      ...(parsed.data.role !== undefined && { role: parsed.data.role }),
      ...(parsed.data.providerKeyId !== undefined && {
        providerKeyId: parsed.data.providerKeyId,
      }),
      ...(parsed.data.modelOverride !== undefined && {
        modelOverride: parsed.data.modelOverride,
      }),
      ...(parsed.data.systemPrompt !== undefined && {
        systemPrompt: parsed.data.systemPrompt,
      }),
      ...(parsed.data.toolAllowlist !== undefined && {
        toolAllowlist: parsed.data.toolAllowlist,
      }),
      ...(parsed.data.ragScope !== undefined && {
        ragScope: parsed.data.ragScope,
      }),
      ...(parsed.data.temperature !== undefined && {
        temperature: parsed.data.temperature,
      }),
      updatedAt: new Date(),
    })
    .where(eq(pipelineAgents.id, agentId));

  revalidatePath("/board");
  return { ok: true };
}

export async function addAgentToPipeline(
  pipelineId: string,
  data: z.infer<typeof agentInsertSchema>
): Promise<ActionResultWith<{ id: string }>> {
  const userId = await requireUserId();
  const parsed = agentInsertSchema.safeParse(data);
  if (!parsed.success) return { ok: false, error: "Champs invalides." };

  const [pipeline] = await db
    .select({ id: pipelines.id })
    .from(pipelines)
    .where(and(eq(pipelines.id, pipelineId), eq(pipelines.userId, userId)))
    .limit(1);
  if (!pipeline) return { ok: false, error: "Pipeline introuvable." };

  const maxPos = await db
    .select({ p: sql<number>`coalesce(max(${pipelineAgents.position}), -1)` })
    .from(pipelineAgents)
    .where(eq(pipelineAgents.pipelineId, pipelineId));
  const nextPos = (maxPos[0]?.p ?? -1) + 1;

  const [row] = await db
    .insert(pipelineAgents)
    .values({
      pipelineId,
      role: parsed.data.role,
      label: parsed.data.label,
      providerKeyId: parsed.data.providerKeyId ?? null,
      modelOverride: parsed.data.modelOverride ?? null,
      systemPrompt: parsed.data.systemPrompt ?? null,
      toolAllowlist: parsed.data.toolAllowlist ?? null,
      position: nextPos,
    })
    .returning({ id: pipelineAgents.id });

  revalidatePath("/board");
  return { ok: true, id: row.id };
}

export async function removeAgentFromPipeline(
  agentId: string
): Promise<ActionResult> {
  const userId = await requireUserId();
  const [owned] = await db
    .select({
      id: pipelineAgents.id,
      pipelineId: pipelineAgents.pipelineId,
    })
    .from(pipelineAgents)
    .innerJoin(pipelines, eq(pipelines.id, pipelineAgents.pipelineId))
    .where(and(eq(pipelineAgents.id, agentId), eq(pipelines.userId, userId)))
    .limit(1);
  if (!owned) return { ok: false, error: "Agent introuvable." };

  const remaining = await db.$count(
    pipelineAgents,
    eq(pipelineAgents.pipelineId, owned.pipelineId)
  );
  if (remaining <= 1) {
    return {
      ok: false,
      error: "Une pipeline doit contenir au moins un agent.",
    };
  }

  await db.delete(pipelineAgents).where(eq(pipelineAgents.id, agentId));
  revalidatePath("/board");
  return { ok: true };
}

export async function reorderPipelineAgents(
  pipelineId: string,
  agentIds: string[]
): Promise<ActionResult> {
  const userId = await requireUserId();
  const [pipeline] = await db
    .select({ id: pipelines.id })
    .from(pipelines)
    .where(and(eq(pipelines.id, pipelineId), eq(pipelines.userId, userId)))
    .limit(1);
  if (!pipeline) return { ok: false, error: "Pipeline introuvable." };

  for (let i = 0; i < agentIds.length; i++) {
    await db
      .update(pipelineAgents)
      .set({ position: i, updatedAt: new Date() })
      .where(
        and(
          eq(pipelineAgents.id, agentIds[i]),
          eq(pipelineAgents.pipelineId, pipelineId)
        )
      );
  }
  revalidatePath("/board");
  return { ok: true };
}

/**
 * Persiste les coordonnées custom d'un agent sur le canvas. Appelé en
 * onNodeDragStop. Pas de revalidate (le client a déjà la nouvelle
 * position en state local) : on évite un round-trip et un flash visuel.
 */
export async function updateAgentCanvasPosition(
  agentId: string,
  x: number,
  y: number
): Promise<ActionResult> {
  const userId = await requireUserId();
  const [agent] = await db
    .select({
      id: pipelineAgents.id,
      pipelineUserId: pipelines.userId,
      isPreset: pipelines.isPreset,
    })
    .from(pipelineAgents)
    .innerJoin(pipelines, eq(pipelines.id, pipelineAgents.pipelineId))
    .where(eq(pipelineAgents.id, agentId))
    .limit(1);
  if (!agent || agent.pipelineUserId !== userId) {
    return { ok: false, error: "Agent introuvable." };
  }
  if (agent.isPreset) {
    return { ok: false, error: "Pipeline système — clonez avant d'éditer." };
  }
  await db
    .update(pipelineAgents)
    .set({ canvasX: x, canvasY: y, updatedAt: new Date() })
    .where(eq(pipelineAgents.id, agentId));
  return { ok: true };
}

/**
 * Remet à zéro les positions custom de tous les agents → ils reprennent
 * le layout automatique calculé selon le mode du pipeline.
 */
export async function resetPipelineLayout(
  pipelineId: string
): Promise<ActionResult> {
  const userId = await requireUserId();
  const [pipeline] = await db
    .select({ id: pipelines.id, isPreset: pipelines.isPreset })
    .from(pipelines)
    .where(and(eq(pipelines.id, pipelineId), eq(pipelines.userId, userId)))
    .limit(1);
  if (!pipeline) return { ok: false, error: "Pipeline introuvable." };
  if (pipeline.isPreset) {
    return { ok: false, error: "Pipeline système — clonez avant d'éditer." };
  }
  await db
    .update(pipelineAgents)
    .set({ canvasX: null, canvasY: null, updatedAt: new Date() })
    .where(eq(pipelineAgents.pipelineId, pipelineId));
  revalidatePath("/board");
  return { ok: true };
}

async function uniqueSlug(userId: string, base: string): Promise<string> {
  let slug = base;
  let n = 2;
  while (true) {
    const [hit] = await db
      .select({ id: pipelines.id })
      .from(pipelines)
      .where(and(eq(pipelines.userId, userId), eq(pipelines.slug, slug)))
      .limit(1);
    if (!hit) return slug;
    slug = `${base}-${n++}`;
  }
}
