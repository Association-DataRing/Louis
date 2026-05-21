import { createHash } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { auth } from "@/auth";
import { db } from "@/db";
import { conversations, messages } from "@/db/schema";
import { LouisLogo } from "@/components/louis-logo";
import { PrintTrigger } from "./print-trigger";

export const dynamic = "force-dynamic";

export default async function PrintConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [conv] = await db
    .select({
      id: conversations.id,
      title: conversations.title,
      createdAt: conversations.createdAt,
    })
    .from(conversations)
    .where(
      and(eq(conversations.id, id), eq(conversations.userId, session.user.id))
    )
    .limit(1);
  if (!conv) notFound();

  const rows = await db
    .select({
      role: messages.role,
      content: messages.content,
      createdAt: messages.createdAt,
      modelId: messages.modelId,
    })
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt));

  const dateStr = new Date(conv.createdAt).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Empreinte d'intégrité — sha256(role|content|timestamp pour chaque
  // message). Permet à un avocat de prouver, en cas de contestation, que
  // le PDF archivé correspond bien au contenu original en base. Tronquée
  // à 12 chars pour rester lisible en footer.
  const integritySource = rows
    .map(
      (m) =>
        `${m.role}|${m.content}|${new Date(m.createdAt).toISOString()}`
    )
    .join("\n");
  const integrityHash = createHash("sha256")
    .update(integritySource)
    .digest("hex")
    .slice(0, 12);

  // Modèles distincts utilisés sur les messages assistants. Trace d'audit
  // pour reconstituer quel(s) modèle(s) ont produit la conversation.
  const modelsUsed = Array.from(
    new Set(
      rows
        .filter((m) => m.role === "assistant" && m.modelId)
        .map((m) => m.modelId as string)
    )
  );

  const shortConvId = conv.id.slice(0, 8);

  return (
    <div className="print-page mx-auto max-w-[820px] px-10 py-12 print:px-0 print:py-0">
      <PrintTrigger title={conv.title} />

      <header className="flex items-center justify-between border-b border-gray-300 pb-4 mb-6">
        <div className="flex items-center gap-2">
          <LouisLogo className="size-5 text-black" />
          <span className="font-heading text-lg tracking-tight">Louis</span>
        </div>
        <div className="text-xs text-gray-500">
          Conversation exportée le {new Date().toLocaleDateString("fr-FR")}
        </div>
      </header>

      <h1 className="font-heading text-3xl tracking-tight mb-1">
        {conv.title}
      </h1>
      <p className="text-sm text-gray-500 mb-8">Créée le {dateStr}</p>

      <main className="space-y-6">
        {rows.map((m, i) => (
          <article
            key={i}
            className="border border-gray-200 rounded-md px-5 py-4 break-inside-avoid"
          >
            <div className="flex items-center justify-between mb-2 text-xs uppercase tracking-wider text-gray-500">
              <span className="font-semibold">
                {m.role === "user" ? "Vous" : "Louis"}
                {m.role === "assistant" && m.modelId && (
                  <span className="ml-2 normal-case tracking-normal font-normal text-gray-400">
                    · {m.modelId}
                  </span>
                )}
              </span>
              <time>{new Date(m.createdAt).toLocaleString("fr-FR")}</time>
            </div>
            <div className="prose prose-sm max-w-none prose-headings:font-heading">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {m.content}
              </ReactMarkdown>
            </div>
          </article>
        ))}
      </main>

      <footer className="mt-10 pt-4 border-t border-gray-200 text-xs text-gray-500">
        <p className="text-center">
          Généré par Louis — assistant juridique souverain
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-[10px] leading-snug">
          <div className="flex gap-2">
            <dt className="text-gray-400 shrink-0">conv:</dt>
            <dd className="truncate">{shortConvId}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-gray-400 shrink-0">sha256:</dt>
            <dd className="truncate">{integrityHash}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-gray-400 shrink-0">messages:</dt>
            <dd>{rows.length}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-gray-400 shrink-0">modèles:</dt>
            <dd className="truncate">
              {modelsUsed.length > 0 ? modelsUsed.join(", ") : "—"}
            </dd>
          </div>
        </dl>
      </footer>

      <style>{`
        @media print {
          @page {
            margin: 1.5cm;
            @bottom-right {
              content: "Page " counter(page) " / " counter(pages);
              font-family: ui-monospace, monospace;
              font-size: 9px;
              color: #6b7280;
            }
            @bottom-left {
              content: "Louis · ${shortConvId} · sha256:${integrityHash}";
              font-family: ui-monospace, monospace;
              font-size: 9px;
              color: #6b7280;
            }
          }
        }
      `}</style>
    </div>
  );
}
