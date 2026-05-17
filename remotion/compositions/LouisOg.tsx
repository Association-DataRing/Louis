import { AbsoluteFill } from "remotion";
import { loadFont as loadGaramond } from "@remotion/google-fonts/EBGaramond";
import { loadFont as loadGeist } from "@remotion/google-fonts/Geist";

const { fontFamily: serifFont } = loadGaramond("normal", {
  weights: ["400", "500", "600"],
});
const { fontFamily: sansFont } = loadGeist("normal", {
  weights: ["400", "500", "600"],
});

const C = {
  background: "oklch(0.99 0.003 265)",
  foreground: "oklch(0.16 0.01 265)",
  primary: "oklch(0.32 0.18 265)",
  mutedFg: "oklch(0.5 0.012 265)",
  border: "oklch(0.92 0.008 265)",
};

export const LouisOg: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: C.background,
        fontFamily: sansFont,
        color: C.foreground,
        padding: "80px 100px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.04,
          backgroundImage:
            "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 16, zIndex: 1 }}>
        <svg
          width="44"
          height="44"
          viewBox="0 0 24 24"
          fill="none"
          stroke={C.primary}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 3 L20 7 V12 C20 17 16 20 12 21 C8 20 4 17 4 12 V7 Z" />
          <path d="M12 9 V14" />
          <path d="M9.5 14 H14.5" />
        </svg>
        <span
          style={{
            fontFamily: serifFont,
            fontSize: 44,
            fontWeight: 500,
            letterSpacing: "-0.02em",
          }}
        >
          Louis
        </span>
        <span
          style={{
            fontSize: 18,
            color: C.mutedFg,
            border: `1px solid ${C.border}`,
            padding: "4px 10px",
            borderRadius: 6,
            marginLeft: 8,
            fontFamily: "Menlo, monospace",
          }}
        >
          by DataRing
        </span>
      </div>

      <div style={{ zIndex: 1 }}>
        <h1
          style={{
            fontFamily: serifFont,
            fontSize: 110,
            lineHeight: 1.02,
            letterSpacing: "-0.025em",
            margin: 0,
            maxWidth: 1000,
          }}
        >
          L&apos;intelligence juridique{" "}
          <span style={{ fontStyle: "italic", color: C.primary }}>
            strictement souveraine.
          </span>
        </h1>

        <p
          style={{
            fontSize: 32,
            color: C.mutedFg,
            marginTop: 36,
            maxWidth: 900,
            lineHeight: 1.4,
          }}
        >
          IA open-source pour les professions juridiques. BYOK, auto-hébergée,
          AGPL-3.0.
        </p>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          zIndex: 1,
          paddingTop: 32,
          borderTop: `1px solid ${C.border}`,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 14,
            fontSize: 22,
            color: C.foreground,
          }}
        >
          <Chip>Mistral</Chip>
          <Chip>Scaleway</Chip>
          <Chip>OVHcloud</Chip>
          <Chip>Albert</Chip>
        </div>
        <span
          style={{
            fontSize: 20,
            color: C.mutedFg,
            fontFamily: "Menlo, monospace",
          }}
        >
          github.com/D4kooo/louis
        </span>
      </div>
    </AbsoluteFill>
  );
};

const Chip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span
    style={{
      border: `1px solid ${C.border}`,
      padding: "8px 16px",
      borderRadius: 999,
      fontSize: 20,
      fontWeight: 500,
    }}
  >
    {children}
  </span>
);
