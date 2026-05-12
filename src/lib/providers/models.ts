import type { ProviderType } from "./catalog";

/**
 * Default model identifier used when a user has not picked one explicitly.
 * Picked to favor low-cost / French / chat-capable models so users can try
 * Louis without surprise bills.
 */
export const DEFAULT_MODEL: Record<ProviderType, string> = {
  mistral: "mistral-small-latest",
  scaleway: "mistral-nemo-instruct-2407",
  ovh: "Meta-Llama-3_1-8B-Instruct",
  albert: "AgentPublic/llama3-instruct-8b",
  anthropic: "claude-sonnet-4-7",
  openai: "gpt-4o-mini",
  openai_compatible: "gpt-3.5-turbo",
};
