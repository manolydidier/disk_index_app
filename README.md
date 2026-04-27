# Disk Indexer

Application web professionnelle en **Next.js** pour gérer, indexer et rechercher le contenu de plusieurs disques durs.

## Points clés

- **Gestion des disques** : ajout, mise à jour, activation, désactivation, suppression conditionnelle.
- **Indexation complète** : scan récursif de l'arborescence et transformation en structure JSON.
- **Stockage PostgreSQL / Prisma** : persistance des disques, entrées indexées, jobs de scan et activités détectées.
- **Recherche rapide** : recherche par nom, extension ou chemin exact sur l'ensemble des disques.
- **Détection de changements** : ajout, suppression, modification et renommage probable.
- **Alerting UI** : popups côté interface lorsqu'une nouvelle activité est détectée.
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
- Route Handlers

`NextAuth` n'est pas inclus dans cette version, mais l'architecture permet son ajout facilement si vous souhaitez restreindre l'accès à l'application.

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

### Disques
- `GET /api/disks`
- `POST /api/disks`
- `GET /api/disks/[diskId]`
- `PATCH /api/disks/[diskId]`
- `DELETE /api/disks/[diskId]`

### Scans
- `POST /api/disks/[diskId]/scan`
  - body : `{ "scanType": "FULL" }` ou `{ "scanType": "DIFFERENTIAL" }`

### Arborescence
- `GET /api/disks/[diskId]/tree`

### Recherche
- `GET /api/search?q=rapport`
- `GET /api/search?q=rapport&diskId=...`

### Activités
- `GET /api/activities?unacknowledged=true`
- `POST /api/activities/acknowledge`

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

### 1. Queue de background jobs
Pour les gros volumes, remplacez le scan synchrone par :
- BullMQ
- pg-boss
- Trigger.dev

### 2. Recherche full-text
Ajoutez :
- index trigram PostgreSQL
- recherche plein texte sur `name`, `fullPath`, `extension`

### 3. Watchers temps réel
Pour certains environnements :
- `chokidar`
- watchers OS natifs

### 4. Authentification / rôles
Ajouter :
- NextAuth/Auth.js
- RBAC admin / lecture seule

### 5. Dashboard avancé
- volumétrie par disque
- heatmap d'activité
- état de santé du disque
- planification automatique des rescans

---

## Arborescence du projet

```bash
app/
  api/
  disks/[id]/
  search/
components/
  disks/
  layout/
  providers/
  ui/
lib/
prisma/
types/
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
