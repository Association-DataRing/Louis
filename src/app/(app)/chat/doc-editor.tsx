"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  IconBold,
  IconItalic,
  IconH1,
  IconH2,
  IconH3,
  IconList,
  IconListNumbers,
  IconBlockquote,
} from "@tabler/icons-react";
import { Spinner } from "@/components/ui/spinner";

export type DocEditorHandle = {
  /** Document ProseMirror courant (pour la sauvegarde). null si non monté. */
  getJSON: () => Record<string, unknown> | null;
};

type Props = {
  documentId: string;
  /** Notifie le parent quand le contenu diverge de la version chargée. */
  onDirtyChange?: (dirty: boolean) => void;
};

/**
 * Éditeur WYSIWYG (Tiptap) du DocPanel. Charge le .docx converti en HTML
 * (route /html, via mammoth), laisse éditer titres/gras/italique/listes, et
 * expose `getJSON()` au parent qui ré-exporte en .docx (nouvelle version) au
 * save. Le souligné et les liens ne sont volontairement PAS éditables tant que
 * le modèle inline de DocumentSpec ne les porte pas (cf. extensions ci-dessous)
 * — sinon le save les perdrait en silence.
 */
export const DocEditor = forwardRef<DocEditorHandle, Props>(function DocEditor(
  { documentId, onDirtyChange },
  ref
) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Le setContent initial déclenche un onUpdate « faux » : on le neutralise
  // tant que l'hydratation n'est pas finie, sinon le doc s'ouvre « dirty ».
  // (Le parent passe un `onDirtyChange` stable — setState setter — donc on
  // peut le référencer directement dans onUpdate sans ref-miroir.)
  const hydrating = useRef(true);

  const editor = useEditor({
    immediatelyRender: false, // évite un mismatch d'hydratation côté Next
    // MVP : seuls les styles que le générateur .docx sait ré-exporter sans
    // perte (gras/italique via markdown). Souligné/liens reviendront quand le
    // modèle inline de DocumentSpec portera ces marques — sinon save = perte
    // silencieuse, piège inacceptable pour un acte juridique.
    extensions: [StarterKit],
    editorProps: {
      attributes: {
        class:
          "prose prose-neutral dark:prose-invert max-w-none focus:outline-none prose-headings:font-heading prose-headings:tracking-tight prose-sm sm:prose-base",
      },
    },
    content: "",
    onUpdate: () => {
      if (hydrating.current) return;
      onDirtyChange?.(true);
    },
  });

  useImperativeHandle(
    ref,
    () => ({
      getJSON: () =>
        editor ? (editor.getJSON() as Record<string, unknown>) : null,
    }),
    [editor]
  );

  useEffect(() => {
    if (!editor) return;
    let cancelled = false;
    // Pas de reset synchrone de loading/error ici : le composant remonte via
    // `key` à chaque changement de document, donc l'état initial suffit.
    hydrating.current = true;
    fetch(`/api/documents/${documentId}/html`)
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json() as Promise<{ html: string }>;
      })
      .then(({ html }) => {
        if (cancelled) return;
        editor.commands.setContent(html || "<p></p>", false);
        setLoading(false);
        onDirtyChange?.(false);
        // Réactive le suivi dirty après le tick de setContent.
        requestAnimationFrame(() => {
          hydrating.current = false;
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Erreur de chargement");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editor, documentId, onDirtyChange]);

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      {editor && <Toolbar editor={editor} />}
      <div className="relative flex-1 min-h-0 overflow-auto bg-background">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Spinner className="size-5" />
          </div>
        )}
        {error && (
          <div className="mx-5 my-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        {/* Contenu toujours monté (Tiptap a besoin de son point d'ancrage) ;
            on fond son apparition une fois le .docx chargé. */}
        <div
          className={`mx-auto max-w-[816px] px-8 py-10 transition-opacity duration-500 motion-reduce:transition-none ${
            loading || error ? "opacity-0" : "opacity-100"
          }`}
        >
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
});

/* ------------------------------ Toolbar ------------------------------ */

function Toolbar({ editor }: { editor: Editor }) {
  // Re-render à chaque transaction pour refléter l'état actif des boutons.
  const [, force] = useState(0);

  useEffect(() => {
    const update = () => force((t) => t + 1);
    editor.on("transaction", update);
    return () => {
      editor.off("transaction", update);
    };
  }, [editor]);

  return (
    <div className="shrink-0 border-b border-border bg-card/40">
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5">
        <TBtn
          active={editor.isActive("heading", { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          label="Titre 1"
        >
          <IconH1 className="size-4" />
        </TBtn>
        <TBtn
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          label="Titre 2"
        >
          <IconH2 className="size-4" />
        </TBtn>
        <TBtn
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          label="Titre 3"
        >
          <IconH3 className="size-4" />
        </TBtn>

        <Divider />

        <TBtn
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          label="Gras"
        >
          <IconBold className="size-4" />
        </TBtn>
        <TBtn
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          label="Italique"
        >
          <IconItalic className="size-4" />
        </TBtn>

        <Divider />

        <TBtn
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          label="Liste à puces"
        >
          <IconList className="size-4" />
        </TBtn>
        <TBtn
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          label="Liste numérotée"
        >
          <IconListNumbers className="size-4" />
        </TBtn>
        <TBtn
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          label="Citation"
        >
          <IconBlockquote className="size-4" />
        </TBtn>
      </div>
    </div>
  );
}

function TBtn({
  active,
  onClick,
  label,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      // preventDefault sur mousedown : garde la sélection/focus de l'éditeur.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`inline-flex size-8 items-center justify-center rounded-md transition-colors ${
        active
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-border" aria-hidden />;
}
