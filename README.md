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

## Déploiement Docker (guide complet pour débutants)

Ce guide explique **absolument tout**, en supposant que tu n'as jamais utilisé Docker, jamais utilisé un terminal, et que tu ne sais pas ce qu'est une « variable d'environnement ». Si un mot n'est pas clair, il est expliqué la première fois qu'il apparaît.

### Le principe, en une image

Il y a **deux types de machines** dans cette installation :

1. **Une seule « machine serveur »** : c'est elle qui fait tourner l'application et la base de données, en permanence, via Docker. C'est celle que tu configures dans cette section.
2. **Une machine « agent » par disque à surveiller** (ton PC actuel en fait partie) : chacune fait tourner un petit programme (l'agent) qui regarde ses propres disques et envoie les infos à la machine serveur. C'est expliqué dans la section suivante, [Installer l'agent sur chaque machine à scanner](#installer-lagent-sur-chaque-machine-à-scanner).

Les machines agents n'ont **pas besoin de Docker** — seulement la machine serveur.

### C'est quoi un terminal, et comment l'ouvrir ?

Un « terminal » (ou « invite de commandes ») est une fenêtre où on tape du texte au lieu de cliquer sur des boutons. Toutes les commandes de ce guide s'y tapent, une à la fois, suivies de la touche Entrée.

**Sur Windows**, le terminal à utiliser s'appelle **PowerShell** :
1. Clique sur le bouton Démarrer (ou appuie sur la touche Windows du clavier).
2. Tape `PowerShell`.
3. Clique sur « Windows PowerShell » dans les résultats.

Une fenêtre bleue ou noire s'ouvre avec du texte et un curseur clignotant : c'est ton terminal. Tout ce qui suit se fait dedans.

**Astuce pour éviter de taper les chemins de dossiers à la main** : dans l'Explorateur de fichiers Windows, ouvre le dossier voulu, puis fais **Maj + clic droit** dans un espace vide du dossier → « Ouvrir la fenêtre PowerShell ici » (ou « Ouvrir dans le terminal » selon la version de Windows). Ça ouvre directement un terminal déjà positionné dans le bon dossier.

---

### Étape 1 — Installer Docker sur la machine serveur

Docker est le programme qui va faire tourner l'application dans des « conteneurs » — des sortes de boîtes fermées, toutes prêtes, qui contiennent déjà tout ce qu'il faut (pas besoin d'installer Node.js, PostgreSQL, etc. séparément sur cette machine : Docker s'occupe de tout).

Sur la machine qui va héberger l'application :

- **Si c'est un Windows ou un Mac** : va sur https://www.docker.com/products/docker-desktop/, clique sur le bouton de téléchargement, puis installe le fichier téléchargé normalement (suivant, suivant, terminer — comme n'importe quel logiciel). Une fois installé, **lance Docker Desktop** (cherche-le dans le menu Démarrer comme n'importe quelle application) et attends qu'il affiche « Docker Desktop is running » ou une icône verte. Il faut le laisser ouvert/actif en permanence pour que l'application fonctionne.
- **Si c'est un Linux** (Ubuntu, Debian...) : suis les instructions officielles sur https://docs.docker.com/engine/install/ pour ta distribution précise.

**Vérifier que l'installation a marché** : ouvre un terminal (voir ci-dessus) et tape ces deux lignes, une par une, en appuyant sur Entrée après chacune :

```bash
docker --version
docker compose version
```

Après chaque commande, un numéro de version doit s'afficher (ex. `Docker version 27.x.x`). Si tu vois plutôt un message d'erreur du genre « commande introuvable », relance Docker Desktop et réessaie, ou redémarre la machine.

---

### Étape 2 — Récupérer les fichiers du projet sur cette machine

Il faut que le dossier complet du projet (celui que tu as actuellement, `disk-indexer-app`) se retrouve sur la machine serveur.

**La méthode la plus simple, sans rien installer de plus** : copie tout le dossier `disk-indexer-app` sur une clé USB (ou envoie-le par le réseau, ou par un service de partage de fichiers), puis colle-le sur la machine serveur, par exemple directement sur le Bureau ou dans `Documents`.

*(Si tu sais déjà utiliser `git`, tu peux aussi faire `git clone <URL de ce dépôt>` — mais ce n'est pas nécessaire, copier le dossier fonctionne tout aussi bien.)*

---

### Étape 3 — Ouvrir un terminal dans ce dossier

Sur la machine serveur, ouvre le dossier `disk-indexer-app` que tu viens de copier dans l'Explorateur de fichiers, puis **Maj + clic droit** dans un espace vide → « Ouvrir la fenêtre PowerShell ici » (voir l'astuce plus haut).

Pour vérifier que tu es au bon endroit, tape :

```powershell
dir
```

Tu dois voir une liste de fichiers et dossiers qui ressemble à celle du projet : `app`, `components`, `package.json`, `Dockerfile`, `docker-compose.yml`, etc. Si tu ne vois pas ça, tu n'es pas dans le bon dossier — retourne dans l'Explorateur de fichiers et recommence.

**Toutes les commandes des étapes suivantes se tapent dans ce même terminal, resté ouvert dans ce dossier.**

---

### Étape 4 — Créer le fichier de configuration

L'application a besoin de savoir certaines choses pour fonctionner : quel mot de passe utiliser pour la base de données, à quelle adresse elle sera joignable, etc. Toutes ces informations vont dans un fichier texte appelé `.env` (à la racine du dossier du projet). C'est ce qu'on appelle des « variables d'environnement » — rien de plus qu'une liste de réglages, un par ligne, sous la forme `NOM=valeur`.

Le projet fournit un modèle vide (sans les valeurs secrètes), `.env.docker.example`. Il faut en faire une copie appelée `.env` :

```powershell
Copy-Item .env.docker.example .env
```

Cette commande ne fait qu'un copier-coller de fichier, rien d'autre. Un nouveau fichier `.env` doit maintenant apparaître dans le dossier.

**Ouvre ce fichier `.env`** avec le Bloc-notes (clic droit dessus → « Ouvrir avec » → « Bloc-notes »), et remplis chaque ligne. Voici à quoi correspond chaque réglage :

| Variable | Que mettre |
|---|---|
| `POSTGRES_USER` | N'importe quel nom, ex. `disk_indexer` — c'est juste un identifiant interne, pas besoin de le retenir |
| `POSTGRES_PASSWORD` | Un mot de passe que **tu inventes toi-même** — c'est celui de la base de données interne, personne d'autre n'a besoin de le connaître ni de s'en souvenir |
| `POSTGRES_DB` | N'importe quel nom, ex. `disk_indexer` |
| `NEXTAUTH_SECRET` | Une clé secrète — l'étape 5 explique comment la générer |
| `NEXTAUTH_URL` | L'adresse à laquelle cette machine sera joignable sur le réseau, ex. `http://192.168.1.50:3000` — voir juste en dessous comment trouver cette adresse |
| `AGENT_REGISTRATION_SECRET` | Une deuxième clé secrète — voir étape 5. C'est le mot de passe que chaque machine agent devra donner pour avoir le droit de se connecter à ce serveur |
| `APP_NAME` | Tu peux laisser la valeur déjà écrite |
| `SMTP_*` (plusieurs lignes) | Laisse tout vide pour l'instant — l'envoi d'email pourra être configuré plus tard, directement dans l'application (section « Notifications email » plus bas dans ce document) |

**Comment trouver l'adresse IP de la machine serveur** (pour remplir `NEXTAUTH_URL`) : dans le terminal, tape :

```powershell
ipconfig
```

Cherche la ligne « Adresse IPv4 » (quelque chose comme `192.168.1.50`). C'est cette adresse qu'il faut utiliser, sous la forme `http://192.168.1.50:3000` (ne change pas le `:3000` à la fin).

N'oublie pas d'**enregistrer le fichier** (Ctrl+S) une fois toutes les lignes remplies.

---

### Étape 5 — Générer les deux clés secrètes

Une « clé secrète » ici, c'est juste un mot de passe très long et impossible à deviner, généré au hasard par l'ordinateur — tu n'as pas besoin de le retenir, juste de le copier-coller une fois dans le fichier `.env`.

Il en faut deux : une pour `NEXTAUTH_SECRET`, une pour `AGENT_REGISTRATION_SECRET`. Dans le terminal (toujours sur la machine serveur), tape ces trois lignes, une par une :

```powershell
$bytes = New-Object byte[] 32
(New-Object System.Security.Cryptography.RNGCryptoServiceProvider).GetBytes($bytes)
[Convert]::ToBase64String($bytes)
```

Après la dernière ligne, une chaîne de caractères s'affiche (par exemple `ZaNMEixp0g4rAJ6sL+2nmaxgD8D+BNUCww6y+dzgczs=`) — **sélectionne-la avec la souris, copie-la (Ctrl+C ou clic droit → Copier), puis colle-la** dans le fichier `.env` à côté de `NEXTAUTH_SECRET=`.

Refais exactement la même chose une deuxième fois (les trois mêmes lignes) pour obtenir une **deuxième** valeur, différente de la première, à coller cette fois à côté de `AGENT_REGISTRATION_SECRET=`.

Enregistre à nouveau le fichier `.env` (Ctrl+S) et ferme le Bloc-notes.

---

### Étape 6 — Construire et démarrer l'application

Retourne dans le terminal (celui resté ouvert dans le dossier du projet) et tape :

```powershell
docker compose up -d --build
```

Beaucoup de texte va défiler — c'est normal, Docker télécharge et prépare tout ce qu'il faut. **La première fois, ça peut prendre plusieurs minutes** (le temps que ça télécharge). Laisse-le travailler jusqu'à ce que le terminal te rende la main (le curseur clignote à nouveau, prêt pour une nouvelle commande).

Ce que fait cette commande, en résumé : elle prépare l'application (« build ») puis la démarre en arrière-plan (« up -d », le `-d` veut dire qu'elle continue de tourner même après avoir fermé le terminal). Au passage, elle crée aussi automatiquement la structure de la base de données — il n'y a rien de plus à faire manuellement pour ça.

---

### Étape 7 — Vérifier que tout fonctionne

Toujours dans le terminal :

```powershell
docker compose ps
```

Tu dois voir apparaître deux lignes, une nommée `db` et une nommée `app`, avec un statut du genre `Up` ou `running (healthy)`. Si tu vois ça, c'est gagné.

Si `app` n'a pas l'air prêt (ou redémarre en boucle), regarde ce qu'elle affiche :

```powershell
docker compose logs -f app
```

Ça va afficher en direct tout ce que l'application écrit. Cherche une ligne du genre « Database schema is up to date. Starting server... » — c'est le signal que tout va bien. Pour arrêter d'afficher les logs (sans arrêter l'application), appuie sur `Ctrl+C`.

