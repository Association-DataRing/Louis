import type { Agent, AgentDefinition, AgentRole } from "../types";
import { DefaultAgent } from "./default";

/**
 * Registry des constructeurs d'agents indexés par rôle. Une nouvelle
 * classe d'agent s'ajoute en l'important ici et en lui réservant son
 * rôle dans `AgentRole`. Aucun autre point du code n'a besoin d'être
 * touché — l'orchestrateur résout dynamiquement.
 */
export const AGENT_REGISTRY: Partial<
  Record<AgentRole, new (def: AgentDefinition) => Agent>
> = {
  "default-chat": DefaultAgent,
};

export function resolveAgentConstructor(
  role: AgentRole
): (new (def: AgentDefinition) => Agent) | undefined {
  return AGENT_REGISTRY[role];
}

export { DefaultAgent } from "./default";
