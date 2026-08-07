# Disk Indexer

Application web professionnelle en **Next.js** pour gérer, indexer et rechercher le contenu de plusieurs disques durs.

## Points clés

- **Gestion des disques** : ajout, mise à jour, activation, désactivation, suppression conditionnelle. Support des disques scannés directement par le serveur (`SERVER`) et des disques distants remontés par un agent installé sur une autre machine (`AGENT`).
- **Indexation complète** : scan récursif de l'arborescence et transformation en structure JSON, en local ou via l'agent.
- **Stockage PostgreSQL / Prisma** : persistance des disques, entrées indexées, jobs de scan et activités détectées.
- **Recherche avancée** : recherche par nom, extension, chemin exact ou **contenu** (fichiers texte/code, voir plus bas), avec filtres par type, taille et date de modification.
- **Analyse d'espace disque** (`/storage`) : répartition du stockage par type de fichier, fichiers les plus volumineux, export CSV.
- **Détection de doublons** (`/duplicates`) : fichiers en double par nom + taille, avec estimation de l'espace récupérable et **suppression directe** (immédiate sur les disques serveur, via commande à l'agent sur les disques distants).
- **Rapport de changements** : sur chaque fiche disque, compare l'activité (ajouts/modifications/suppressions/renommages) sur une période choisie, avec export CSV.
- **Palette de commande** (Ctrl/Cmd+K) : accès rapide à toutes les pages et à tous les disques indexés.
- **Détection de changements** : ajout, suppression, modification et renommage probable.
- **Automatisation** : détection de nouveaux disques, surveillance en direct (watchers), scans planifiés en filet de sécurité, alertes de capacité disque faible.
- **Notifications** : in-app, et email (SMTP configurable depuis l'interface, voir plus bas).
- **Authentification et rôles** : NextAuth (Credentials), rôles `ADMIN`/`USER`, rate limiting sur le login, contrôle d'accès par disque (un admin choisit quels utilisateurs voient quels disques).
- **Mode sombre**, écrans de chargement et pages d'erreur dédiées.
- **Tests automatisés** (Vitest) sur la logique critique (validation, rate limiting, CSV, libellés disque).
- **App Router + Route Handlers** : architecture moderne Next.js.
- **Tailwind CSS + shadcn/ui** : interface admin propre et extensible.

---

## Important : contrainte de déploiement

Cette application **doit être auto-hébergée sur une machine qui a accès au système de fichiers** à scanner.

Elle n'est **pas adaptée à un déploiement serverless pur** car le moteur d'indexation lit directement les points de montage (`/mnt/DB0001`, `/media/archive`, etc.).

Déploiement recommandé :

- serveur Linux / Windows avec Node.js
- PostgreSQL local ou réseau
- service `systemd`, Docker Compose ou PM2

---

## Stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui
- Prisma
- PostgreSQL
- NextAuth (Credentials provider, sessions JWT)
- Vitest (tests unitaires)
- Route Handlers

L'authentification est incluse et active par défaut : un middleware protège toutes les pages (hors `/login` et les routes API, qui vérifient elles-mêmes la session). Le premier compte créé via `/login` devient automatiquement administrateur ; les comptes suivants doivent être créés par un admin.

---

## Modèle de données

### `Disk`
Représente un disque géré par l'application.

Champs principaux :
- `code` : `DB0001`, `DB0002`, ...
- `name`
- `rootPath`
- `description`
- `status` : `ACTIVE`, `INACTIVE`, `DISCONNECTED`
- `lastScanAt`, `lastFullScanAt`, `lastDiffScanAt`
- `lastTreeSnapshot`

### `FileEntry`
Représente un fichier ou dossier indexé.

Champs principaux :
- `entryType` : `FILE` / `FOLDER`
- `name`
- `relativePath`
- `fullPath`
- `extension`
- `size`
- `modifiedAt`
- `inode`
- `fingerprint`
- `parentId`
- `deletedAt`

### `ScanJob`
Historise les scans complets et différentiels.

### `DiskActivity`
Historise les changements détectés :
- `ADDED`
- `MODIFIED`
- `DELETED`
- `RENAMED`
- `DISK_STATUS`

---

## Détection des changements

Le moteur de scan fonctionne comme suit :

1. lecture récursive du système de fichiers
2. constitution d'une liste plate indexable
3. comparaison avec les entrées existantes en base
4. détection des cas suivants :
   - **ajout** : chemin inconnu en base
   - **modification** : même chemin, métadonnées différentes
   - **suppression** : présent en base mais absent du scan courant
   - **renommage probable** : chemin différent mais inode identique ou fingerprint unique identique

### Note sur les renommages

La détection de renommage est **best effort** :
- fiable si l'inode reste stable
- approximative via fingerprint si l'inode n'est pas exploitable

### Note sur les symlinks

Les liens symboliques sont **ignorés volontairement** pour éviter les cycles de parcours et les doublons.

---

## Structure JSON générée

L'API `/api/disks/:id/tree` retourne une structure de ce type :

```json
{
  "disk_id": "DB0001",
  "disk_name": "Disque Archive 1",
  "root_path": "/mnt/DB0001",
  "last_scan": "2026-04-23T10:00:00Z",
  "status": "ACTIVE",
  "tree": [
    {
      "type": "folder",
      "name": "nouveaudossier",
      "path": "DB0001/nouveaudossier",
      "children": [
        {
          "type": "file",
          "name": "fichier1.pdf",
          "path": "DB0001/nouveaudossier/fichier1.pdf",
          "extension": "pdf",
          "size": 120394,
          "modified_at": "2026-04-20T08:10:00Z"
        }
      ]
    }
  ]
}
```

---

## Routes API

Toutes les routes ci-dessous (sauf `/api/health` et `/api/auth/*`) exigent une session NextAuth valide ; certaines sont réservées aux administrateurs ou filtrées par accès disque (voir [Contrôle d'accès par disque](#contrôle-daccès-par-disque)).

### Disques
- `GET /api/disks`
- `POST /api/disks`
- `GET /api/disks/[diskId]`
- `PATCH /api/disks/[diskId]`
- `DELETE /api/disks/[diskId]`
- `GET /api/disks/[diskId]/export?type=entries|scans|activities` — export CSV
- `GET /api/disks/[diskId]/access` / `POST /api/disks/[diskId]/access` — gestion des accès (admin)

### Scans
- `POST /api/disks/[diskId]/scan` — scan asynchrone (disques `SERVER`)
  - body : `{ "scanType": "FULL" }` ou `{ "scanType": "DIFFERENTIAL" }`
- `POST /api/disks/[diskId]/scan-sync` — scan synchrone
- `POST /api/agent/commands/request-scan` — demande de scan pour un disque `AGENT`

### Arborescence
- `GET /api/disks/[diskId]/tree`

### Recherche
- `GET /api/search?q=rapport`
- `GET /api/search?q=rapport&diskId=...&extension=...&sizeMin=...&modifiedAfter=...`

### Analyse d'espace et doublons
- `GET /api/disks/[diskId]/storage` / `GET /api/disks/[diskId]/storage/export`
- `GET /api/duplicates?diskId=...` / `GET /api/duplicates/export`
- `POST /api/file-entries/[entryId]/delete` — supprime un fichier (immédiat sur disque `SERVER`, via commande agent sur disque `AGENT`)

### Rapport de changements
- `GET /api/disks/[diskId]/changes?from=...&to=...` / `GET /api/disks/[diskId]/changes/export`

### Activités
- `GET /api/activities?unacknowledged=true`
- `POST /api/activities/acknowledge`

### Automatisation
- `GET /api/automation/settings` / `PUT /api/automation/settings`
- `POST /api/automation/settings/test-email`
- `GET /api/automation/events` / `POST /api/automation/events/[eventId]/action`

### Agents et utilisateurs (admin)
- `GET /api/agent-devices`, `PATCH|DELETE /api/agent-devices/[deviceId]`, `POST .../revoke`, `POST .../reactivate`
- `GET /api/users`, `PATCH /api/users/[userId]/role`

### Divers
- `GET /api/health` — vérification de santé (DB), sans authentification

---

## Démarrage

### 1. Installer les dépendances

```bash
npm install
```

### 2. Configurer les variables d'environnement

Copier `.env.example` vers `.env` puis adapter :

```bash
cp .env.example .env
```

### 3. Initialiser Prisma

```bash
npx prisma generate
npx prisma db push
```

### 4. Seed optionnel

```bash
npm run db:seed
```

### 5. Lancer l'application

```bash
npm run dev
```

---

## Notifications email (SMTP)

L'application peut envoyer par email les mêmes alertes que les notifications in-app (nouveau disque détecté, changements, espace disque faible).

### Configuration recommandée : via l'interface

Va dans **`/settings/automation`** → section **"Notifications email"**. Un administrateur peut y renseigner le serveur SMTP, l'utilisateur, le mot de passe, l'adresse d'expédition et la liste des destinataires, puis cliquer sur **"Enregistrer"**.

Cette configuration est stockée dans la base de données (table `AutomationSettings`), pas dans un fichier — elle est donc modifiable à chaud, sans redémarrer le serveur ni éditer `.env`. Le mot de passe n'est jamais renvoyé au navigateur après l'enregistrement (l'API ne renvoie qu'un booléen indiquant qu'il est configuré) ; le champ reste vide tant que tu ne le changes pas explicitement.

Un bouton **"Tester l'envoi"** permet de vérifier immédiatement que les identifiants fonctionnent, avant même d'avoir cliqué sur "Enregistrer".

### Configurer un compte Gmail

Gmail refuse les connexions SMTP avec ton mot de passe habituel — il faut un **mot de passe d'application** :

1. Active la validation en deux étapes sur le compte Google : https://myaccount.google.com/security
2. Va sur https://myaccount.google.com/apppasswords, choisis un nom (ex. « Disk Indexer ») et génère le mot de passe (16 caractères, sans espaces).
3. Dans `/settings/automation`, renseigne :
   - **Serveur SMTP** : `smtp.gmail.com`
   - **Port** : `587`
   - **Utilisateur SMTP** : ton adresse Gmail complète (`toncompte@gmail.com`)
   - **Mot de passe SMTP** : le mot de passe d'application généré à l'étape 2 (pas ton mot de passe Google)
   - **Adresse d'expédition** : laisse vide pour utiliser l'utilisateur SMTP, ou renseigne une autre adresse si tu utilises un alias
4. Ajoute au moins un destinataire, active le toggle, teste l'envoi, puis enregistre.

Gmail limite le volume d'envoi via SMTP (environ 500 emails/jour pour un compte standard) — largement suffisant pour des alertes ponctuelles, mais à garder en tête si tu génères beaucoup de disques/changements.

### Configuration alternative : via `.env`

Si tu préfères une configuration au niveau serveur (ou comme valeur par défaut avant qu'un admin ne passe par l'interface), les mêmes réglages peuvent être définis dans `.env` :

```bash
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="toncompte@gmail.com"
SMTP_PASS="le-mot-de-passe-d-application-16-caracteres"
SMTP_FROM="toncompte@gmail.com"
```

**La configuration enregistrée via l'interface (base de données) est toujours prioritaire** sur ces variables d'environnement — `.env` ne sert que de valeur de repli si rien n'a encore été configuré via `/settings/automation`.

---

## Architecture logicielle

### Couche UI
- `app/` : pages App Router
- `components/` : composants métier + composants UI de style shadcn

### Couche domaine / application
- `lib/scanner.ts` : logique de scan et de détection de diff
- `lib/tree.ts` : reconstruction de l'arborescence JSON
- `lib/validators.ts` : validation Zod
- `lib/disk-code.ts` : génération du code disque suivant

### Couche persistence
- `prisma/schema.prisma`
- `lib/prisma.ts`

---

## Choix d'architecture

### Pourquoi stocker une vue plate + une vue arbre ?

- **Vue plate** (`FileEntry`) : idéale pour la recherche et les comparaisons diff.
- **Vue arbre JSON** : idéale pour l'affichage et l'export.

### Pourquoi App Router + Route Handlers ?

- séparation claire UI/API
- simplicité de maintenance
- extensible vers files queues, cron jobs, auth, RBAC

### Pourquoi Prisma/PostgreSQL ?

- très bon compromis entre robustesse, lisibilité et évolutivité
- index SQL simples à optimiser
- migrations fiables

---

## Améliorations recommandées pour la production

### Déjà en place
- **Authentification / rôles** : NextAuth, `ADMIN`/`USER`, rate limiting sur le login, contrôle d'accès par disque.
- **Watchers temps réel** : `chokidar` côté serveur, plus la planification de scans complets en filet de sécurité.
- **Dashboard avancé** : volumétrie par disque (`/storage`), état de santé (capacité disque, alertes), planification automatique des rescans.

### Encore à faire pour un très gros volume

#### 1. Queue de background jobs
Pour les très gros volumes, remplacez le scan synchrone par :
- BullMQ
- pg-boss
- Trigger.dev

#### 2. Recherche full-text — étendre au-delà des fichiers texte
La recherche sur le contenu couvre aujourd'hui uniquement les fichiers texte/code (`.txt`, `.md`, `.json`, `.js`, `.py`, etc.), sous 512 Ko, via une simple recherche `ILIKE` (voir `lib/scanner.ts` / `agent/index.ts` pour la liste d'extensions et le plafond). Pour aller plus loin :
- extraction de texte pour PDF et documents Office (ex. `pdf-parse`, `mammoth`)
- remplacer `ILIKE` par un vrai index plein texte PostgreSQL (`tsvector` + `pg_trgm`) une fois le volume de contenu indexé significatif

#### 3. Vulnérabilités de dépendances à surveiller
`npm audit` peut signaler des CVE sur `next-auth` ou `next` nécessitant une montée de version majeure (Auth.js v5 / Next.js 16). Ce sont des migrations à part entière (API différente, middleware à réécrire) — à traiter en dehors d'un cycle de correctifs mineurs, avec des tests de non-régression complets sur l'authentification.

#### 4. Packaging pour installation simplifiée
- `Dockerfile` + `docker-compose.yml` (app + PostgreSQL)
- script de sauvegarde/restauration (`pg_dump`)

---

## Arborescence du projet

```bash
agent/            # process autonome installé sur une machine distante (disques AGENT)
app/
  api/
  disks/[id]/
  duplicates/
  login/
  search/
  settings/automation/
  storage/
components/
  auth/
  dashboard/
  disks/
  layout/
  providers/
  settings/
  ui/
lib/
  agent/          # auth agent, requêtes de scan
  automation/      # daemon (watchers, capacité, scans planifiés, alertes)
  server/
prisma/
scripts/          # scripts de démarrage (tâche planifiée Windows)
```

---

## Résumé

Ce projet fournit une base solide, maintenable et directement industrialisable pour :
- gérer plusieurs disques
- indexer leur contenu
- détecter les changements
- rechercher rapidement n'importe quel fichier ou dossier
- afficher des alertes lorsqu'une activité est détectée

Pour une version entreprise très volumique, l'étape suivante naturelle est de déplacer le scan vers une vraie queue asynchrone et d'ajouter des index PostgreSQL avancés pour la recherche.
