# ADR 0005 — Chiffrement des données clients (à enveloppe, par utilisateur et par groupe)

- **Statut :** Proposé
- **Date :** 2026-06-10
- **Décideurs :** Association DataRing — Lab IA
- **Remplace / complète :** [0001-byok](./0001-byok.md) (chiffrement des clés provider), [0003-pgvector](./0003-pgvector.md) (impact RAG)
- **Portée :** documents clients, texte extrait, chunks/embeddings RAG, conversations, mémoire dossiers

---

## 1. Contexte & motivation

Louis manipule la matière la plus sensible qui soit : les **pièces de dossiers d'avocats**, couvertes par le **secret professionnel** (art. 66-5 de la loi du 31 décembre 1971, art. 226-13 du Code pénal). Pour cette matière, une fuite n'est pas un incident IT : c'est une **violation du secret professionnel**, une atteinte aux droits de la défense, et une faute déontologique engageant l'avocat.

Or le contexte 2025-2026 est sans précédent. La France est devenue **le pays le plus touché d'Europe** : plus de **2,6 milliards de données compromises en 2025** (+23 % vs 2024), et la série noire frappe désormais l'État lui-même :

- **Cegedim Santé** (logiciel médical) — fuite révélée fin 2025 / début 2026 : **~15 millions de patients** exposés, dont ~170 000 avec des **annotations médicales sensibles**.
- **Fichiers de police** — un groupe revendique l'accès aux fichiers de **16,4 millions de citoyens** (l'État reconnaît un accès).
- **HubEE** (Dinum / Urssaf / OFII) — plateforme **gouvernementale** d'échange de pièces justificatives, attaque détectée le 9 janvier 2026.
- **Free Mobile** — **24 millions** d'abonnés, amende CNIL de **42 M€** (janvier 2026).
- Le ministre de l'Intérieur reconnaît, après la cyberattaque de mi-décembre 2025, un « **manque d'hygiène informatique** ».

Le facteur aggravant : **>27 millions de postes infectés par des infostealers** en 2025. La menace dominante n'est plus seulement l'intrusion réseau sophistiquée, mais **l'exfiltration de bases et de stockages au repos** (dumps SQL, buckets objet, sauvegardes, accès d'un administrateur compromis, voisin de palier en hébergement mutualisé).

**Constat sur Louis aujourd'hui.** L'état actuel ne protège pas contre ce modèle de menace :

| Donnée | État au repos (v0.1) |
|---|---|
| Clés provider / connecteur | ✅ Chiffrées (AES-256-GCM, clé dérivée de `ENCRYPTION_KEY` via scrypt) |
| **Documents (object storage)** | ❌ **En clair** (PUT brut, cf. `src/lib/storage.ts`) |
| **Texte extrait (`documents.extracted_text`)** | ❌ **En clair** en base |
| **Chunks + embeddings (`document_chunks`)** | ❌ **En clair** en base |
| **Messages de conversation** | ❌ **En clair** en base |
| Appartenance / partage des documents | `documents.user_id` (1 propriétaire), **aucun modèle de partage cryptographique** |

Un dump Postgres ou un accès au bucket suffit donc aujourd'hui à exposer **l'intégralité des pièces clients en clair**. Inacceptable pour la cible.

---

## 2. Objectif & non-objectifs

### Objectif
Garantir que les données clients soient **inexploitables au repos** sans les clés des utilisateurs autorisés, et que le **partage** (entre confrères d'un cabinet, au sein d'une équipe sur un dossier) repose sur la **cryptographie**, pas seulement sur un contrôle d'accès applicatif.

### Non-objectifs (explicites)
- **Protéger du fournisseur d'IA externe.** Si le cabinet utilise Mistral/Anthropic/OpenAI, le **clair part chez le provider** au moment de l'inférence. Ce risque relève du choix de provider (cf. BYOK + souveraineté), pas du chiffrement au repos. La protection maximale impose **l'inférence locale** (cf. §9).
- **Protéger du runtime serveur compromis en temps réel.** Pour qu'un LLM traite un document, il faut le **clair en mémoire** côté serveur (modèle « at-rest ») ou côté client (modèle « E2E »). Un attaquant ayant un **RCE actif** sur le serveur pendant qu'un utilisateur travaille pourra lire ce qui transite. Le chiffrement au repos protège le **stockage**, pas l'exécution.
- Remplacer la sauvegarde, la journalisation d'audit, ou le durcissement réseau. Le chiffrement est **une couche**, pas la seule.

