/**
 * Libellés FR des actions du journal d'audit. Centralisé ici pour être
 * cohérent entre la page /admin/audit et la fiche utilisateur (avant, la
 * fiche affichait le slug brut). Toute action émise via recordAudit devrait
 * avoir une entrée — à défaut, on retombe sur le slug (lisible mais brut).
 */
export const ACTION_LABEL: Record<string, string> = {
  "user.create": "Utilisateur créé",
  "user.update": "Utilisateur modifié",
  "user.disable": "Utilisateur désactivé",
  "user.enable": "Utilisateur réactivé",
  "user.delete": "Utilisateur supprimé",
  "user.role": "Rôle modifié",
  "user.password.reset": "Mot de passe réinitialisé",
  "user.quota.update": "Quota modifié",
  "provider.add": "Clé provider ajoutée",
  "provider.delete": "Clé provider supprimée",
  "provider.toggle": "Clé provider activée/désactivée",
  "connector.add": "Connecteur ajouté",
  "connector.delete": "Connecteur supprimé",
  "mcp.add": "Serveur MCP ajouté",
  "mcp.delete": "Serveur MCP supprimé",
  "mcp.toggle": "Serveur MCP activé/désactivé",
  "doc.delete": "Document supprimé",
  "doc.save": "Document enregistré",
  "cabinet.update": "Configuration cabinet modifiée",
  "auth.login": "Connexion",
  "auth.login.failed": "Échec de connexion",
  "auth.password.change": "Mot de passe modifié",
  "auth.totp.enabled": "2FA activée",
  "auth.totp.disabled": "2FA désactivée",
  "auth.totp.failed": "Échec 2FA",
};

export function labelForAction(action: string): string {
  return ACTION_LABEL[action] ?? action;
}

/** Options pour le filtre par action (triées par libellé). */
export const AUDIT_ACTION_OPTIONS: { value: string; label: string }[] =
  Object.entries(ACTION_LABEL)
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "fr"));
