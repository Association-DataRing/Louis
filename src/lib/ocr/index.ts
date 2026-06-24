import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { ocrSettings, providerKeys } from "@/db/schema";
import type { ProviderType } from "@/lib/providers/catalog";
import { log } from "@/lib/log";
import { loadMistralKey, ocrWithMistral } from "./mistral";
import { ocrWithVision } from "./vision-llm";
import { ocrWithTesseract } from "./tesseract";

/**
 * OCR pluggable d'un PDF scanné → Markdown. Une part énorme des pièces
 * juridiques françaises arrive en PDF scanné (assignations, jugements
 * signifiés, contrats manuscrits, PV d'huissier) ; sans OCR elles sont
 * rejetées à l'upload, donc invisibles au RAG et à l'analyse tabulaire.
 *
 * Stratégie (mode `auto` par défaut, surchargeable par utilisateur via
 * `ocr_settings`) :
 * 1. Mistral OCR dédié si une clé Mistral est active (qualité élevée) ;
 * 2. sinon OCR par modèle de vision via une clé dispo (OpenRouter/OpenAI/… —
 *    ex. Pixtral via OpenRouter) ;
 * 3. sinon Tesseract local (souverain, gratuit, hors-ligne).
 *
 * Jamais bloquant : à défaut de tout, Tesseract prend le relais. `degraded`
 * signale qu'on est tombé sur Tesseract faute de clé, pour informer l'UI.
 */

export type OcrEngine = "mistral" | "vision" | "tesseract";

export type OcrResult = {
  text: string;
  engine: OcrEngine;
  /** Vrai si on a dû retomber sur Tesseract faute de meilleure voie configurée. */
  degraded: boolean;
};

export type OcrPlan = {
  engine: OcrEngine;
  degraded: boolean;
  /** Détails du moteur retenu, pour affichage UI. */
  providerKeyId?: string;
  providerType?: ProviderType;
  modelId?: string;
};

// Modèles de vision par défaut (mode auto) pour les providers fiablement
// multimodaux. OpenRouter pointe sur Pixtral — le modèle vision de Mistral,
// ce qui colle à « passer par Mistral via OpenRouter ».
const AUTO_VISION_MODEL: Partial<Record<ProviderType, string>> = {
  openrouter: "mistralai/pixtral-large-2411",
  openai: "gpt-4o",
  anthropic: "claude-sonnet-4-7",
};
// Ordre de préférence quand plusieurs clés vision sont actives (mode auto).
const AUTO_VISION_ORDER: ProviderType[] = ["openrouter", "openai", "anthropic"];

type ActiveKey = { id: string; type: ProviderType; label: string };

async function loadActiveKeys(userId: string): Promise<ActiveKey[]> {
  const rows = await db
    .select({
      id: providerKeys.id,
      type: providerKeys.type,
      label: providerKeys.label,
    })
    .from(providerKeys)
    .where(
      and(eq(providerKeys.userId, userId), eq(providerKeys.isActive, true))
    )
    .orderBy(desc(providerKeys.isDefault), desc(providerKeys.createdAt));
  return rows as ActiveKey[];
}

/**
 * Détermine, sans l'exécuter, quel moteur OCR serait utilisé pour cet
 * utilisateur. Sert à l'affichage du réglage (page Paramètres → OCR).
 */
export async function planOcr(userId: string): Promise<OcrPlan> {
  const [setting] = await db
    .select()
    .from(ocrSettings)
    .where(eq(ocrSettings.userId, userId))
    .limit(1);
  const mode = setting?.mode ?? "auto";
  const keys = await loadActiveKeys(userId);

  if (mode === "tesseract") {
    return { engine: "tesseract", degraded: false };
  }

  if (mode === "mistral") {
    const has = keys.some((k) => k.type === "mistral");
    return has
      ? { engine: "mistral", degraded: false, providerType: "mistral" }
      : { engine: "tesseract", degraded: true };
  }

  if (mode === "vision") {
    const key =
      setting?.providerKeyId &&
      keys.find((k) => k.id === setting.providerKeyId);
    if (key && setting?.modelId) {
      return {
        engine: "vision",
        degraded: false,
        providerKeyId: key.id,
        providerType: key.type,
        modelId: setting.modelId,
      };
    }
    return { engine: "tesseract", degraded: true };
  }

  // mode "auto" : Mistral OCR → vision (clé dispo) → Tesseract.
  if (keys.some((k) => k.type === "mistral")) {
    return { engine: "mistral", degraded: false, providerType: "mistral" };
  }
  for (const type of AUTO_VISION_ORDER) {
    const key = keys.find((k) => k.type === type);
    const model = AUTO_VISION_MODEL[type];
    if (key && model) {
      return {
        engine: "vision",
        degraded: false,
        providerKeyId: key.id,
        providerType: type,
        modelId: model,
      };
    }
  }
  return { engine: "tesseract", degraded: true };
}

/** Renvoie le texte OCR (Markdown) d'un PDF selon le plan, avec repli robuste. */
export async function ocrPdf(
  userId: string,
  buffer: Buffer
): Promise<OcrResult> {
  const plan = await planOcr(userId);

  try {
    if (plan.engine === "mistral") {
      const apiKey = await loadMistralKey(userId);
      if (apiKey) {
        return {
          text: await ocrWithMistral(apiKey, buffer),
          engine: "mistral",
          degraded: false,
        };
      }
    } else if (plan.engine === "vision" && plan.providerKeyId && plan.modelId) {
      return {
        text: await ocrWithVision(
          userId,
          buffer,
          plan.providerKeyId,
          plan.modelId
        ),
        engine: "vision",
        degraded: false,
      };
    }
  } catch (err) {
    // Moteur préféré configuré mais en échec (quota, réseau, modèle non
    // multimodal…) : on bascule sur Tesseract plutôt que d'abandonner la pièce.
    log.warn("ocr", `${plan.engine} OCR failed, falling back to Tesseract`, {
      error: err instanceof Error ? err.message : err,
    });
    const text = await ocrWithTesseract(buffer);
    return { text, engine: "tesseract", degraded: true };
  }

  // Voie par défaut / repli souverain.
  const text = await ocrWithTesseract(buffer);
  return { text, engine: "tesseract", degraded: plan.degraded };
}
