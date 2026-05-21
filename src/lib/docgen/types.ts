/**
 * Schéma structuré pour la génération de documents juridiques.
 *
 * Couvre :
 * - sections + table + pageBreak
 * - alignement par paragraphe (justified par défaut, standard juridique)
 * - footer/header configurable + numérotation auto Page X/Y
 * - marges configurables
 * - support natif DOCX et PDF avec le même schéma
 */

export type Alignment = "left" | "center" | "right" | "justify";

export type Section =
  | {
      kind: "heading";
      level: 1 | 2 | 3 | 4;
      text: string;
      align?: Alignment;
    }
  | {
      kind: "paragraph";
      content: string;
      align?: Alignment;
      bold?: boolean;
      italic?: boolean;
    }
  | {
      kind: "list";
      ordered: boolean;
      items: string[];
    }
  | {
      kind: "blockquote";
      content: string;
    }
  | {
      kind: "table";
      headers: string[];
      rows: string[][];
      caption?: string;
    }
  | {
      kind: "pageBreak";
    }
  | {
      kind: "hr";
    }
  | {
      kind: "spacer";
      lines?: number;
    };

export type DocumentSpec = {
  title: string;
  subtitle?: string;
  /** Affiché en footer si non vide. Défaut : pas de footer. */
  footer?: string;
  /** Si true, footer affiche "Page X / Y" en plus. Défaut : true. */
  pageNumbers?: boolean;
  /** A4 portrait par défaut. */
  landscape?: boolean;
  /** Marges en cm. Défaut : top/bottom 2.5, left/right 2.5. */
  margins?: { top?: number; bottom?: number; left?: number; right?: number };
  /** Police du corps. Défaut DOCX : Cambria. PDF : Helvetica intégrée. */
  fontFamily?: "serif" | "sans";
  sections: Section[];
};
