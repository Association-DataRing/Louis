import { IconBolt, IconCircleCheck, IconUserPlus } from "@tabler/icons-react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listSkills } from "./actions";
import { SkillToggle } from "./skill-toggle";

export default async function SkillsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const all = await listSkills();
  const presets = all.filter((s) => s.isPreset);
  const customs = all.filter((s) => !s.isPreset);
  const enabledCount = all.filter((s) => s.enabled).length;

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-8 md:px-8 md:py-10">
      <header className="mb-6">
        <p className="text-xs text-foreground/70 uppercase tracking-wider">
          Compétences IA
        </p>
        <h1 className="mt-1 font-heading text-3xl tracking-tight">
          Skills
        </h1>
        <p className="mt-2 text-muted-foreground text-sm max-w-2xl">
          Compétences contextuelles que l&apos;IA active automatiquement
          selon la demande. Quand vous posez une question, un
          classificateur léger détecte si une ou plusieurs skills sont
          pertinentes et injecte leurs instructions dans le prompt système
          du modèle principal.
        </p>
      </header>

      <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          icon={IconCircleCheck}
          label="Activées"
          value={enabledCount}
          hint="auto-détectées selon la demande"
        />
        <StatCard
          icon={IconBolt}
          label="Presets système"
          value={presets.length}
          hint="livrées avec Louis"
        />
        <StatCard
          icon={IconUserPlus}
          label="Custom"
          value={customs.length}
          hint="créées par votre cabinet"
        />
      </div>

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-heading text-xl tracking-tight">
            Presets système
          </h2>
          <p className="text-xs text-muted-foreground">
            Désactivables, lecture seule. Pour personnaliser, dupliquez via
            l&apos;option « Créer une variante ».
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
          <ul className="divide-y divide-border">
            {presets.map((s) => (
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
                    <span className="not-italic font-medium">Activé quand :</span>{" "}
                    {s.triggerHint}
                  </p>
                </div>
                <SkillToggle
                  skillId={s.id}
                  enabled={s.enabled}
                  name={s.name}
                />
              </li>
            ))}
          </ul>
        </div>
      </section>

      {customs.length > 0 && (
        <section>
          <h2 className="mb-3 font-heading text-xl tracking-tight">
            Compétences cabinet
          </h2>
          <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
            <ul className="divide-y divide-border">
              {customs.map((s) => (
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
                      <span className="not-italic font-medium">
                        Activé quand :
                      </span>{" "}
                      {s.triggerHint}
                    </p>
                  </div>
                  <SkillToggle
                    skillId={s.id}
                    enabled={s.enabled}
                    name={s.name}
                  />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </main>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof IconBolt;
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/50 p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="mt-2 font-heading text-3xl tracking-tight">{value}</div>
      <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}
