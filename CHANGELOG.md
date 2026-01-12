# Changelog

Tous les changements notables de ce projet seront documentés dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

---

## [1.0.0] - 2026-01-12

### 🎉 Première release officielle

Application Electron complète pour la gestion et publication de traductions Discord.

### ✨ Fonctionnalités principales

#### 🖥️ Application Electron
- **Application desktop native** avec Electron 25
- **Interface React 18 + TypeScript** avec Vite pour le build
- **IPC sécurisé** via preload.js avec contextIsolation
- **Hot-reload en développement** avec concurrently et wait-on
- **Build automatisé Windows** (.exe) avec electron-builder
- **Script de build** PowerShell avec nettoyage des caches

#### 📋 Gestion d'historique
- **Historique complet** de toutes les publications avec localStorage
- **Modification de posts Discord existants** via PATCH API
- **Mode édition** avec badge visuel et bouton "Mettre à jour"
- **Actions sur les posts** :
  - 🔗 Ouvrir sur Discord (lien direct)
  - ✏️ Modifier le post existant (titre, contenu, tags, image)
  - 📋 Dupliquer pour créer un nouveau post similaire
  - 🗑️ Supprimer de l'historique local
- **Affichage enrichi** : date, template, tags, aperçu du contenu

#### 🎨 Interface utilisateur
- **Design moderne** avec palette de couleurs sombre professionnelle
- **Templates personnalisables** avec types : Mes traductions, Partenaires, Autre
- **Variables dynamiques** avec support text et textarea
- **Preview en temps réel** avec rendu Markdown, BBCode et émojis Discord
- **Gestion d'images** améliorée :
  - Drag & drop sur toute la zone
  - Miniatures avec badge "⭐ Principale"
  - Définition de l'image principale par clic
- **Tags Discord** avec autocomplete
- **Boutons stylisés** pour sélection de template (remplacement des radio buttons)
- **Toasts notifications** pour feedback utilisateur
- **Modales de configuration** :
  - ⚙️ Configuration API
  - ✏️ Gestion des templates
  - 🏷️ Gestion des tags
  - 📝 Instructions de templates
  - 👥 Traducteurs (autocomplete)

#### 🔧 Backend et API
- **API Publisher** (`python/publisher_api.py`) :
  - `POST /api/forum-post` : Créer un nouveau post
  - `PATCH /api/forum-post/{thread_id}/{message_id}` : Modifier un post existant
  - Support multipart/form-data avec images
  - CORS configurables
  - Authentification par clé API (X-API-KEY)
- **Modification Discord** :
  - Mise à jour du titre du thread
  - Mise à jour des tags
  - Mise à jour du contenu du message
  - Ajout d'images (limitation Discord : empilement)

#### 📁 Structure et organisation
- **Dossier `python/`** : Scripts Python (bots + API) séparés
- **Dossier `frontend/`** : Application React TypeScript
- **Dossier `assets/`** : Ressources (icône .ico)
- **Composants React** modulaires :
  - `ContentEditor` : Éditeur principal avec mode édition
  - `HistoryModal` : Interface CRUD de l'historique
  - `ConfigModal`, `TemplatesModal`, `TagsModal`, etc.
  - `ToastProvider` : Système de notifications
  - `ConfirmModal` : Dialogues de confirmation
- **State management** avec React Context API (`appContext.tsx`)
- **Custom hooks** : `useConfirm`, `useImageLoader`, `useToast`

#### 🛠️ Outils de développement
- **Scripts npm** :
  - `npm run dev` : Développement avec hot-reload
  - `npm run build:frontend` : Build React seul
  - `npm run build:win` : Build exécutable Windows complet
  - `npm run test` : Vérification TypeScript
- **Script PowerShell** `build-windows.ps1` :
  - Nettoyage automatique des caches Electron
  - Build frontend + packaging
  - Affichage de progression avec emojis
- **Configuration TypeScript** stricte avec Vite

#### 📖 Documentation
- **README.md** complet et à jour :
  - Architecture détaillée
  - Guide d'installation
  - Guide d'utilisation
  - Structure des données
  - Scripts de développement
  - Déploiement
- **CHANGELOG.md** (ce fichier)

### 🔄 Modifié

#### Interface
- **Templates** : Remplacement des radio buttons par des boutons stylisés
- **Badge image principale** : "⭐ MAIN" → "⭐ Principale" (français)
- **Preview buttons** : Hauteur et style cohérents (32px)
- **Émojis Discord** : Dictionnaire étendu avec 200+ émojis
- **Conversion BBCode/Markdown** : Support amélioré pour Discord

#### Architecture
- **Configuration API** : Stockage sécurisé côté main process (`publisher_config.json`)
- **Historique** : localStorage côté renderer avec synchronisation
- **IPC handlers** : Support POST et PATCH dynamique
- **Format des posts** : Ajout de `threadId`, `messageId`, `discordUrl` pour édition

#### Scripts Python
- **Déplacement** : `bot_discord_server*.py` et `publisher_api.py` → `python/`
- **API Publisher** : Ajout endpoints PATCH pour modification
- **CORS** : Méthode PATCH ajoutée aux headers

### 🗑️ Supprimé

#### Fichiers obsolètes
- `Publication_template_discord.html` (interface HTML legacy)
- `styles.css` (styles de l'ancien HTML)
- `TEST_IMAGES_FS.md` et `TEST_VALIDATION.md` (docs de test)
- `IMPLEMENTATION_STATUS.md` (suivi de développement terminé)
- `GUIDE_HISTORIQUE.md` (intégré dans README)
- `README_ELECTRON.md` (fusionné dans README principal)
- `frontend/README.md` (redondant)
- `frontend/src/App.css` (intégré dans index.css)

#### Code
- **Fallback HTML** dans main.js (plus nécessaire)
- **Doublons d'émojis** dans ContentEditor (star, fire, joystick, battery)

### 🐛 Corrigé

- **TypeScript** : Toutes les erreurs de compilation résolues
- **ToastProvider** : Utilisation correcte de `showToast` au lieu de `addToast`
- **Fonctions historique** : Déclaration avant utilisation dans `appContext.tsx`
- **Propriétés dupliquées** : Nettoyage de l'objet `discordEmojis`

### 🔒 Sécurité

- **IPC contextIsolation** : Bridge sécurisé entre renderer et main process
- **Configuration API** : Clé stockée côté main, jamais exposée au renderer
- **CORS** : Configuration des origines autorisées dans l'API Python
- **Validation** : Vérification des champs obligatoires avant publication

### 📦 Dépendances

#### JavaScript/TypeScript
- `electron` ^25.0.0
- `react` ^18.2.0
- `typescript` ^5.x
- `vite` ^5.4.21
- `electron-builder` ^24.6.0
- `concurrently` ^8.2.2
- `wait-on` ^7.2.0
- `cross-env` ^7.0.3

#### Python
- `discord.py` >=2.3.0
- `aiohttp` >=3.8
- `python-dotenv` >=1.0.0

---

**Première version stable - Prête pour la production ! 🚀**

## Légende

- ✨ **Ajouté** : Nouvelles fonctionnalités
- 🔄 **Modifié** : Changements dans les fonctionnalités existantes
- 🗑️ **Supprimé** : Fonctionnalités retirées
- 🐛 **Corrigé** : Corrections de bugs
- 🔒 **Sécurité** : Correctifs de sécurité
- 📦 **Dépendances** : Mises à jour de dépendances
