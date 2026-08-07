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