> **La phrase à retenir pour la com' cabinet :** *« Même si quelqu'un vole toute la base de Louis, il ne vole que du bruit. »*

---

## 3. Modèle de menace

| Adversaire | Couvert par cet ADR ? |
|---|---|
| Vol / fuite d'un **dump Postgres** | ✅ Oui |
| Vol / fuite du **bucket objet** (S3/MinIO/OVH) | ✅ Oui |
| Fuite d'une **sauvegarde** | ✅ Oui |
| **Voisin de palier** en hébergement mutualisé | ✅ Oui |
| **Administrateur infra** (DBA, hébergeur) sans les clés utilisateurs | ✅ Oui (modèle E2E) / 🟠 partiel (modèle at-rest : il peut lire la master key) |
| **Utilisateur non autorisé** de la même instance | ✅ Oui (crypto par-user/groupe) |
| **Infostealer sur le poste d'un avocat** | 🟠 Partiel (vole ce que CET utilisateur déchiffre, pas le reste) |
| **Provider d'IA externe** | ❌ Non (relève du choix de provider / inférence locale) |
| **RCE actif sur le serveur** pendant une session | ❌ Non (le clair transite en mémoire) |

---

## 4. Décision

Adopter un **chiffrement hybride à enveloppe** (*envelope encryption*) :

1. **Les données** (documents, texte extrait, messages) sont chiffrées par une **clé symétrique aléatoire par objet** — la *Data Encryption Key* (**DEK**), en **XChaCha20-Poly1305**.
2. **La DEK** (32 octets) est **emballée** (*wrapped*) pour chaque **principal autorisé** (utilisateur ou groupe) à l'aide de sa **clé publique X25519** (*sealed box* libsodium).
3. **Partager** = ajouter un *wrap* de la DEK. **Révoquer** = retirer un *wrap* (+ rotation, cf. §8). **On ne re-chiffre jamais le document**, seulement la petite DEK.

> Asymétrique **pour les clés**, symétrique **pour les données**. C'est le schéma éprouvé (PGP, AWS KMS, Signal, age…), adapté ici à une hiérarchie utilisateurs/groupes.

---

## 5. Primitives cryptographiques