---

### Étape 8 — Ouvrir l'application dans un navigateur et créer le premier compte

Depuis **n'importe quel ordinateur connecté au même réseau** (pas forcément la machine serveur elle-même), ouvre un navigateur (Chrome, Edge, Firefox...) et tape dans la barre d'adresse :

```
http://<adresse-de-la-machine-serveur>:3000
```

en remplaçant `<adresse-de-la-machine-serveur>` par l'adresse IP trouvée à l'étape 4 (ex. `http://192.168.1.50:3000`).

La page de connexion de l'application doit s'afficher. Clique sur « Inscription », remplis le formulaire (email + mot de passe) et valide : **ce tout premier compte créé devient automatiquement administrateur** — tu n'as rien de plus à faire pour ça, c'est automatique.

À partir de là, la machine serveur tourne toute seule en continu (elle redémarre même automatiquement si la machine redémarre). La suite consiste à installer l'agent sur les machines qui ont des disques à indexer, voir [la section suivante](#installer-lagent-sur-chaque-machine-à-scanner).

---

### Commandes utiles au quotidien

Ces commandes se tapent dans un terminal ouvert dans le dossier du projet, sur la machine serveur :

| Ce que tu veux faire | Commande à taper |
|---|---|
| Voir si l'application tourne toujours | `docker compose ps` |
| Voir ce qui se passe en direct | `docker compose logs -f app` |
| Mettre en pause l'application (sans rien supprimer) | `docker compose stop` |
| La redémarrer après une pause | `docker compose start` |
| Tout arrêter et nettoyer (les données restent quand même en sécurité) | `docker compose down` |
| Installer une nouvelle version du projet | remplace les fichiers du dossier par la nouvelle version, puis retape `docker compose up -d --build` |

