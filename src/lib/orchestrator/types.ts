import type { StreamTextResult, ToolSet, UIMessage } from "ai";

export type AgentRole =
  | "default-chat"
  | "research"
  | "drafting"
  | "reviewer"
  | "citator"
  | "legifrance"
  | "orchestrator";

export interface AgentDefinition {
  id: string;
  role: AgentRole;
  providerKeyId: string;
  modelOverride?: string | null;
  systemPrompt?: string;
  toolAllowlist?: string[] | null;
}

export interface PipelineConfig {
  name: string;
  description?: string;
  primary: AgentDefinition;
}

export interface AgentContext {
  userId: string;
  conversationId: string;
  messages: UIMessage[];
  documentIds?: string[];
  systemPromptExtras?: string;
  onFinish?: Parameters<typeof import("ai").streamText>[0]["onFinish"];
}

export interface AgentRunResult {
  stream: StreamTextResult<ToolSet, never>;
}

export interface Agent {
  readonly definition: AgentDefinition;
  run(ctx: AgentContext): Promise<AgentRunResult>;
}
