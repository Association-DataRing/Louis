import { AbsoluteFill, interpolate, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as loadGaramond } from "@remotion/google-fonts/EBGaramond";
import { loadFont as loadGeist } from "@remotion/google-fonts/Geist";

const { fontFamily: serifFont } = loadGaramond("normal", {
  weights: ["400", "500", "600"],
});
const { fontFamily: sansFont } = loadGeist("normal", {
  weights: ["400", "500", "600"],
});

/**
 * LouisDemo — 12s loop pour la hero.
 *
 * Cette composition reproduit le shell exact de l'app Louis (cf.
 * `src/app/(app)/chat/chat-shell.tsx`) : sidebar gauche avec LouisLogo +
 * conversations, header 52px avec breadcrumb projet + usage tokens + cost
 * pill + badge souveraineté, chat avec avatar "L" italique EB Garamond,
 * tool pill avec shimmer animation comme dans `globals.css`, DocPanel à
 * droite aligné sur 52px.
 *
 * Tokens couleurs : oklch directs comme dans `src/app/globals.css`. Chrome
 * (Puppeteer Remotion) supporte oklch depuis v111 — c'est fiable.
 *
 * Découpage temporel (30fps, 450 frames = 15s) :
 *   0–40    intro logo Louis
 *   40–90   fade intro → fade-in app shell
 *   90–180  user tape sa question (typewriter)
 *   180–210 tool pill `legifrance_search` apparaît + shimmer
 *   210–300 réponse assistant streamée (typewriter)
 *   300–345 DocPanel slide-in droite + highlight cible
 *   345–435 hold final (3s) — DocPanel + highlight visibles, l'œil
 *           absorbe la vue complète avant le loop
 *   435–450 fade vers intro state (loop seamless)
 */

// Tokens couleurs alignés sur src/app/globals.css (light mode)
const C = {
  background: "oklch(0.99 0.003 265)",
  foreground: "oklch(0.16 0.01 265)",
  card: "oklch(1 0 0)",
  primary: "oklch(0.32 0.18 265)",
  primaryFg: "oklch(0.985 0.002 265)",
  primary10: "color-mix(in oklch, oklch(0.32 0.18 265) 10%, transparent)",
  primary15: "color-mix(in oklch, oklch(0.32 0.18 265) 15%, transparent)",
  primary20: "color-mix(in oklch, oklch(0.32 0.18 265) 20%, transparent)",
  muted: "oklch(0.97 0.006 265)",
  mutedFg: "oklch(0.5 0.012 265)",
  accent: "oklch(0.95 0.008 265)",
  border: "oklch(0.92 0.008 265)",
  sidebar: "oklch(0.985 0.005 265)",
  highlight: "oklch(0.94 0.12 90)",
  success: "oklch(0.55 0.13 160)",
} as const;

export const LouisDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Loop seamless : opacity 0 → 1 → 1 → 0. Le plateau dure 420 frames
  // (95% de la composition) — la transition n'apparaît qu'aux extrémités.
  const masterOpacity = interpolate(
    frame,
    [0, 15, 435, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{
        background: C.background,
        fontFamily: sansFont,
        color: C.foreground,
        opacity: masterOpacity,
      }}
    >
      {/* Phase 1 : intro logo (visible 0-60) */}
      <Sequence durationInFrames={70}>
        <IntroLogo />
      </Sequence>

      {/* Phase 2+ : app shell (apparaît à 50, reste jusqu'à la fin) */}
      <Sequence from={50}>
        <AppShell />
      </Sequence>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Intro

const IntroLogo: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [5, 25], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(frame, [5, 25], [16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(frame, [50, 70], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 18,
        opacity: fadeOut,
      }}
    >
      <div
        style={{
          opacity,
          transform: `translateY(${y}px)`,
          display: "flex",
          alignItems: "center",
          gap: 18,
        }}
      >
        <LouisKey size={56} />
        <span
          style={{
            fontFamily: serifFont,
            fontSize: 84,
            letterSpacing: -1.5,
            color: C.foreground,
            lineHeight: 1,
          }}
        >
          Louis
        </span>
      </div>
      <span
        style={{
          opacity,
          transform: `translateY(${y}px)`,
          fontSize: 18,
          color: C.mutedFg,
          letterSpacing: 0.3,
          fontStyle: "italic",
          fontFamily: serifFont,
        }}
      >
        L&apos;IA juridique souveraine
      </span>
    </AbsoluteFill>
  );
};

