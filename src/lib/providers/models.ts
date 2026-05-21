import type { ProviderType } from "./catalog";

export type ModelOption = {
  id: string;
  label: string;
  hint?: string;
};

/**
 * Curated catalogue of common models per provider. Users with custom
 * deployments (Scaleway projects, OVH endpoints, self-hosted Ollama) keep
 * the freedom to pick the matching id from this list — or fall back to
 * the catalog's DEFAULT_MODEL when nothing matches.
 */
export const MODEL_CATALOG: Record<ProviderType, ModelOption[]> = {
  mistral: [
    { id: "mistral-small-latest", label: "Mistral Small", hint: "Rapide, peu coûteux" },
    { id: "mistral-medium-latest", label: "Mistral Medium" },
    { id: "mistral-large-latest", label: "Mistral Large", hint: "Plus capable" },
    { id: "codestral-latest", label: "Codestral", hint: "Spécialisé code" },
    { id: "ministral-8b-latest", label: "Ministral 8B" },
  ],
  scaleway: [
    { id: "mistral-nemo-instruct-2407", label: "Mistral Nemo (12B)" },
    { id: "mistral-small-3-instruct-2503", label: "Mistral Small 3 (24B)" },
    { id: "llama-3.3-70b-instruct", label: "Llama 3.3 70B" },
    { id: "llama-3.1-8b-instruct", label: "Llama 3.1 8B" },
    { id: "qwen2.5-coder-32b-instruct", label: "Qwen 2.5 Coder 32B" },
  ],
  ovh: [
    { id: "Meta-Llama-3_1-8B-Instruct", label: "Llama 3.1 8B" },
    { id: "Meta-Llama-3_1-70B-Instruct", label: "Llama 3.1 70B" },
    { id: "Mistral-7B-Instruct-v0_3", label: "Mistral 7B v0.3" },
    { id: "Mixtral-8x7B-Instruct-v0_1", label: "Mixtral 8x7B" },
  ],
  albert: [
    { id: "AgentPublic/llama3-instruct-8b", label: "Llama 3 Instruct 8B" },
    { id: "AgentPublic/llama3-70b-instruct", label: "Llama 3 Instruct 70B" },
  ],
  anthropic: [
    { id: "claude-sonnet-4-7", label: "Claude Sonnet 4.7", hint: "Équilibré" },
    { id: "claude-opus-4-7", label: "Claude Opus 4.7", hint: "Plus capable" },
    { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", hint: "Rapide" },
  ],
  openai: [
    { id: "gpt-4o-mini", label: "GPT-4o mini", hint: "Rapide, peu coûteux" },
    { id: "gpt-4o", label: "GPT-4o" },
    { id: "gpt-4.1-mini", label: "GPT-4.1 mini" },
    { id: "gpt-4.1", label: "GPT-4.1" },
    { id: "o3-mini", label: "o3-mini", hint: "Raisonnement" },
  ],
  openai_compatible: [
    { id: "gpt-3.5-turbo", label: "gpt-3.5-turbo (par défaut)" },
    { id: "llama3.1:8b", label: "Llama 3.1 8B (Ollama)" },
    { id: "mistral-small", label: "mistral-small (Ollama)" },
  ],
  openrouter: [
    {
      id: "anthropic/claude-sonnet-4.5",
      label: "Claude Sonnet 4.5",
      hint: "Équilibré, via Anthropic",
    },
    {
      id: "anthropic/claude-opus-4.5",
      label: "Claude Opus 4.5",
      hint: "Plus capable",
    },
    {
      id: "openai/gpt-5",
      label: "GPT-5",
      hint: "OpenAI flagship",
    },
    {
      id: "openai/gpt-4o-mini",
      label: "GPT-4o mini",
      hint: "Rapide, peu coûteux",
    },
    {
      id: "mistralai/mistral-large",
      label: "Mistral Large",
      hint: "via OpenRouter (peut éviter les 429)",
    },
    {
      id: "meta-llama/llama-3.1-405b-instruct",
      label: "Llama 3.1 405B",
      hint: "Open source",
    },
    {
      id: "google/gemini-2.5-pro",
      label: "Gemini 2.5 Pro",
    },
    {
      id: "qwen/qwen-2.5-72b-instruct",
      label: "Qwen 2.5 72B",
      hint: "Open source, fort en code",
    },
  ],
};

/**
 * Default model identifier used when a user has not picked one explicitly.
 * Picked to favor low-cost / French / chat-capable models so users can try
 * Louis without surprise bills.
 */
export const DEFAULT_MODEL: Record<ProviderType, string> = {
  mistral: "mistral-small-latest",
  scaleway: "mistral-small-3-instruct-2503",
  ovh: "Meta-Llama-3_1-8B-Instruct",
  albert: "AgentPublic/llama3-instruct-8b",
  anthropic: "claude-sonnet-4-7",
  openai: "gpt-4o-mini",
  openai_compatible: "gpt-3.5-turbo",
  openrouter: "anthropic/claude-sonnet-4.5",
};
