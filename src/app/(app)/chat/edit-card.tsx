"use client";

import { useState } from "react";
import {
  IconCheck,
  IconCopy,
  IconPencil,
  IconX,
} from "@tabler/icons-react";

/**
 * Carte d'édition rendue à partir d'un bloc Markdown ```edit ... ```.
 *
 * Convention attendue dans la sortie du modèle :
 * ```edit
 * ::before
 * texte original
 * ::after
 * texte proposé
 * ::reason (optionnel)
 * justification courte
 * ```
 *
 * Côté ergonomie : on n'applique pas l'édition à un document réel — Louis
 * propose une réécriture, l'utilisateur la copie ou la rejette. C'est
 * suffisant pour le use-case juridique (rédaction de clauses, refonte d'un
 * paragraphe) sans introduire la complexité d'éditer un PDF source.
 */
export function EditCard({ raw }: { raw: string }) {
  const parsed = parseEditBlock(raw);
  const [decision, setDecision] = useState<"none" | "kept" | "rejected">(
    "none"
  );
  const [copied, setCopied] = useState(false);

  if (!parsed) return null;

  async function copyAfter() {
    try {
      await navigator.clipboard.writeText(parsed!.after);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard refused (permission) — fallback silently
    }
  }

  if (decision === "rejected") {
    return (
      <div className="not-prose my-3 rounded-md border border-border bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
        Suggestion ignorée.
      </div>
    );
  }

  return (
    <div className="not-prose my-4 rounded-lg border border-border bg-card overflow-hidden">
      <header className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <IconPencil className="size-3.5" />
          Suggestion d&apos;édition
        </div>
        {decision === "kept" && (
          <span className="text-[10px] uppercase tracking-wider text-primary font-medium">
            ✓ Conservée
          </span>
        )}
      </header>

      <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border">
        <section className="p-4 bg-destructive/5">
          <div className="text-[10px] uppercase tracking-wider text-destructive/80 font-semibold mb-1.5">
            Avant
          </div>
          <pre className="font-mono whitespace-pre-wrap text-xs leading-relaxed text-foreground/80">
            {parsed.before || <em className="text-muted-foreground">(vide)</em>}
          </pre>
        </section>
        <section className="p-4 bg-primary/5">
          <div className="text-[10px] uppercase tracking-wider text-primary font-semibold mb-1.5">
            Après
          </div>
          <pre className="font-mono whitespace-pre-wrap text-xs leading-relaxed text-foreground">
            {parsed.after || <em className="text-muted-foreground">(vide)</em>}
          </pre>
        </section>
      </div>

      {parsed.reason && (
        <p className="px-4 py-2 text-xs text-muted-foreground border-t border-border">
          <span className="font-medium text-foreground">Raison :</span>{" "}
          {parsed.reason}
        </p>
      )}

      <footer className="flex items-center justify-end gap-2 border-t border-border bg-muted/30 px-3 py-2">
        <button
          type="button"
          onClick={() => setDecision("rejected")}
          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
        >
          <IconX className="size-3.5" />
          Ignorer
        </button>
        <button
          type="button"
          onClick={copyAfter}
          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs hover:bg-accent transition-colors"
        >
          <IconCopy className="size-3.5" />
          {copied ? "Copié" : "Copier"}
        </button>
        <button
          type="button"
          onClick={() => {
            void copyAfter();
            setDecision("kept");
          }}
          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <IconCheck className="size-3.5" />
          Accepter et copier
        </button>
      </footer>
    </div>
  );
}

type ParsedEdit = { before: string; after: string; reason?: string };

function parseEditBlock(raw: string): ParsedEdit | null {
  // Tolère :: markers en début de ligne, capture chaque section.
  const pattern = /::(before|after|reason)\s*\n([\s\S]*?)(?=\n::|$)/g;
  const out: Partial<ParsedEdit> = {};
  for (const match of raw.matchAll(pattern)) {
    const key = match[1] as "before" | "after" | "reason";
    out[key] = match[2].trim();
  }
  if (typeof out.before !== "string" || typeof out.after !== "string") {
    return null;
  }
  return { before: out.before, after: out.after, reason: out.reason };
}