---

### En cas de problème

- **`docker` n'est pas reconnu comme une commande** → Docker Desktop n'est pas démarré (ou pas installé). Relance Docker Desktop et attends l'icône verte, puis réessaie.
- **`docker compose ps` montre `app` qui redémarre sans arrêt** → regarde `docker compose logs app` : c'est presque toujours parce qu'une ligne du fichier `.env` est restée vide (un secret manquant, par exemple) — relis l'étape 4.
- **La page ne s'ouvre pas depuis un autre ordinateur** → vérifie que tu utilises bien l'adresse IP de la machine serveur (pas `localhost`) dans le navigateur, et que le pare-feu Windows de cette machine ne bloque pas le port 3000 (Panneau de configuration → Pare-feu Windows Defender → Autoriser une application).
- **Une machine agent n'arrive pas à se connecter** → vérifie que `AGENT_REGISTRATION_SECRET` est écrit **exactement pareil**, caractère pour caractère, dans le `.env` du serveur et dans la config de l'agent (voir section suivante).

### Une limite à connaître

Le bouton « Ouvrir » qui affiche un fichier/dossier dans l'explorateur Windows ne fonctionne pas pour les disques scannés directement par le serveur (type `SERVER`) une fois que le serveur tourne dans Docker — Docker n'a pas d'écran ni de bureau à afficher. Ça reste normal et volontaire : pour ce genre de disque, utilise plutôt un agent (section suivante), pour lequel ce bouton continue de fonctionner normalement.

