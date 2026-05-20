import {
  IconBuildingBank,
  IconCloud,
  IconCpu,
  IconFlag,
  IconRobot,
  IconServer2,
  IconSparkles,
} from "@tabler/icons-react";
import type { Icon } from "@tabler/icons-react";

export type ProviderType =
  | "mistral"
  | "scaleway"
  | "ovh"
  | "albert"
  | "anthropic"
  | "openai"
  | "openai_compatible"
  | "openrouter";

export type SovereigntyTier = "fr" | "eu" | "us";

export type ProviderMeta = {
  type: ProviderType;
  label: string;
  description: string;
  icon: Icon;
  /** Where users get their API key. */
  docsUrl: string;
  /** Sovereignty classification — drives the visual badge. */
  sovereignty: SovereigntyTier;
  /** True when the user must provide a custom base URL (e.g. self-hosted). */
  requiresBaseUrl: boolean;
  /**
   * Default base URL used for connection tests. `null` means we cannot test
   * generically (provider-specific endpoints required).
   */
  testBaseUrl: string | null;
  /** Some providers use x-api-key headers instead of Authorization: Bearer. */
  authStyle: "bearer" | "x-api-key";
  /** Placeholder shown in the baseUrl input when `requiresBaseUrl` is true. */
  baseUrlPlaceholder?: string;
  /** Help text shown under the baseUrl input when `requiresBaseUrl` is true. */
  baseUrlHelp?: string;
  /** SVG logo path under /public, used in CutoutCard media. */
  logo: string;
  /** Brand-tinted background for the media zone (CSS color or gradient). */
  accent: string;
  /** Foreground color used to tint a monochrome logo against the accent. */
  logoTint: string;
};

