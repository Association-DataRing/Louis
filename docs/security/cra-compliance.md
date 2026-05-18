# Conformité EU Cyber Resilience Act (CRA)

> **Source légale** : Règlement (UE) 2024/2847 du Parlement européen et du
> Conseil du 23 octobre 2024 concernant des exigences horizontales en matière
> de cybersécurité pour les produits comportant des éléments numériques
> (« Cyber Resilience Act »).
>
> **Calendrier d'application** :
> - 11 juin 2026 — Article 14 (obligations de signalement) entre en vigueur
> - 11 septembre 2026 — dispositions d'évaluation de la conformité
> - 11 décembre 2027 — application pleine et entière
>
> **Statut** : ce document est un **engagement de conformité préparatoire**.
> Louis étant en alpha (v0.1.x) à la date de publication, certaines
> mesures sont en place, d'autres en cours de formalisation avant la
> date butoir de 2027.

---

## Qualification réglementaire de Louis

### Catégorie de produit

Louis est un **logiciel comportant des éléments numériques** (Article 3 §1),
distribué sous **licence libre AGPL-3.0-or-later**.

### Régime applicable

Le CRA prévoit deux régimes :

1. **Fabricant** (Article 13) — pour les acteurs qui mettent un produit
   sur le marché à titre commercial
2. **Open-source software steward** (Article 24) — régime allégé pour les
   organismes à but non lucratif qui développent / distribuent un logiciel
   libre sans activité commerciale directe sur le produit

**L'association DataRing** porte Louis en tant qu'**open-source software
steward** au sens de l'Article 24, applicable car :

- DataRing est une association à but non lucratif (loi 1901)
- Louis est distribué gratuitement sous AGPL-3.0
- Aucune monétisation directe du moteur (pas de version « entreprise »
  payante, pas de SaaS hébergé par DataRing)
- Cf. [`GOVERNANCE.md`](../../.github/GOVERNANCE.md)

> **À surveiller** : si à l'avenir DataRing ou un tiers commence à
> commercialiser une offre de support payante, formation, ou hébergement
> managé de Louis, cet acteur devient *fabricant* au sens du CRA pour son
> offre commerciale, **avec les obligations complètes**. Le steward reste
> couvert par l'Article 24.

---

## Conformité aux exigences essentielles (Annexe I, Partie I)

