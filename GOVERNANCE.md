# Gouvernance de Louis

Louis est un projet **porté par l'association DataRing**. Ce document
décrit comment les décisions sont prises et qui les prend.

## Statut actuel — alpha solo-maintainer

Le projet est en phase alpha. Un mainteneur unique (voir `CODEOWNERS`)
prend toutes les décisions structurantes :

- Architecture et choix technologiques
- Acceptation / refus des contributions externes
- Calendrier des releases
- Politique de versioning (SemVer)
- Politique de sécurité (cf. `SECURITY.md`)

Le mainteneur agit pour le compte de **l'association DataRing**.

## Processus de décision

### Petits changements (typo, dépendances, correctif mineur)

PR direct, review puis merge. Pas d'issue préalable nécessaire.

### Changements fonctionnels

1. **Ouvrir une issue** décrivant le besoin et l'approche envisagée
2. Attendre un retour favorable du mainteneur avant de coder
3. Ouvrir la PR avec lien vers l'issue
4. Review puis merge si validée

### Changements structurants

Pour tout changement qui touche :
- L'architecture (auth, BYOK, RAG, schéma DB structurel)
- La compatibilité (rupture API, breaking changes)
- La sécurité (modèle de menace, surface d'attaque)
- La licence ou la politique du projet

→ Issue obligatoire, discussion publique, **Architecture Decision Record
(ADR)** ajouté dans `docs/architecture/decisions/` avant l'implémentation.

## Releases

- **SemVer** : `MAJOR.MINOR.PATCH`
- `MAJOR` : rupture de compatibilité (schéma DB nécessitant migration manuelle,
  rupture API REST documentée, changement de licence)
- `MINOR` : nouvelle fonctionnalité rétro-compatible
- `PATCH` : correctif de bug
- **Pas d'amendement post-tag.** Une fois `vX.Y.Z` poussé, un correctif est
  `vX.Y.(Z+1)`.
- Chaque release : entrée datée dans `CHANGELOG.md`, GitHub Release avec
  notes, SBOM joint, image Docker publiée sur GHCR.

## Évolution de la gouvernance

À mesure que la communauté grandit, ce document évoluera. Étapes prévues :

- **v0.2** : Ajout d'un ou deux co-mainteneurs, processus de review à 2 yeux
  sur les PR sécurité
- **v1.0** : Comité de pilotage avec représentants de l'association DataRing,
  contributeurs majeurs, et utilisateurs en production
- **v1.0+** : Politique de release LTS sur les versions majeures

## Conflits d'intérêts

Tout mainteneur qui a un conflit d'intérêts (employeur direct concerné,
financement personnel impacté) sur une décision spécifique se récuse de
cette décision.

## Code de conduite

L'application du code de conduite (cf. `CODE_OF_CONDUCT.md`) relève des
mainteneurs. Les rapports vont à **conduct@data-ring.net**.

## Licence et signature des contributions

Louis est sous **AGPL-3.0-or-later**. En ouvrant une PR vous confirmez :

- Avoir le droit de soumettre ce code (pas de copie d'une codebase sous
  licence incompatible)
- Accepter sa redistribution sous AGPL-3.0-or-later
- Que votre contribution est signée (`git commit -s`, DCO — Developer
  Certificate of Origin)

Pas de Contributor License Agreement (CLA) séparé. La DCO suffit.