export const PROVIDER_CATALOG: Record<ProviderType, ProviderMeta> = {
  mistral: {
    type: "mistral",
    label: "Mistral",
    description: "Modèles français de référence — Le Chat, Mistral Large, Codestral.",
    icon: IconSparkles,
    docsUrl: "https://console.mistral.ai/api-keys/",
    sovereignty: "fr",
    requiresBaseUrl: false,
    testBaseUrl: "https://api.mistral.ai/v1",
    authStyle: "bearer",
    logo: "/logos/providers/mistral.svg",
    accent: "linear-gradient(135deg, #FF7000 0%, #FA520F 100%)",
    logoTint: "#FFFFFF",
  },
  scaleway: {
    type: "scaleway",
    label: "Scaleway Generative APIs",
    description: "Modèles open-source hébergés en France par Scaleway.",
    icon: IconCloud,
    docsUrl: "https://console.scaleway.com/iam/api-keys",
    sovereignty: "fr",
    requiresBaseUrl: true,
    testBaseUrl: null,
    authStyle: "bearer",
    baseUrlPlaceholder: "https://api.scaleway.ai/VOTRE_PROJECT_ID/v1",
    baseUrlHelp:
      "Scaleway nécessite l'ID de votre projet dans l'URL. Récupérez-le sur console.scaleway.com → Projets, puis remplacez VOTRE_PROJECT_ID ci-dessus.",
    logo: "/logos/providers/scaleway.svg",
    accent: "linear-gradient(135deg, #4F0599 0%, #2B0259 100%)",
    logoTint: "#FFFFFF",
  },
  ovh: {
    type: "ovh",
    label: "OVHcloud AI Endpoints",
    description: "Endpoints IA hébergés en France par OVHcloud.",
    icon: IconServer2,
    docsUrl: "https://endpoints.ai.cloud.ovh.net/",
    sovereignty: "fr",
    requiresBaseUrl: true,
    testBaseUrl: null,
    authStyle: "bearer",
    baseUrlPlaceholder:
      "https://meta-llama-3-1-8b-instruct.endpoints.kepler.ai.cloud.ovh.net/api/openai_compat/v1",
    baseUrlHelp:
      "OVH expose un endpoint par modèle. Copiez l'URL OpenAI-compatible depuis endpoints.ai.cloud.ovh.net après avoir choisi votre modèle.",
    logo: "/logos/providers/ovh.svg",
    accent: "linear-gradient(135deg, #123F6D 0%, #001F3D 100%)",
    logoTint: "#FFFFFF",
  },
  albert: {
    type: "albert",
    label: "Albert (Etalab)",
    description: "Plateforme IA souveraine de l'État français.",
    icon: IconFlag,
    docsUrl: "https://albert.api.etalab.gouv.fr/",
    sovereignty: "fr",
    requiresBaseUrl: false,
    testBaseUrl: "https://albert.api.etalab.gouv.fr/v1",
    authStyle: "bearer",
    logo: "/logos/providers/albert.svg",
    accent: "linear-gradient(135deg, #000091 0%, #1212FF 60%, #E1000F 100%)",
    logoTint: "#FFFFFF",
  },
  anthropic: {
    type: "anthropic",
    label: "Anthropic",
    description: "Claude Opus, Sonnet, Haiku — modèles US.",
    icon: IconRobot,
    docsUrl: "https://console.anthropic.com/settings/keys",
    sovereignty: "us",
    requiresBaseUrl: false,
    testBaseUrl: "https://api.anthropic.com/v1",
    authStyle: "x-api-key",
    logo: "/logos/providers/anthropic.svg",
    accent: "linear-gradient(135deg, #1F1F1E 0%, #0E0E0D 100%)",
    logoTint: "#D97757",
  },
  openai: {
    type: "openai",
    label: "OpenAI",
    description: "GPT-4, GPT-5, o-séries — modèles US.",
    icon: IconCpu,
    docsUrl: "https://platform.openai.com/api-keys",
    sovereignty: "us",
    requiresBaseUrl: false,
    testBaseUrl: "https://api.openai.com/v1",
    authStyle: "bearer",
    logo: "/logos/providers/openai.svg",
    accent: "linear-gradient(135deg, #10A37F 0%, #0B6B53 100%)",
    logoTint: "#FFFFFF",
  },
  openai_compatible: {
    type: "openai_compatible",
    label: "Endpoint OpenAI-compatible",
    description: "Ollama, vLLM, llama.cpp, LiteLLM ou tout serveur OpenAI-compatible.",
    icon: IconBuildingBank,
    docsUrl: "https://ollama.com/",
    sovereignty: "eu",
    requiresBaseUrl: true,
    testBaseUrl: null,
    authStyle: "bearer",
    baseUrlPlaceholder: "http://localhost:11434/v1",
    baseUrlHelp:
      "Endpoint OpenAI-compatible (Ollama, vLLM, llama.cpp, LiteLLM, etc.).",
    logo: "/logos/providers/openai_compatible.svg",
    accent: "linear-gradient(135deg, #3F3F46 0%, #18181B 100%)",
    logoTint: "#A1A1AA",
  },
  openrouter: {
    type: "openrouter",
    label: "OpenRouter",
    description:
      "Aggrégateur multi-providers (Claude, GPT, Mistral, Llama, Gemini…) avec une clé unique.",
    icon: IconCloud,
    docsUrl: "https://openrouter.ai/keys",
    sovereignty: "us",
    requiresBaseUrl: false,
    testBaseUrl: "https://openrouter.ai/api/v1",
    authStyle: "bearer",
    logo: "/logos/providers/openai_compatible.svg",
    accent: "linear-gradient(135deg, #6E6BFF 0%, #2D2BB8 100%)",
    logoTint: "#FFFFFF",
  },
};

export const PROVIDER_TYPES = Object.keys(PROVIDER_CATALOG) as ProviderType[];

export const SOVEREIGNTY_LABEL: Record<SovereigntyTier, string> = {
  fr: "FR",
  eu: "UE",
  us: "US",
};