| # | Exigence CRA | Statut Louis | Preuve / Mesure |
|---|---|---|---|
| 1 | Conception sécurisée au niveau de risque approprié | ✅ | Threat model documenté ([`threat-model.md`](./threat-model.md)) ; choix BYOK pour éliminer le transit de secrets ; audit log append-only |
| 2 | Aucune vulnérabilité exploitable connue au moment de la mise sur le marché | ✅ | `npm audit --omit=dev --audit-level=high` dans la CI (`.github/workflows/ci.yml`), bloquant ; vérification automatique avant tag de release |
| 3 | Configuration sécurisée par défaut | ✅ | bcrypt cost 12 ; rate-limit Redis activé par défaut ; SSL Postgres strict par défaut ; CSP/HSTS/X-Frame-Options DENY via middleware ; refus des mots de passe < 12 caractères au seed |
| 4 | Protection de la confidentialité (chiffrement) | ✅ | AES-256-GCM pour toutes les clés provider stockées (IV 12 octets aléatoire, tag 16 octets, clé dérivée scrypt) ; HSTS forcé en production ; sessions JWT signées |
| 5 | Protection de l'intégrité (données, programmes, config) | ✅ | Tag d'authentification GCM sur chaque ciphertext (toute altération → `decrypt` lève une exception) ; JWT signé `AUTH_SECRET` ; SBOM CycloneDX signé SHA-256 par release |
| 6 | Traitement limité au strict nécessaire (minimisation) | ✅ | Aucune télémétrie sortante (`NEXT_TELEMETRY_DISABLED=1`) ; aucune analytics tierce ; BYOK = aucune donnée transmise à DataRing ; pas de stockage de prompts utilisateurs côté éditeur |
| 7 | Protection de la disponibilité (résilience DoS) | 🟡 | Rate-limit Redis 3 buckets (chat / upload / login) ; **fail-open** documenté en cas de panne Redis (choix produit assumé pour ne pas bloquer un cabinet en consultation) |
| 8 | Réduction de la surface d'attaque | ✅ | Architecture monolithique single-binary (pas de microservices exposés) ; pas d'API de gestion exposée publiquement ; aucun port additionnel ouvert ; conteneur Docker en user non-root (uid 1001) |
| 9 | Limitation de l'impact des incidents (mitigations) | ✅ | Enveloppe `ToolResult` uniforme `{ ok, reason, error }` qui empêche les fuites de stack traces vers le modèle IA ; rate-limit côté serveur ; audit log append-only inaltérable |
| 10 | Enregistrement des informations de sécurité (audit log) | ✅ | Table `audit_log` append-only ; actions tracées : `auth.*`, `user.*`, `provider.*`, `connector.*`, `doc.delete`, `cabinet.update` ; logger structuré JSON en production |
| 11 | Remédiation des vulnérabilités via mises à jour de sécurité | ✅ | Process documenté dans [`SECURITY.md`](../../.github/SECURITY.md) ; CI Dependabot ; politique de release `vX.Y.Z+security` pour les correctifs |
| 12 | Mécanisme d'installation des mises à jour | ✅ | `git pull && npm ci && npm run db:setup` standard ; image Docker `:latest` repullable ; healthcheck pour rollback automatique côté orchestrateur |
| 13 | Mises à jour de sécurité gratuites pendant la période de support | ✅ | AGPL-3.0 + association sans but lucratif = gratuité structurelle ; période de support définie dans [`SECURITY.md`](../../.github/SECURITY.md) |

---

## Conformité gestion des vulnérabilités (Annexe I, Partie II)

| # | Exigence CRA | Statut Louis | Preuve / Mesure |
|---|---|---|---|
| 1 | Identifier et documenter les composants | ✅ | **SBOM CycloneDX** attaché à chaque GitHub Release (`louis-sbom-vX.Y.Z.cdx.json`) + checksum SHA-256 ; régénérable via `npm run sbom` |
| 2 | Adresser et corriger les vulnérabilités sans délai | ✅ | Dependabot hebdomadaire (`.github/dependabot.yml`) ; politique de bump majors restrictive (`react`, `eslint`, `typescript`, `pdf-parse` ignorés → revue humaine) |
| 3 | Tests de sécurité réguliers | 🟡 | CI : `npm audit` + license-checker à chaque push ; tests unitaires Vitest sur crypto + rate-limit ; **pas encore de scan SAST/DAST automatisé** (prévu v0.2 via CodeQL Default Setup) |
| 4 | Diffusion publique d'information sur les vulnérabilités corrigées | ✅ | Section sécurité de chaque entrée [`docs/CHANGELOG.md`](../CHANGELOG.md) ; GitHub Security Advisories publiés pour les CVSS ≥ 7.0 |
| 5 | Politique de divulgation coordonnée | ✅ | [`SECURITY.md`](../../.github/SECURITY.md) : `security@data-ring.net`, réponse sous 72h ouvrées, fenêtre de divulgation négociée |
| 6 | Information publique sur les vulnérabilités fixées | ✅ | GitHub Security Advisories activés sur le dépôt ; CVE réservés via GHSA pour les CVSS ≥ 7.0 |
| 7 | Mécanisme de distribution sécurisée des updates | 🟡 | Releases signées via `git tag -s` (GPG) ; images Docker via GHCR avec digest immuable ; **`provenance:true` buildx + cosign à activer en v0.2** |
| 8 | Mises à jour sans délai, gratuites | ✅ | AGPL gratuit ; `npm ci` ≈ 30s ; redéploiement Docker ≈ 30s |