On standardise sur **libsodium** (`libsodium-wrappers-sumo` côté Node, déjà la base de l'écosystème DataRing — cf. projet CipherLayer).

| Usage | Primitive | Détail |
|---|---|---|
| Chiffrement des **données** | `crypto_secretstream_xchacha20poly1305` (gros fichiers, streaming) ou `crypto_aead_xchacha20poly1305_ietf` (blobs) | DEK 256 bits aléatoire/objet, nonce 192 bits aléatoire (XChaCha tolère le nonce aléatoire). |
| **Emballage** de la DEK vers un destinataire | `crypto_box_seal` (*sealed box*) | Anonyme, ne requiert que la **pubkey** du destinataire. Idéal pour « wrap cette DEK pour ce user/groupe ». |
| **Keypair** utilisateur / groupe | `crypto_box_keypair` (**X25519**) | |
| **Clé privée au repos** | `crypto_secretbox` + clé dérivée du mot de passe via **Argon2id** (`crypto_pwhash`) | Le serveur ne stocke que `enc_privkey`, `salt`, `pubkey`. La privée n'existe en clair **qu'en mémoire de session**. |
| Couche « at-rest » initiale (Phase 1) | Master key existante (`ENCRYPTION_KEY`, AES-256-GCM/scrypt) | Permet de chiffrer immédiatement sans déployer les keypairs (cf. §10). |
| **Intégrité** journal d'audit | Chaînage de hash (SHA-256) | Confidentialité non requise ; détecter l'altération. |

---

## 6. Hiérarchie des clés

```
Mot de passe utilisateur
        │  Argon2id(salt)
        ▼
  clé de déverrouillage ──► déchiffre ──► CLÉ PRIVÉE UTILISATEUR (X25519)
                                                │
              ┌─────────────────────────────────┼───────────────────────────┐
              ▼                                 ▼                           ▼
   unwrap (sealed box)                unwrap clé privée GROUPE      unwrap DEK perso
   des DEK partagées avec MOI          (wrappée pour chaque membre)  (docs privés)
              │                                 │
              ▼                                 ▼
        DEK document                      unwrap des DEK
              │                           partagées au GROUPE
              ▼                                 │
   déchiffrement XChaCha20 ◄──────────────────────┘
```

- **Document privé** : la DEK n'est *wrappée* que pour la pubkey du **propriétaire**.
- **Document partagé** : la DEK est *wrappée* en plus pour la pubkey du/des **groupe(s)** et/ou d'autres utilisateurs.
- **Rôle RBAC** (admin/membre) = *qui a le droit de demander*. **La crypto** = *qui peut déchiffrer*. Défense en profondeur : un bug d'autorisation applicatif ne donne pas le clair.

---

## 7. Modèle de données (Drizzle)

```ts
// Clés d'identité par utilisateur
userKeys = pgTable("user_keys", {
  userId:        uuid().primaryKey().references(() => users.id),
  publicKey:     bytea().notNull(),          // X25519 pubkey (32o)
  encPrivateKey: bytea().notNull(),          // privkey chiffrée (secretbox)
  kdfSalt:       bytea().notNull(),          // sel Argon2id
  kdfParams:     jsonb().notNull(),          // opslimit/memlimit Argon2id
  createdAt:     timestamp().defaultNow(),
});

// Groupes / équipes de travail
groups = pgTable("groups", {
  id:        uuid().primaryKey().defaultRandom(),
  name:      text().notNull(),
  publicKey: bytea().notNull(),              // X25519 pubkey du groupe
  createdBy: uuid().references(() => users.id),
  createdAt: timestamp().defaultNow(),
});

// La privée du GROUPE, wrappée pour chaque membre (sealed box -> pubkey du membre)
groupKeys = pgTable("group_keys", {
  groupId:           uuid().references(() => groups.id),
  userId:            uuid().references(() => users.id),
  wrappedPrivateKey: bytea().notNull(),      // crypto_box_seal(groupPriv, userPub)
  role:              text().notNull(),       // "owner" | "editor" | "viewer"
  keyEpoch:          integer().notNull(),    // pour la rotation (cf. §8)
}, (t) => [primaryKey({ columns: [t.groupId, t.userId, t.keyEpoch] })]);

// La DEK de chaque document, wrappée pour chaque principal autorisé
documentKeys = pgTable("document_keys", {
  documentId:     uuid().references(() => documents.id),
  principalType:  text().notNull(),          // "user" | "group"
  principalId:    uuid().notNull(),          // user.id ou group.id
  wrappedDek:     bytea().notNull(),         // crypto_box_seal(DEK, principalPub)
  keyEpoch:       integer().notNull(),
}, (t) => [primaryKey({ columns: [t.documentId, t.principalType, t.principalId] })]);

// Modifs sur les tables existantes :
// documents.storage_key        -> pointe vers le blob CHIFFRÉ
// documents.dek_nonce          -> nonce XChaCha du document
// documents.extracted_text     -> SUPPRIMÉ du clair : déplacé en blob chiffré
//                                 (ou colonne enc_extracted_text + nonce)
// document_chunks.embedding     -> cf. arbitrage §8 (pgvector)
```

`bytea` = binaire natif Postgres (pas de base64). Toutes les valeurs *wrapped* sont des sealed boxes ; aucune clé en clair ne touche le disque.

---

## 8. Flux

**Upload (chiffrement)**
1. Auth + RBAC. Générer `DEK = randombytes(32)`.
2. `ciphertext = XChaCha20Poly1305(plaintext, DEK, nonce)` → PUT du **blob chiffré** en object storage.
3. Idem pour le **texte extrait** (blob chiffré séparé) avant insertion.
4. `wrap = crypto_box_seal(DEK, ownerPubKey)` → ligne `document_keys` (principal = user propriétaire).
5. Effacer la DEK de la mémoire.

**Partager avec un groupe**
- `wrap = crypto_box_seal(DEK, groupPubKey)` → nouvelle ligne `document_keys` (principal = group). *(Nécessite d'avoir la DEK en clair, donc d'être déjà destinataire — normal.)*

**Accès / déchiffrement à la demande**
1. Login : `userPriv = secretbox_open(enc_privkey, Argon2id(password, salt))` → **gardée en mémoire de session** (cf. §8-cache).
2. Lecture d'un doc : trouver le *wrap* applicable (perso, ou via un groupe dont je suis membre), `DEK = box_seal_open(wrap, userPriv | groupPriv)`.
3. `plaintext = XChaCha20_open(ciphertext, DEK, nonce)` en mémoire → nourrir le LLM / le DocPanel.
4. **Flush** : zéro-iser DEK et plaintext dès la réponse rendue.

**Révocation d'un membre**
1. Supprimer ses lignes `group_keys` / `document_keys`.
2. **Rotation** (*forward secrecy*) : nouvelle keypair de groupe à `keyEpoch+1`, re-*wrap* pour les membres restants. Les **nouveaux** documents utilisent la nouvelle clé ; les anciens restent lisibles par les membres légitimes. *(Re-chiffrement rétroactif optionnel si le départ est « sensible ».)*

**Cache & flush en fin de session**
- La **clé privée utilisateur** ne vit qu'en **mémoire volatile** du process, indexée par session, avec **TTL court** + purge **au logout** et à l'expiration.
- ⚠️ **Ne JAMAIS** mettre la privée ni le clair dans **Redis** ou tout store partagé : cela réintroduit exactement l'exposition au repos qu'on combat. Redis ne contient que des **identifiants de session opaques**.
- Le serveur Next étant *stateless* entre requêtes, « fin de session » = expiration TTL + hook de logout qui zéro-ise l'entrée mémoire.

---

## 9. Le cas pgvector / embeddings (arbitrage critique)

**Tension fondamentale :** la recherche vectorielle pgvector exige des embeddings **en clair** (on calcule des distances). Or **les embeddings sont inversibles** : on peut reconstruire une approximation du texte source à partir des vecteurs (*embedding inversion*). Chiffrer `document_chunks.embedding` **casse le RAG** ; le laisser en clair **affaiblit** la promesse.

Trois options, à trancher **avant** l'implémentation car elle structure tout :

| Option | RAG serveur | Confidentialité au repos | Verdict |
|---|---|---|---|
| **A.** Embeddings en clair, on chiffre le reste (docs, texte, messages) | ✅ Intact | 🟠 Les vecteurs fuient (inversion partielle) | **Recommandé en Phase 1-2** — pragmatique, gros gain immédiat |
| **B.** Embeddings chiffrés + recherche déléguée à un index **local chiffré en mémoire** par session | 🟠 Dégradé / par-session | ✅ Forte | Phase 3+, pour cabinets exigeants |
| **C.** Embeddings souverains **locaux** (`LOUIS_EMBEDDING_BASE_URL`) + chiffrement de tout le reste | ✅ Intact | ✅ Le clair ne sort jamais du périmètre | **Cible idéale** quand l'inférence locale est en place |

**Décision : commencer en A**, viser **C** à mesure que l'inférence locale (déjà câblée via `LOUIS_EMBEDDING_BASE_URL`) se généralise. Documenter explicitement le résidu de l'option A auprès des cabinets.

---

## 10. Modèles de déploiement

- **(a) Chiffrement au repos — défaut, réaliste maintenant.** Le serveur déchiffre **en mémoire à la demande** pour nourrir le LLM, puis flush. Protège stockage, sauvegardes, voisins, DBA-sans-clés. C'est le bon rapport sécurité/complexité pour la majorité des cabinets.
- **(b) E2E zero-knowledge — option « souveraineté maximale ».** Déchiffrement **côté navigateur** ; la clé privée ne touche **jamais** le serveur. Impose l'**inférence locale** (sinon le clair repart vers un provider). Plus fort, bien plus complexe, ampute certaines features serveur (analyses tabulaires async, RAG serveur). Réservé aux cabinets qui l'exigent et acceptent le compromis.

---

## 11. Plan de mise en œuvre (phasé)

1. **Phase 1 — Chiffrement au repos, master key.** Documents + texte extrait chiffrés (XChaCha20), DEK *wrappée par la master key symétrique* existante. Aucune keypair encore. **Gain immédiat** contre vol de stockage, complexité faible. *(Équivaut à du SSE, mais sous contrôle de l'app et indépendant de l'hébergeur.)*
2. **Phase 2 — Keypairs utilisateurs.** `user_keys`, privée dérivée du mot de passe (Argon2id). DEK *wrappée par-utilisateur* → vrais documents **privés** + partage **entre utilisateurs**.
3. **Phase 3 — Groupes / équipes.** `groups`, `group_keys`, partage au groupe, **rotation à la révocation**.
4. **Phase 4 — Durcissements.** Embeddings souverains locaux (option C §9), option E2E (modèle b), re-chiffrement rétroactif sur départ sensible, intégration KMS (Vault / Scaleway KMS) pour la master key.

Chaque phase est livrable et testable indépendamment (migration Drizzle + back-fill chiffrant les données existantes).

---

## 12. Conséquences

**Positives**
- Un dump Postgres ou un bucket volé ne livre que du **chiffré**.
- Le partage privé/partagé est **cryptographiquement** fondé, pas seulement applicatif.
- Argument commercial décisif face au contexte 2025-2026 : **« vos pièces restent illisibles, même en cas de fuite de l'infrastructure »**.
- Aligné avec le secret professionnel, le RGPD (art. 32 — chiffrement) et le positionnement souverain de DataRing.

**Négatives / coûts**
- Complexité crypto (gestion des clés, rotation, récupération de compte) — **un mot de passe perdu = données perdues** sans mécanisme de recouvrement (clé de recouvrement cabinet à prévoir, elle-même *wrappée* pour un admin de cabinet → trade-off à documenter).
- **Perte de fonctionnalités au repos** : recherche full-text SQL sur le texte extrait impossible (il est chiffré) ; arbitrage pgvector (§9).
- Coût CPU (KDF Argon2id au login, chiffrement à l'upload) — négligeable à l'échelle d'un cabinet.
- Migration des données existantes (back-fill).

**Risque résiduel assumé** : le clair transite en mémoire serveur pendant le traitement IA (modèle a) et part au provider si l'IA n'est pas locale. **À écrire noir sur blanc dans la doc cabinet** — la sécurité honnête vaut mieux que la sécurité marketing.

---

## 13. Questions ouvertes
- **Recouvrement de compte** : clé de recouvrement détenue par un admin de cabinet (*wrappée* pour sa pubkey) vs Shamir Secret Sharing entre associés ? À trancher.
- **Rotation de `ENCRYPTION_KEY`** (déjà invalidante pour les clés provider) — interaction avec la couche Phase 1.
- Granularité du partage : au **document**, au **dossier/projet**, ou aux deux ?
- Stockage des privées de groupe lors de l'ajout d'un membre **hors-ligne** (qui détient le clair pour faire le *wrap* ?).

---

## Sources (contexte menace)
- CNIL — *France Travail : la CNIL enquête sur la fuite de données* — https://www.cnil.fr/fr/france-travail-la-cnil-enquete-sur-la-fuite-de-donnees-et-donne-des-conseils-pour-se-proteger
- Cybermalveillance.gouv.fr — *Rapport d'activité et état de la menace 2025* — https://www.cybermalveillance.gouv.fr/tous-nos-contenus/actualites/rapport-activite-2025
- Banque des Territoires — *Fuite de données personnelles : la série noire continue pour l'État* — https://www.banquedesterritoires.fr/fuite-de-donnees-personnelles-la-serie-noire-continue-pour-letat
- Cybernews — *45 M de données françaises exposées* — https://cybernews.com/fr/actualites/45m-de-donnees-francaises-exposees-par-des-cybercriminels-presumes/
- Ministère de l'Éducation nationale — *Incident de sécurité affectant les données de certains élèves* — https://www.education.gouv.fr/incident-de-securite-affectant-les-donnees-de-certains-eleves-de-l-education-nationale-504443

> ⚠️ Les chiffres et incidents ci-dessus proviennent de la presse et des communications publiques (CNIL, cybermalveillance.gouv.fr) ; à recouper avant toute citation dans un document officiel ou commercial.
