<!-- Titre : <type>(<scope>): <description courte> — ex. feat(providers): support OVH -->

## Pourquoi

<!-- Quel problème cette PR résout-elle ? Quel cas d'usage ? Liez une issue avec "Closes #N". -->

## Quoi

<!-- Liste des changements visibles, dans l'ordre de lecture du diff. -->

## Comment vérifier

<!-- Étapes pour reproduire / tester localement. Précisez ce qu'un reviewer doit observer. -->

## Checklist

- [ ] `npm run lint` passe
- [ ] `npm run build` passe
- [ ] Pas de secret commité (`.env*` correctement gitignored)
- [ ] Aucune dépendance ajoutée sans justification dans la description
- [ ] Documentation mise à jour si comportement changé (`README` / `CHANGELOG`)
- [ ] Schéma DB ? Migration générée (`npm run db:generate`) et committée
