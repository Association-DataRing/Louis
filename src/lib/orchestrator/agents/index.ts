import type { Agent, AgentDefinition, AgentRole } from "../types";
import { DefaultAgent } from "./default";
import { ResearchAgent } from "./research";
import { CitatorAgent } from "./citator";
import { ReviewerAgent } from "./reviewer";
import { OrchestratorAgent } from "./orchestrator-agent";

/**
 * Registry des constructeurs d'agents indexés par rôle. Pour ajouter un
 * nouveau rôle, importer la classe ici, l'ajouter au registry, et
 * réserver son identifiant dans `AgentRole` (types.ts).
 */
export const AGENT_REGISTRY: Partial<
  Record<AgentRole, new (def: AgentDefinition) => Agent>
> = {
  "default-chat": DefaultAgent,
  orchestrator: OrchestratorAgent,
  research: ResearchAgent,
  citator: CitatorAgent,
  reviewer: ReviewerAgent,
};

export function resolveAgentConstructor(
  role: AgentRole
): (new (def: AgentDefinition) => Agent) | undefined {
  return AGENT_REGISTRY[role];
}

export { DefaultAgent } from "./default";
export { ResearchAgent, RESEARCH_SYSTEM_PROMPT } from "./research";
export { CitatorAgent, CITATOR_SYSTEM_PROMPT } from "./citator";
export { ReviewerAgent, REVIEWER_SYSTEM_PROMPT } from "./reviewer";
export {
  OrchestratorAgent,
  ORCHESTRATOR_SYSTEM_PROMPT,
} from "./orchestrator-agent";