---

## Conformité Article 14 — Obligations de signalement

Conformément à l'Article 14 §1 du CRA, en cas de **vulnérabilité activement
exploitée** affectant Louis, DataRing s'engage à :

| Délai | Action | Destinataire |
|---|---|---|
| ≤ 24 heures | Notification précoce | ENISA et CSIRT-FR (autorité nationale désignée) |
| ≤ 72 heures | Notification de la vulnérabilité avec évaluation initiale | ENISA et CSIRT-FR |
| ≤ 14 jours | Rapport final (mesures correctives, impact estimé) | ENISA et CSIRT-FR |

En parallèle, conformément à l'Article 14 §2 :

- **Information des utilisateurs** : publication immédiate sur les GitHub
  Security Advisories du dépôt avec un guide d'application de la
  mitigation (workaround) en attendant le correctif.
- **Coordination divulgation** : si la vulnérabilité a été signalée par un
  tiers, la fenêtre de divulgation par défaut est de **90 jours** à
  compter de la première réponse de l'équipe DataRing (extensible si le
  correctif est complexe), conformément à la pratique standard du
  secteur (CERT/CC, ISO/IEC 29147).

---

## Conformité Article 24 — Obligations spécifiques au steward

| Obligation Article 24 | Statut Louis | Mesure |
|---|---|---|
| Politique de cybersécurité documentée | ✅ | [`SECURITY.md`](../../.github/SECURITY.md), [`threat-model.md`](./threat-model.md), ce document |
| Processus de gestion des vulnérabilités | ✅ | `SECURITY.md` § Signaler une vulnérabilité + § Notre engagement |
| Coopération avec les autorités de surveillance | 🟡 | Engagement formalisé dans ce document. À activer dès la première vulnérabilité notable. |
| Identification d'un point de contact unique | ✅ | `security@data-ring.net` |
| Documentation de la chaîne d'approvisionnement | ✅ | SBOM CycloneDX par release |

---

## Tableau récapitulatif (vue rapide)

| Catégorie | Conforme | Partiel | Non conforme |
|---|---|---|---|
| **Annexe I Partie I** (sécurité produit) | 12/13 | 1/13 | 0/13 |
| **Annexe I Partie II** (gestion vulnérabilités) | 6/8 | 2/8 | 0/8 |
| **Article 14** (signalement) | ✅ engagement formalisé | — | — |
| **Article 24** (steward) | 4/5 | 1/5 | 0/5 |

**Items partiels à finaliser avant décembre 2027** :

1. Scan SAST/DAST automatisé (CodeQL Default Setup) — *prévu v0.2*
2. Signature `cosign` des images Docker + attestation SLSA — *prévu v0.2*
3. Activation effective de la coopération ENISA/CSIRT-FR à la première
   vulnérabilité affichant un signalement

**Aucune zone rouge à date**.

---

## Limites et clauses

Ce document n'a pas valeur d'**évaluation de conformité officielle** au
sens du CRA. Il s'agit d'une **auto-évaluation publique** par les
mainteneurs, dans un esprit de transparence et d'engagement préparatoire.

L'évaluation de conformité formelle sera réalisée par un organisme
notifié au moment où Louis quittera le statut alpha et serait soumis aux
exigences pleines de l'Article 13 (si le contexte juridique de
distribution évolue vers le régime fabricant).

Pour toute question sur ce document : `contact@data-ring.net`.

---

## Références

- Règlement (UE) 2024/2847 — texte intégral : <https://eur-lex.europa.eu/eli/reg/2024/2847/oj>
- ENISA — guidance CRA : <https://www.enisa.europa.eu>
- CycloneDX — spec et tooling : <https://cyclonedx.org>
- ISO/IEC 29147 — coordinated vulnerability disclosure
- ISO/IEC 30111 — vulnerability handling processes