---

## Installer l'agent sur chaque machine à scanner

L'agent est un petit programme qui tourne en arrière-plan sur une machine Windows, regarde les disques de **cette machine précise**, et envoie les informations à la machine serveur installée dans la section précédente. Il faut l'installer **sur chaque machine dont tu veux indexer les disques** — y compris, si besoin, sur ton PC actuel.

Contrairement au serveur, l'agent **n'a pas besoin de Docker**.

### Étape 1 — Installer Node.js

Node.js est le programme qui permet de faire tourner l'agent (un peu comme il faut Word installé pour ouvrir un fichier `.docx`).

1. Sur la machine à équiper, va sur https://nodejs.org/
2. Clique sur le gros bouton de téléchargement (la version recommandée/LTS).
3. Installe le fichier téléchargé normalement (suivant, suivant, terminer).
4. Ouvre un terminal (voir tout en haut de ce guide si besoin — touche Windows, taper « PowerShell ») et vérifie que ça a marché :
   ```powershell
   node --version
   ```
   Un numéro doit s'afficher, par exemple `v22.17.1`. Si tu vois une erreur, redémarre la machine (Node.js a besoin d'un redémarrage pour être reconnu partout) et réessaie.

### Étape 2 — Récupérer les fichiers du projet sur cette machine

Comme pour le serveur : copie le dossier complet `disk-indexer-app` sur cette machine (clé USB, partage réseau...). À la fin, ce dossier doit se trouver quelque part sur cette machine, par exemple sur le Bureau.

### Étape 3 — Ouvrir un terminal dans ce dossier

Ouvre le dossier `disk-indexer-app` dans l'Explorateur de fichiers, puis **Maj + clic droit** dans un espace vide → « Ouvrir la fenêtre PowerShell ici ». Vérifie que tu es au bon endroit avec `dir` (tu dois voir `package.json`, `agent`, etc.).

### Étape 4 — Installer les dépendances

Toujours dans ce terminal :

```powershell
npm install
```

Ça télécharge tout ce dont l'agent a besoin pour fonctionner (ça n'a rien à voir avec Docker, c'est une étape différente). Ça peut prendre plusieurs minutes selon la connexion internet — laisse-le travailler jusqu'à ce que le terminal redevienne libre. **Cette étape ne se fait qu'une seule fois.**