const LouisKey: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={C.primary}
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <circle cx="7" cy="7" r="5" />
    <path d="M7 4 L7 10" />
    <path d="M4 7 L10 7" />
    <path d="M10.5 10.5 L19.5 19.5" />
    <path d="M14.5 16.5 L16.5 14.5" />
    <path d="M17 19 L19 17" />
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// App shell — reproduction fidèle de chat-shell.tsx

const FULL_QUESTION =
  "Cherche dans Légifrance les articles sur la responsabilité du fait des produits défectueux.";

const FULL_ANSWER_PRE =
  "L'article 1245 du Code civil pose le principe central :";
const FULL_ANSWER_QUOTE =
  "« Le producteur est responsable du dommage causé par un défaut de son produit, qu'il soit ou non lié par un contrat avec la victime. »";
const FULL_ANSWER_POST =
  " Voir également les articles 1245-1 à 1245-17 pour les modalités d'application et les exonérations.";

const AppShell: React.FC = () => {
  // Frame relatif à 50 (début de la séquence)
  const frame = useCurrentFrame();

  // Fade-in de l'app shell
  const shellOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const shellY = interpolate(frame, [0, 30], [30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Question typewriter : 40-130
  const qChars = Math.floor(
    interpolate(frame, [40, 130], [0, FULL_QUESTION.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );
  const visibleQ = FULL_QUESTION.slice(0, qChars);
  const questionComplete = qChars >= FULL_QUESTION.length;

  // Tool pill apparaît à 135
  const toolOpacity = interpolate(frame, [135, 155], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Réponse 3 segments (texte + citation + texte)
  const aTotal =
    FULL_ANSWER_PRE.length + FULL_ANSWER_QUOTE.length + FULL_ANSWER_POST.length;
  const aChars = Math.floor(
    interpolate(frame, [165, 250], [0, aTotal], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );

  // DocPanel slide-in : on anime la LARGEUR (0 → 520) plutôt que juste
  // un translateX. Le flex container se reflow → la chat column max-w-3xl
  // mx-auto se ré-centre dans la zone rétrécie, exactement comme dans
  // l'app réelle quand openDoc passe de null à un id.
  const docWidth = interpolate(frame, [255, 300], [0, 520], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Contenu du panel : opacity légèrement différée pour qu'il apparaisse
  // une fois que l'aside a assez de largeur pour le contenir.
  const docContentOpacity = interpolate(frame, [275, 305], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Highlight de la cible dans le DocPanel
  const highlightOpacity = interpolate(frame, [305, 330], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        opacity: shellOpacity,
        transform: `translateY(${shellY}px)`,
        padding: 100,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: 1720,
          height: 880,
          background: C.background,
          borderRadius: 20,
          border: `1px solid ${C.border}`,
          boxShadow: `0 40px 100px -20px ${C.primary15}, 0 0 0 1px ${C.primary10}`,
          overflow: "hidden",
          display: "flex",
        }}
      >
        <Sidebar />

        <main
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            background: C.background,
          }}
        >
          <ChatHeader />
          <ChatBody
            visibleQuestion={visibleQ}
            questionComplete={questionComplete}
            toolOpacity={toolOpacity}
            answerCharsRemaining={aChars}
            frame={frame}
          />
        </main>

        <DocPanel
          width={docWidth}
          contentOpacity={docContentOpacity}
          highlightOpacity={highlightOpacity}
        />
      </div>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar — replica de sidebar-content.tsx

const Sidebar: React.FC = () => (
  <aside
    style={{
      width: 260,
      background: C.sidebar,
      borderRight: `1px solid ${C.border}`,
      display: "flex",
      flexDirection: "column",
      padding: "16px 12px",
      gap: 4,
    }}
  >
    {/* Logo + wordmark */}
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 8px 16px",
        borderBottom: `1px solid ${C.border}`,
        marginBottom: 12,
      }}
    >
      <LouisKey size={20} />
      <span
        style={{
          fontFamily: serifFont,
          fontSize: 18,
          letterSpacing: -0.3,
          color: C.foreground,
        }}
      >
        Louis
      </span>
      <span
        style={{
          fontSize: 9,
          fontFamily: "ui-monospace, Menlo, monospace",
          color: C.mutedFg,
          border: `1px solid ${C.border}`,
          padding: "2px 6px",
          borderRadius: 4,
          marginLeft: "auto",
          lineHeight: 1,
        }}
      >
        DataRing
      </span>
    </div>

    {/* Section CONVERSATIONS */}
    <p
      style={{
        fontSize: 10,
        fontWeight: 500,
        color: C.mutedFg,
        textTransform: "uppercase",
        letterSpacing: 1.2,
        padding: "8px 8px 4px",
      }}
    >
      Conversations
    </p>

    {/* Conversation épinglée */}
    <ConvItem label="Audit RGPD — Q3" active pinned />
    <ConvItem label="Mémo Faurecia II" pinned />

    {/* Séparateur */}
    <div style={{ height: 8 }} />

    <ConvItem label="Analyse contrat SaaS" />
    <ConvItem label="Due diligence Acme" />
    <ConvItem label="Recherche jurisprudence…" />

    {/* Section PROJETS */}
    <p
      style={{
        fontSize: 10,
        fontWeight: 500,
        color: C.mutedFg,
        textTransform: "uppercase",
        letterSpacing: 1.2,
        padding: "16px 8px 4px",
      }}
    >
      Projets
    </p>
    <ProjectItem label="Affaire Dupont c/ Martin" />
    <ProjectItem label="Compliance RGPD 2026" />

    {/* User block */}
    <div
      style={{
        marginTop: "auto",
        paddingTop: 16,
        borderTop: `1px solid ${C.border}`,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 8px",
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: C.foreground,
          color: C.background,
          fontSize: 11,
          fontWeight: 500,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: serifFont,
        }}
      >
        MD
      </div>
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: C.foreground }}>
          Me Dupont
        </span>
        <span style={{ fontSize: 10, color: C.mutedFg }}>admin</span>
      </div>
    </div>
  </aside>
);

const ConvItem: React.FC<{
  label: string;
  active?: boolean;
  pinned?: boolean;
}> = ({ label, active, pinned }) => (
  <div
    style={{
      height: 30,
      padding: "0 8px",
      borderRadius: 6,
      display: "flex",
      alignItems: "center",
      gap: 8,
      fontSize: 12.5,
      color: active ? C.foreground : C.mutedFg,
      fontWeight: active ? 500 : 400,
      background: active ? C.accent : "transparent",
    }}
  >
    {pinned ? <PinIcon /> : <span style={{ width: 12 }} />}
    <span
      style={{
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    >
      {label}
    </span>
  </div>
);

const ProjectItem: React.FC<{ label: string }> = ({ label }) => (
  <div
    style={{
      height: 30,
      padding: "0 8px",
      borderRadius: 6,
      display: "flex",
      alignItems: "center",
      gap: 8,
      fontSize: 12.5,
      color: C.mutedFg,
    }}
  >
    <FolderIcon />
    <span
      style={{
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    >
      {label}
    </span>
  </div>
);

const PinIcon: React.FC = () => (
  <svg
    width={12}
    height={12}
    viewBox="0 0 24 24"
    fill={C.primary}
    aria-hidden
  >
    <path d="M16 4l-1 1v4l-2 2H8l-2 2 4 4-4 4 1 1 4-4 4 4 1-1-4-4 2-2v-4l2-2-1-1z" />
  </svg>
);

const FolderIcon: React.FC = () => (
  <svg
    width={12}
    height={12}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// Chat header 52px — replica exacte du header chat-shell:857

const ChatHeader: React.FC = () => (
  <header
    style={{
      height: 52,
      borderBottom: `1px solid ${C.border}`,
      padding: "0 24px",
      display: "flex",
      alignItems: "center",
      gap: 12,
      fontSize: 12,
    }}
  >
    {/* Breadcrumb projet à gauche */}
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: C.muted,
        opacity: 0.6,
        padding: "4px 10px",
        borderRadius: 6,
        color: C.foreground,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: C.primary,
        }}
      />
      <span style={{ fontWeight: 500 }}>Audit RGPD — Q3</span>
    </div>

    {/* Droite : usage + cost + provider */}
    <div
      style={{
        marginLeft: "auto",
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      {/* Tokens */}
      <span
        style={{
          color: C.mutedFg,
          fontVariantNumeric: "tabular-nums",
          fontFamily: "ui-monospace, Menlo, monospace",
          fontSize: 11,
        }}
      >
        1.2k↗ 4.8k↘
      </span>

      {/* Cost pill */}
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "3px 8px",
          background: C.primary,
          color: C.primaryFg,
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 500,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        0,03&nbsp;€
      </span>

      {/* Provider + sovereignty badge */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 10px",
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 6,
          fontSize: 11,
          color: C.foreground,
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "1px 5px",
            background: C.primary15,
            color: C.primary,
            fontSize: 9,
            fontWeight: 700,
            borderRadius: 3,
            letterSpacing: 0.5,
          }}
        >
          FR
        </span>
        Mistral · mistral-large-latest
      </div>
    </div>
  </header>
);

// ─────────────────────────────────────────────────────────────────────────────
// Chat body

const ChatBody: React.FC<{
  visibleQuestion: string;
  questionComplete: boolean;
  toolOpacity: number;
  answerCharsRemaining: number;
  frame: number;
}> = ({
  visibleQuestion,
  questionComplete,
  toolOpacity,
  answerCharsRemaining,
  frame,
}) => {
  // Curseur typewriter clignote toutes les 15 frames
  const cursorBlink = Math.floor(frame / 15) % 2 === 0;

  // Découpe progressive de la réponse en 3 morceaux : pre / quote / post
  const preLen = Math.min(answerCharsRemaining, FULL_ANSWER_PRE.length);
  const quoteLen = Math.min(
    Math.max(0, answerCharsRemaining - FULL_ANSWER_PRE.length),
    FULL_ANSWER_QUOTE.length
  );
  const postLen = Math.min(
    Math.max(
      0,
      answerCharsRemaining - FULL_ANSWER_PRE.length - FULL_ANSWER_QUOTE.length
    ),
    FULL_ANSWER_POST.length
  );

  const visiblePre = FULL_ANSWER_PRE.slice(0, preLen);
  const visibleQuote = FULL_ANSWER_QUOTE.slice(0, quoteLen);
  const visiblePost = FULL_ANSWER_POST.slice(0, postLen);

  const answerStarted = preLen > 0;
  const answerComplete =
    postLen >= FULL_ANSWER_POST.length;

  return (
    <div
      style={{
        flex: 1,
        padding: "32px 48px",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        minWidth: 0,
      }}
    >
      {/* Colonne centrée max-w-3xl comme dans chat-shell.tsx :
          - Sans DocPanel : la zone est large → colonne centrée → messages
            visuellement au centre de l'écran
          - Avec DocPanel : la zone rétrécit → colonne se ré-centre dans
            l'espace restreint → messages visuellement décalés à gauche
          C'est le reflow naturel CSS qui produit l'effet, comme l'app. */}
      <div
        style={{
          width: "100%",
          maxWidth: 760,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
      {/* User message */}
      <div
        style={{
          alignSelf: "flex-end",
          maxWidth: "78%",
          display: "flex",
          gap: 12,
          alignItems: "flex-end",
        }}
      >
        <div
          style={{
            background: C.muted,
            border: `1px solid ${C.border}`,
            borderRadius: 16,
            borderTopRightRadius: 4,
            padding: "14px 18px",
            fontSize: 15,
            lineHeight: 1.5,
            color: C.foreground,
            minHeight: 50,
          }}
        >
          {visibleQuestion}
          {!questionComplete && cursorBlink && (
            <span style={{ marginLeft: 1, color: C.primary }}>▍</span>
          )}
        </div>
        <Avatar foreground={C.foreground} bg={C.foreground} fg={C.background}>
          MD
        </Avatar>
      </div>

      {/* Assistant message — visible quand la question est complète */}
      {questionComplete && (
        <div
          style={{
            display: "flex",
            gap: 12,
            maxWidth: "80%",
            alignItems: "flex-start",
          }}
        >
          <AvatarL />
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {/* Tool pill avec shimmer */}
            <ShimmerPill opacity={toolOpacity} active={!answerStarted} frame={frame} />

            {/* Réponse */}
            {answerStarted && (
              <div
                style={{
                  background: C.card,
                  border: `1px solid ${C.border}`,
                  borderRadius: 16,
                  borderTopLeftRadius: 4,
                  padding: "18px 22px",
                  fontSize: 15,
                  lineHeight: 1.65,
                  color: C.foreground,
                  boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                }}
              >
                <span>{visiblePre}</span>
                {quoteLen > 0 && (
                  <>
                    <br />
                    <br />
                    <span
                      style={{
                        fontFamily: serifFont,
                        fontStyle: "italic",
                        color: C.foreground,
                        borderLeft: `3px solid ${C.primary}`,
                        paddingLeft: 14,
                        marginLeft: 2,
                        display: "inline-block",
                      }}
                    >
                      {visibleQuote}
                    </span>
                    <br />
                    <span
                      style={{
                        fontSize: 11,
                        color: C.mutedFg,
                        fontFamily: "ui-monospace, Menlo, monospace",
                        display: "inline-block",
                        marginTop: 4,
                      }}
                    >
                      ↳ Code civil, art. 1245
                    </span>
                  </>
                )}
                {postLen > 0 && (
                  <>
                    <br />
                    <br />
                    {visiblePost}
                    {!answerComplete && cursorBlink && (
                      <span style={{ color: C.primary }}>▍</span>
                    )}
                  </>
                )}
                {answerComplete && (
                  <div
                    style={{
                      marginTop: 16,
                      paddingTop: 12,
                      borderTop: `1px solid ${C.border}`,
                      fontSize: 11,
                      color: C.mutedFg,
                      fontFamily: "ui-monospace, Menlo, monospace",
                    }}
                  >
                    Réponse vérifiée · sources : Légifrance (PISTE) · {""}
                    <span style={{ color: C.success }}>● chiffré localement</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

const Avatar: React.FC<{
  children: React.ReactNode;
  foreground: string;
  bg: string;
  fg: string;
}> = ({ children, bg, fg }) => (
  <div
    style={{
      width: 32,
      height: 32,
      borderRadius: "50%",
      background: bg,
      color: fg,
      fontSize: 12,
      fontWeight: 500,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: serifFont,
      flexShrink: 0,
    }}
  >
    {children}
  </div>
);

const AvatarL: React.FC = () => (
  <div
    style={{
      width: 32,
      height: 32,
      borderRadius: "50%",
      background: C.primary,
      color: C.primaryFg,
      fontSize: 16,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: serifFont,
      fontStyle: "italic",
      fontWeight: 500,
      flexShrink: 0,
      paddingBottom: 2, // ajustement optique pour l'italique
    }}
  >
    L
  </div>
);

const ShimmerPill: React.FC<{
  opacity: number;
  active: boolean;
  frame: number;
}> = ({ opacity, active, frame }) => {
  // Animation shimmer : translation horizontale -100% → 100% sur 48 frames (1.6s à 30fps)
  const shimmerProgress = active ? (frame % 48) / 48 : 1;
  const shimmerX = active ? interpolate(shimmerProgress, [0, 1], [-100, 100]) : 100;

  return (
    <div
      style={{
        opacity,
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        alignSelf: "flex-start",
        padding: "6px 14px",
        background: C.primary10,
        color: C.primary,
        fontSize: 12,
        fontFamily: "ui-monospace, Menlo, monospace",
        borderRadius: 999,
        border: `1px solid ${C.primary20}`,
        overflow: "hidden",
      }}
    >
      {/* Shimmer overlay actif tant que le tool tourne */}
      {active && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(90deg, transparent 0%, ${C.primary15} 50%, transparent 100%)`,
            transform: `translateX(${shimmerX}%)`,
            pointerEvents: "none",
          }}
        />
      )}
      <ToolIcon />
      <span style={{ position: "relative" }}>legifrance_search</span>
      {active && (
        <span
          style={{
            position: "relative",
            color: C.primary,
            opacity: 0.6,
            fontSize: 10,
          }}
        >
          · exécution
        </span>
      )}
      {!active && (
        <CheckIcon color={C.success} />
      )}
    </div>
  );
};

const ToolIcon: React.FC = () => (
  <svg
    width={12}
    height={12}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    style={{ position: "relative" }}
  >
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
);

const CheckIcon: React.FC<{ color: string }> = ({ color }) => (
  <svg
    width={12}
    height={12}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    style={{ position: "relative" }}
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// DocPanel — replica de chat/doc-panel.tsx

const DocPanel: React.FC<{
  width: number;
  contentOpacity: number;
  highlightOpacity: number;
}> = ({ width, contentOpacity, highlightOpacity }) => (
  <aside
    style={{
      width,
      borderLeft: width > 3 ? `1px solid ${C.border}` : "none",
      background:
        width > 3 ? `color-mix(in oklch, ${C.card} 60%, ${C.muted} 40%)` : "transparent",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      flexShrink: 0,
    }}
  >
    {/* Le contenu intérieur garde sa largeur naturelle (520) — c'est
        l'aside qui grandit en largeur, révélant son contenu de la
        gauche vers la droite. Le contentOpacity fade le tout pour que la
        révélation se fasse en douceur. */}
    <div
      style={{
        width: 520,
        height: "100%",
        opacity: contentOpacity,
        display: "flex",
        flexDirection: "column",
      }}
    >
    {/* Header DocPanel aligné 52px sur le chat header */}
    <div
      style={{
        height: 52,
        borderBottom: `1px solid ${C.border}`,
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        gap: 8,
        background: C.background,
        flexShrink: 0,
      }}
    >
      <DocIcon />
      <span
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: C.foreground,
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        code_civil_art_1245.pdf
      </span>
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: 6,
          color: C.mutedFg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <DownloadIcon />
      </div>
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: 6,
          color: C.mutedFg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CloseIcon />
      </div>
    </div>

    {/* Zone PDF — la page A4 vit dans le flow flex de l'aside et suit donc
        le translateX du parent. Plus de positionnement absolu hors flow. */}
    <div
      style={{
        flex: 1,
        padding: "24px 30px",
        display: "flex",
        justifyContent: "center",
        overflow: "hidden",
        minHeight: 0,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          background: "#fefefe",
          borderRadius: 4,
          padding: "32px 36px",
          boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)",
          fontFamily: serifFont,
          fontSize: 13,
          lineHeight: 1.75,
          color: "#27272a",
          overflow: "hidden",
        }}
      >
        <p
          style={{
            fontWeight: 600,
            fontSize: 15,
            marginBottom: 16,
            color: "#18181b",
          }}
        >
          Code civil
        </p>
        <p
          style={{
            marginBottom: 8,
            fontSize: 11,
            color: "#71717a",
            textTransform: "uppercase",
            letterSpacing: 1,
            fontFamily: sansFont,
          }}
        >
          Livre III · Titre IV bis
        </p>
        <p
          style={{
            fontStyle: "italic",
            color: "#52525b",
            marginBottom: 22,
            fontSize: 12.5,
          }}
        >
          De la responsabilité du fait des produits défectueux
        </p>
        <p style={{ marginBottom: 10, fontWeight: 600 }}>Article 1245</p>
        <p style={{ marginBottom: 18 }}>
          <span
            style={{
              background: `color-mix(in oklch, ${C.highlight} ${highlightOpacity * 100}%, transparent)`,
              padding: "2px 0",
              boxShadow:
                highlightOpacity > 0.3
                  ? `0 0 0 4px color-mix(in oklch, ${C.highlight} ${highlightOpacity * 60}%, transparent)`
                  : "none",
            }}
          >
            Le producteur est responsable du dommage causé par un défaut
            de son produit, qu&apos;il soit ou non lié par un contrat avec
            la victime.
          </span>
        </p>
        <p style={{ marginBottom: 10, fontWeight: 600 }}>Article 1245-1</p>
        <p style={{ color: "#52525b", opacity: 0.65, marginBottom: 16 }}>
          Les dispositions du présent titre s&apos;appliquent à la
          réparation du dommage qui résulte d&apos;une atteinte à la
          personne ou à un bien autre que le produit défectueux lui-même.
        </p>
        <p style={{ marginBottom: 10, fontWeight: 600 }}>Article 1245-2</p>
        <p style={{ color: "#52525b", opacity: 0.65 }}>
          Est un produit tout bien meuble, même s&apos;il est incorporé
          dans un immeuble, y compris les produits du sol, de l&apos;élevage,
          de la chasse et de la pêche.
        </p>
      </div>
    </div>
    </div>
  </aside>
);

const DocIcon: React.FC = () => (
  <svg
    width={16}
    height={16}
    viewBox="0 0 24 24"
    fill="none"
    stroke={C.mutedFg}
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

const DownloadIcon: React.FC = () => (
  <svg
    width={14}
    height={14}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const CloseIcon: React.FC = () => (
  <svg
    width={14}
    height={14}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
