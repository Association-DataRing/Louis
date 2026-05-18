import { DefaultAgent } from "./agents/default";
import type {
  Agent,
  AgentContext,
  AgentDefinition,
  AgentRunResult,
  PipelineConfig,
} from "./types";

/**
 * Map an AgentDefinition to a concrete Agent instance.
 *
 * v0.1 only supports the `default-chat` role; the other roles are reserved
 * for v0.2 (research, drafting, reviewer, citator…). Unknown roles fall
 * back to DefaultAgent so a pipeline using future roles still runs in a
 * degraded mode rather than failing.
 */
export function createAgent(def: AgentDefinition): Agent {
  switch (def.role) {
    case "default-chat":
    default:
      return new DefaultAgent(def);
  }
}

/**
 * Orchestrator — the entry point that the API route calls. v0.1 simply
 * delegates to the primary agent and streams its result back; v0.2 will
 * coordinate sub-agents (research → draft → review → cite) before
 * yielding the final stream.
 */
export class Orchestrator {
  constructor(public readonly pipeline: PipelineConfig) {}

  async run(ctx: AgentContext): Promise<AgentRunResult> {
    const primary = createAgent(this.pipeline.primary);
    return primary.run(ctx);
  }
}
