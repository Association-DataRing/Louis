import { redirect } from "next/navigation";
import { IconSparkles } from "@tabler/icons-react";
import { auth } from "@/auth";
import { listSkills, listSkillTemplates } from "./actions";
import { SkillToggle } from "./skill-toggle";
import { SkillFormDialog } from "./skill-form-dialog";
import { SkillTemplatesDialog } from "./skill-templates-dialog";
import { SkillRowActions } from "./skill-row-actions";

export default async function SkillsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [all, templates] = await Promise.all([
    listSkills(),
    listSkillTemplates(),
  ]);
  const enabledCount = all.filter((s) => s.enabled).length;

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-8 md:px-8 md:py-10">
      <header className="mb-8 flex items-end justify-between gap-4 flex-wrap">
        <div className="max-w-2xl">
          <p className="text-xs text-foreground/70 uppercase tracking-wider">
            Compétences IA
          </p>
          <h1 className="mt-1 font-heading text-3xl tracking-tight">Skills</h1>
          <p className="mt-2 text-muted-foreground text-sm">
            Mini-instructions que Louis injecte dans le prompt système quand un
            détecteur identifie qu&apos;elles sont pertinentes à votre demande.
            Vous créez vos propres compétences — rien n&apos;est livré par
            défaut, votre cabinet décide.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SkillTemplatesDialog templates={templates} />
          <SkillFormDialog mode={{ kind: "create" }} />
        </div>
      </header>

      {all.length === 0 ? (
        <EmptyState hasTemplates={templates.length > 0} />
      ) : (
        <>
          <p className="mb-3 text-xs text-muted-foreground">
            {all.length} compétence{all.length > 1 ? "s" : ""} ·{" "}
            {enabledCount} active{enabledCount > 1 ? "s" : ""}
          </p>
          <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
            <ul className="divide-y divide-border">
              {all.map((s) => (
                <li
                  key={s.id}
                  className="flex items-start justify-between gap-4 px-4 py-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{s.name}</span>
                      <code className="text-[11px] text-muted-foreground font-mono">
                        {s.slug}
                      </code>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                      {s.description}
                    </p>
                    <p className="mt-1.5 text-[11px] text-muted-foreground/80 italic">
                      <span className="not-italic font-medium">Activée quand :</span>{" "}
                      {s.triggerHint}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <SkillToggle
                      skillId={s.id}
                      enabled={s.enabled}
                      name={s.name}
                    />
                    <SkillRowActions
                      skill={{
                        id: s.id,
                        name: s.name,
                        description: s.description,
                        triggerHint: s.triggerHint,
                        systemPrompt: s.systemPrompt,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      <aside className="mt-12 max-w-2xl border-l-2 border-primary/40 pl-4 text-xs text-muted-foreground">
        <strong className="text-foreground">Comment ça marche.</strong> À chaque
        message, un petit modèle ({"~"}1k tokens) regarde votre demande et la
        liste des compétences actives. S&apos;il en détecte une de pertinente,
        son instruction système est ajoutée au modèle principal — sans
        intervention de votre part. Coût : quelques millièmes par requête.
      </aside>
    </main>
  );
}

function EmptyState({ hasTemplates }: { hasTemplates: boolean }) {
  return (
    <div className="py-16 border-y border-dashed border-border">
      <IconSparkles className="size-6 text-muted-foreground" />
      <p className="mt-4 font-heading text-2xl tracking-tight">
        Aucune compétence pour l&apos;instant.
      </p>
      <p className="mt-3 text-sm text-muted-foreground max-w-md">
        Créez votre propre compétence depuis zéro
        {hasTemplates ? (
          <>
            {" "}ou parcourez la <strong>bibliothèque d&apos;exemples</strong>{" "}
            (à adapter à la pratique de votre cabinet).
          </>
        ) : (
          "."
        )}
      </p>
    </div>
  );
}