### Étape 5 — Configurer l'agent

Comme pour le serveur, l'agent a besoin d'un petit fichier de réglages. Le projet fournit un modèle dédié, `.env.agent.example`. Fais-en une copie nommée `.env.local` :

```powershell
Copy-Item .env.agent.example .env.local
```

Ouvre le fichier `.env.local` qui vient d'apparaître (clic droit → Ouvrir avec → Bloc-notes) et remplis :

- `AGENT_SERVER_URL` : l'adresse de la machine serveur configurée dans la section précédente, ex. `http://192.168.1.50:3000` (exactement la même valeur que `NEXTAUTH_URL` là-bas).
- `AGENT_REGISTRATION_SECRET` : **copie-colle exactement** la même valeur que celle mise dans le `.env` du serveur à l'étape 5 de la section précédente. Si ce n'est pas toi qui as installé le serveur, demande cette valeur à la personne qui l'a fait.
- `AGENT_SCAN_ROOTS` : laisse cette ligne telle quelle (vide) dans la grande majorité des cas — l'agent détecte alors automatiquement tous les disques de la machine tout seul.

Enregistre (Ctrl+S) et ferme le Bloc-notes.

### Étape 6 — Tester que ça marche

Dans le terminal :

```powershell
npm run agent:start
```

Le terminal doit afficher des lignes commençant par `[AGENT]`, sans message d'erreur rouge. Laisse tourner une dizaine de secondes, puis :

1. Ouvre l'application dans un navigateur (l'adresse du serveur, ex. `http://192.168.1.50:3000`).
2. Connecte-toi.
3. Va dans **Paramètres → Appareils agents**.
4. Cette machine doit apparaître dans la liste, avec son nom.

Si elle apparaît, l'agent fonctionne. Reviens dans le terminal et appuie sur `Ctrl+C` pour arrêter ce test (l'étape suivante le fera redémarrer automatiquement, en continu).

### Étape 7 — Faire démarrer l'agent tout seul à chaque allumage de la machine

Pour l'instant, l'agent ne tourne que tant que le terminal reste ouvert. Cette étape le fait démarrer automatiquement à chaque ouverture de session Windows, sans plus jamais avoir besoin d'ouvrir un terminal.

1. Ouvre à nouveau le menu Démarrer, tape `PowerShell`, mais cette fois **clique-droit** sur « Windows PowerShell » et choisis **« Exécuter en tant qu'administrateur »** (une fenêtre demande confirmation — accepte). C'est important : cette étape précise ne fonctionne qu'en mode administrateur.
2. Dans cette fenêtre, tape la commande suivante — **remplace `C:\chemin\vers\disk-indexer-app` par l'emplacement réel du dossier sur cette machine** (par exemple `C:\Users\NomDUtilisateur\Desktop\disk-indexer-app`) :
   ```powershell
   schtasks /create /tn "DiskIndexer-AutoStart" /sc onlogon /tr "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"C:\chemin\vers\disk-indexer-app\scripts\start-app.ps1\""
   ```
3. Un message confirme la création de la tâche. Pour vérifier :
   ```powershell
   schtasks /query /tn "DiskIndexer-AutoStart"
   ```

À partir de la prochaine ouverture de session sur cette machine, l'agent démarre tout seul, en arrière-plan, sans aucune fenêtre visible.

**Pour tester tout de suite sans redémarrer la machine** :
```powershell
schtasks /run /tn "DiskIndexer-AutoStart"
```
puis vérifie dans **Paramètres → Appareils agents** sur l'application, ou regarde le fichier `logs\agent.log` créé dans le dossier du projet sur cette machine (avec le Bloc-notes) s'il y a un souci.

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
- `Dockerfile` + `docker-compose.yml` (app + PostgreSQL) : en place, voir [Déploiement Docker (guide complet pour débutants)](#déploiement-docker-guide-complet-pour-débutants)
- reste à faire : script de sauvegarde/restauration (`pg_dump`)

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
