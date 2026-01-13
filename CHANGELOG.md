# Changelog

Tous les changements notables de ce projet seront documentés dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

---

## [1.0.11] - 2026-01-13

### ✨ Améliorations UX

#### Gestion des erreurs de brouillons
- **Toast d'erreur pour brouillons** :
  - Affichage d'un toast d'erreur si la restauration du brouillon échoue
  - Affichage d'un toast d'erreur si la sauvegarde automatique échoue
  - L'utilisateur est désormais alerté immédiatement en cas de problème (au lieu d'échouer silencieusement)

#### Indicateur de taille d'images
- **Affichage de la taille des fichiers** :
  - Affichage de la taille de chaque image sous la miniature
  - Formatage automatique (B, KB, MB, GB)
  - Avertissement visuel si l'image dépasse 8 MB (limite Discord)
  - Fond rouge + emoji ⚠️ pour les images >8MB
  - Fond vert pour les images conformes

#### Validation renforcée
- **Blocage publication sans titre** :
  - La validation existante empêche déjà la publication si le titre est vide
  - ErrorModal claire avec code d'erreur et suggestions
  - Pas de confirmation (blocage direct pour éviter erreurs)

#### Badge statut API
- **Correction du dropdown transparent** :
  - Fond opaque pour meilleure lisibilité
  - Fermeture automatique en cliquant en dehors
  - Effet de flou et ombre prononcée pour détacher visuellement

### 🐛 Corrections

#### Production - API Python
- **Fix: API ne démarre pas en production** :
  - Correction du chemin vers les scripts Python en production
  - Ajout de `extraResources` dans package.json pour inclure le dossier python/
  - Détection automatique dev vs production (`process.resourcesPath`)
  - Vérification de Python au démarrage avec message d'erreur clair
  - Ajout de INSTALLATION_PROD.md avec guide complet

### 🔧 Technique
- Ajout de la fonction IPC `getFileSize` dans preload.js et main.js
- Fonction `formatFileSize()` pour formater les tailles de fichier
- Hook `useEffect` pour récupérer la taille au chargement du composant
- Fonction `checkPythonInstalled()` pour vérifier la disponibilité de Python
- Gestion du clic en dehors pour ApiStatusBadge avec `useRef` et `useEffect`

### 🧹 Nettoyage de code
- **Suppression de code résiduel (API key système retiré en v1.0.6)** :
  - README.md : Suppression de l'exemple `publisher_config.json` avec apiKey
  - appContext.tsx : Suppression du commentaire obsolète "keeps apiKey out of renderer"
  - preload.js : Suppression des fonctions IPC inutilisées `getPublisherConfig/setPublisherConfig`

---

## [1.0.10] - 2026-01-13

### 🔒 Sécurité

#### Mises à jour majeures
- **Electron** : 25.0.0 → 39.2.7 (correction de vulnérabilités)
- **Vite** : 5.0.0 → 7.3.1 (correction vulnérabilité esbuild ≤0.24.2)
- **esbuild** : Mise à jour automatique via Vite (GHSA-67mh-4wv8-2f99)
- **0 vulnérabilité** restante après `npm audit fix --force`

### 🐛 Corrections

#### API Publisher
- **CORS preflight** : Ajout du handler `OPTIONS` pour `/api/status`
  - Correction de l'erreur 405 (Method Not Allowed)
  - Réponses `204 No Content` correctes pour les requêtes OPTIONS
  - Support CORS complet pour toutes les routes API

#### Configuration npm
- **Dépendance circulaire** : Suppression de `publication-generator-electron: file:..` dans `frontend/package.json`
- **Structure propre** : Deux `node_modules` séparés (racine: Electron, frontend: React/Vite)
- **Réinstallation complète** : Environnement npm nettoyé et reconstruit

### 📚 Documentation
- **README.md** : Mise à jour complète avec toutes les fonctionnalités actuelles
  - Versions des dépendances (Electron 39, Vite 7, React 18, TypeScript 5)
  - Section système de brouillons avec autosave
  - Pagination et lazy loading de l'historique
  - Raccourcis clavier complets (Ctrl+S, aide ?)
  - Performance optimisations documentées

---

## [1.0.9] - 2026-01-13

### ✨ Nouvelles fonctionnalités

#### Raccourcis clavier
- **`Ctrl+S` dans TemplatesModal** :
  - Sauvegarde rapide du template en cours d'édition
  - Validation automatique : affiche un avertissement si le nom est vide
  - Prévient le comportement par défaut du navigateur (Ctrl+S)
- **Modale d'aide des raccourcis (`ShortcutsHelpModal`)** :
  - Bouton "❓" ajouté dans le header à côté du bouton de thème
  - Liste complète des raccourcis organisés en 3 catégories :
    - **Navigation** : `Ctrl+H` (historique), `Ctrl+T` (thème)
    - **Édition** : `Ctrl+Z/Y` (annuler/refaire), `Ctrl+S` (sauvegarder)
    - **Interface** : `Échap` (fermer modale)
  - Affichage élégant avec balises `<kbd>` stylisées
  - Fermeture par touche `Échap` ou clic extérieur

---

## [1.0.8] - 2026-01-13

### ⚡ Performance

#### Optimisations majeures
- **Pagination de l'historique** :
  - Affichage par pages de 20 publications maximum
  - Boutons Précédent/Suivant avec compteur de page
  - Reset automatique à la page 1 lors du changement de filtres/recherche
  - Compteur "X publications sur Y" pour visibilité
- **Lazy loading des images** :
  - Composant `LazyImage` avec Intersection Observer
  - Chargement uniquement quand l'image devient visible (rootMargin: 50px)
  - Transition en fondu lors du chargement
  - Réduction drastique de la consommation mémoire pour l'historique
- **Compression d'images avant upload** :
  - Fonction `compressImage()` automatique pour images > 8 MB
  - Qualité JPEG à 80% (bon compromis qualité/taille)
  - Conversion automatique PNG → JPEG pour réduire la taille
  - Recalcul des dimensions en gardant le ratio d'aspect
  - Logs en console de la compression (taille avant/après)
- **Debounce du preview** :
  - Hook `useDebounce` personnalisé (300ms)
  - Appliqué aux inputs et au changement de template
  - Évite le recalcul du preview à chaque frappe
  - Optimisation avec useMemo pour le cache

### 🛠️ Technique
- Création du hook `useDebounce<T>` réutilisable
- Ajout de `useEffect` avec cleanup pour l'autosave et les timers
- Utilisation d'Intersection Observer pour le lazy loading (API native du navigateur)
- Optimisation mémoire avec pagination côté client

---

## [1.0.7] - 2026-01-13

### ✨ Ajouté

#### 💾 Système de brouillons pour templates
- **Autosave automatique** :
  - Sauvegarde automatique toutes les 30 secondes dans localStorage
  - Démarre automatiquement dès qu'il y a du contenu dans le formulaire
  - Badge "📝 Brouillon" visible dans l'éditeur avec bouton de sauvegarde manuelle
- **Indicateurs temporels** :
  - "Créé le" : Date de création du brouillon
  - "Modifié le" : Date de dernière modification
  - "Sauvegardé il y a" : Temps écoulé depuis la dernière sauvegarde (X secondes/minutes/heures/jours)
  - Affichés uniquement en mode brouillon, masqués après enregistrement final
- **Restauration automatique** :
  - Popup au lancement de TemplatesModal si un brouillon non enregistré est détecté
  - Possibilité d'accepter ou refuser la restauration
  - Protection contre la perte de travail en cas de crash/fermeture accidentelle
- **Gestion intelligente** :
  - Suppression automatique du brouillon après enregistrement définitif
  - Suppression manuelle via bouton "Annuler" (avec nettoyage du localStorage)
  - Les templates enregistrés conservent leurs métadonnées (createdAt, modifiedAt)

### 🔧 Technique
- Ajout des propriétés `isDraft`, `createdAt`, `modifiedAt`, `lastSavedAt` au type `Template`
- Gestion de l'autosave avec `useEffect` et `setInterval` (cleanup automatique)
- Stockage des brouillons dans `localStorage` sous la clé `template_draft`

---

## [1.0.6] - 2026-01-13

### 🧹 Nettoyage
- **Suppression du système de clé API** : Étant donné que l'API tourne uniquement en local (localhost:8080) et démarre automatiquement avec l'application, la clé API n'apporte aucune sécurité et a été complètement supprimée
  - Retrait de la configuration de clé API dans l'interface ConfigModal
  - Suppression de la vérification X-API-KEY côté serveur Python
  - Simplification des handlers IPC (plus de persistence de config)
  - Export/import de configuration nettoyés (ne concernent plus que templates/tags/instructions)
  - Code backend et frontend allégés

---

## [1.0.5] - 2026-01-13

### ✨ Ajouté

#### 🔄 API Discord améliorée
- **Rate limiting visible** :
  - Nouveau composant `ApiStatusBadge` dans la barre de navigation
  - Badge de statut avec indicateur de connexion (vert/rouge/jaune)
  - Affichage des requêtes restantes et limite totale
  - Compteur de temps avant reset (minutes/secondes)
  - Avertissement visuel (⚠️) si moins de 5 requêtes restantes
  - Popup détaillée au clic avec toutes les informations
  - Actualisation automatique toutes les 30 secondes
  - Bouton de rafraîchissement manuel
- **Retry automatique en cas d'erreur réseau** :
  - Nouvelle fonction `_discord_request_with_retry()` dans l'API Python
  - 3 tentatives automatiques avec délai exponentiel (1s, 2s, 4s)
  - Gestion intelligente des erreurs serveur (5xx) vs erreurs client (4xx)
  - Attente automatique si rate limit atteint avant nouvelle requête
  - Logs détaillés de toutes les tentatives
- **Logging amélioré** :
  - Nouveau système de logging avec module `logging` Python
  - Fichier `errors.log` créé automatiquement à la racine
  - Horodatage et niveau de sévérité pour chaque log
  - Logs simultanés dans fichier et console
  - Avertissements quand rate limit approche (< 5 requêtes)
- **Intégration frontend** :
  - Affichage du rate limit dans les messages de succès après publication
  - Format : "Publication réussie (45/50 requêtes restantes)"
  - Transmission des infos de rate limit depuis l'API vers le frontend via IPC

#### 📈 Module Statistiques
- **Tableau de bord complet** : Nouvelle modale `StatsModal` pour visualiser les statistiques de publication
  - **Métriques principales** : Total, Mes traductions, Partenaires avec pourcentages
  - **Top traducteurs** : Classement des 5 traducteurs les plus actifs
  - **Publications par mois** : Graphique en barres des publications dans le temps
- **Filtres avancés** :
  - Par période : 7 derniers jours, 30 derniers jours, 6 derniers mois, toutes les périodes
  - Par type : Mes traductions, Partenaires, ou tous les types
- **Export de données** :
  - Export CSV : Tableau avec date, titre, template, tags, URL Discord
  - Export JSON : Données complètes avec statistiques et métadonnées
- **Bouton d'accès** : Nouveau bouton "📈 Statistiques" dans la barre de navigation principale

#### 🔍 Recherche & Filtres dans l'historique
- **Barre de recherche** : Recherche en temps réel par titre, contenu et nom du jeu
- **Filtres multiples** :
  - Par date : Aujourd'hui, cette semaine, ce mois, cette année
  - Par template : Mes traductions / Partenaires
  - Par traducteur : Liste dynamique extraite des publications
- **Tri flexible** :
  - Par date : Plus récent ↔ Plus ancien
  - Par titre : A → Z / Z → A
- **Compteur de résultats** : Affichage du nombre de publications filtrées
- **Messages adaptés** : Indication claire quand aucun résultat ne correspond aux filtres

#### ✍️ Aide Markdown
- **Modale d'aide contextuelle** : Nouveau composant `MarkdownHelpModal` accessible depuis l'éditeur de template
- **Icône d'aide** : Bouton "?" à côté du champ "Contenu" dans la modale de gestion des templates
- **Syntaxe complète** : Exemples de toutes les balises Markdown supportées par Discord
  - Titres (H1, H2, H3)
  - Mise en forme (gras, italique, barré, souligné, code inline)
  - Liens et listes (puces, numérotées)
  - Citations et blocs de code
  - Spoilers et emojis Discord
- **Design clair** : Présentation en deux colonnes (syntaxe / description) pour chaque exemple
- **Lien documentation** : Accès direct à la documentation officielle Discord

#### 🔤 Correction orthographique
- **Correcteur natif activé** : Utilisation du correcteur orthographique intégré d'Electron/Chromium
- **Soulignement automatique** : Les fautes d'orthographe sont soulignées en rouge dans tous les champs de texte
- **Langue française** : Configuration `lang="fr-FR"` pour une détection optimale des fautes en français
- **Suggestions au clic droit** : Menu contextuel natif avec suggestions de correction (configuré dans main.js)
- **Configuration Electron** : `session.defaultSession.setSpellCheckerLanguages(['fr-FR', 'fr'])` pour activer les suggestions
- **Champs concernés** :
  - Synopsis dans l'éditeur de contenu
  - Toutes les variables de type textarea
  - Contenu des templates
  - Contenu des instructions
- **Gratuit et sans dépendance** : Aucune bibliothèque externe, utilise les capacités natives du navigateur

#### 🐛 Gestion des erreurs avancée
- **Nouveau composant `ErrorModal`** :
  - Modal détaillée affichant toutes les informations d'erreur
  - Code HTTP, code d'erreur, message et contexte
  - Suggestions intelligentes selon le type d'erreur (401, 404, 429, 5xx, réseau)
  - Détails techniques Discord affichables (collapsible)
  - Bouton "Copier les détails" pour partager l'erreur
  - Bouton "Réessayer" pour relancer l'action
  - Horodatage précis de l'erreur
- **Mode Debug intégré** :
  - Toggle dans Configuration API pour activer/désactiver
  - Console de logs intégrée avec historique (100 dernières entrées)
  - Export des logs en fichier .txt
  - Affichage des requêtes/réponses en temps réel
  - Stockage de la préférence dans localStorage
- **Intégration dans appContext** :
  - Affichage automatique du ErrorModal en cas d'erreur de publication
  - Gestion centralisée des erreurs (validation, API, réseau, interne)
  - Contexte détaillé pour chaque type d'erreur

### 🔧 Modifié

#### 🌐 Configuration simplifiée
- **URL API codée en dur** :
  - L'URL de l'API locale est maintenant `http://localhost:8080/api/forum-post` (codée dans l'application)
  - Plus besoin de configuration manuelle de l'URL
  - Seule la clé API reste configurable pour la sécurité
- **Interface Configuration API simplifiée** :
  - Affichage de l'URL locale en lecture seule avec indication du démarrage automatique
  - Retrait du champ de saisie URL devenu inutile
  - Bouton de test de connexion adapté ("Tester la connexion à l'API locale")
- **Détection améliorée des erreurs d'API** :
  - Détection spécifique quand l'API locale n'est pas accessible (status 0)
  - Message d'erreur clair : "L'API Publisher locale n'a pas démarré correctement"
  - Suggestions adaptées : relancer l'application, vérifier le port 8080, consulter la console
- **Export/Import** : Seule la clé API est exportée/importée (plus d'URL)

#### 🌐 API et Backend
- **API Backend (`publisher_api.py`)** :
  - Refactoring complet des fonctions `_discord_get`, `_discord_post_form`, `_discord_patch_json`, `_discord_patch_form`
  - Toutes les requêtes Discord passent maintenant par `_discord_request_with_retry()`
  - Ajout de la classe `RateLimitTracker` pour suivre les limites en temps réel
  - Headers de rate limit extraits automatiquement de chaque réponse Discord
  - Endpoints `/health` et `/api/status` retournent maintenant les infos de rate limit
  - Toutes les réponses de succès incluent `rate_limit` dans le JSON
- **Main Process (`main.js`)** :
  - Handler `publisher:publish` retourne maintenant aussi `rateLimit`
  - Extraction des données de rate limit après chaque publication
- **App Context (`appContext.tsx`)** :
  - Message de succès enrichi avec compteur de requêtes restantes
  - Gestion du rate limit dans le retour de `publishPost()`
  - Ajout de la fonction `showErrorModal()` pour afficher les erreurs
  - Capture de toutes les erreurs de publication avec contexte détaillé

---

## [1.0.4] - 2026-01-13

### ✨ Ajouté

#### 🏠 Hébergement local automatique
- **Lancement automatique des bots** : Les bots Discord démarrent automatiquement au lancement de l'application Electron
  - `startPythonBots()` : Lance `python/main_bots.py` en arrière-plan
  - `startPythonApi()` : Lance `python/publisher_api.py` en arrière-plan
  - Logs des bots visibles dans la console Electron (`Ctrl+Shift+I`)
- **Arrêt automatique** : Les processus Python sont arrêtés proprement à la fermeture de l'app
  - Gestion du lifecycle avec `before-quit` et `window-all-closed`
  - `stopPythonProcesses()` : Kill propre des processus

### ❌ Supprimé

- **Configuration Fly.io** : Remplacée par hébergement local automatique
  - `fly-bots.toml` - Configuration bots Fly.io
  - `fly-api.toml` - Configuration API Fly.io
  - `Dockerfile`, `Dockerfile.api`, `.dockerignore` - Dockerfiles
  - `docs_perso/DEPLOIEMENT_FLYIO.md` - Guide Fly.io

### 🔄 Modifié

#### 📦 Simplification de l'architecture
- **Plus besoin de cloud** : Tout fonctionne en local sur le PC de l'utilisateur
- **Configuration .env unique** : Un seul fichier `.env` pour tous les services
- **Expérience utilisateur améliorée** : Plus besoin de lancer manuellement les bots dans VS Code

---

## [1.0.3] - 2026-01-13

### 🔄 Modifié

#### 🌐 Migration vers Fly.io
- **Remplacement de Render.com par Fly.io** (Render est devenu payant)
- **Configuration Fly.io** : 2 fichiers `fly-bots.toml` et `fly-api.toml`
  - Machine 1 : Bots Discord combinés (background)
  - Machine 2 : API Publisher (web service)
  - Plan gratuit : 3 machines + 160 GB/mois de trafic
- **Documentation mise à jour** : Guide de déploiement Fly.io complet

### ❌ Supprimé

- `render.yaml` - Configuration Render.com obsolète
- `docs_perso/DEPLOIEMENT_RENDER.md` - Guide Render.com

### 📦 Fichiers ajoutés

- `fly-bots.toml` - Configuration Fly.io pour les bots Discord
- `fly-api.toml` - Configuration Fly.io pour l'API Publisher
- `docs_perso/DEPLOIEMENT_FLYIO.md` - Guide complet de déploiement Fly.io (non versionné)

---

## [1.0.2] - 2026-01-13

### ✨ Ajouté

#### 🌐 Hébergement et Déploiement
- **Configuration Render.com** : Fichier `render.yaml` pour déploiement automatique
  - Service 1 : Background Worker pour les 2 bots Discord combinés (750h/mois gratuit)
  - Service 2 : Web Service pour l'API Publisher (750h/mois gratuit)
  - Variables d'environnement configurables via dashboard
- **Launcher de bots combiné** : `python/main_bots.py`
  - Lance `bot_discord_server1.py` et `bot_discord_server2.py` en parallèle
  - Gestion d'erreurs optimisée
  - Optimisé pour hébergement cloud (Render.com / Fly.io)
- **Documentation d'hébergement** : Guide complet de déploiement sur Render.com
  - Configuration des services
  - Variables d'environnement
  - Vérification et debugging
  - Astuces pour optimiser le plan gratuit

### 🔄 Modifié

#### 🔒 Sécurité et Gestion des Fichiers
- **`.gitignore` amélioré** :
  - Exclusion renforcée des fichiers sensibles (`.env.local`, `.env.*.local`, `*.env`)
  - Exclusion des tokens (`*_token.txt`, `*_key.txt`)
  - Exclusion des fichiers d'exemple (`*.example`)
- **Organisation de la documentation** :
  - Fichiers de documentation déplacés dans `docs_perso/` (non versionné)
  - `.env.example` → `docs_perso/.env.example`
  - Guide de déploiement disponible localement uniquement

#### 📖 Documentation
- **README.md mis à jour** :
  - Section hébergement des bots avec recommandations
  - Architecture mise à jour avec `main_bots.py` et `render.yaml`
  - Lien vers le guide de déploiement Render.com

### 📦 Fichiers ajoutés

- `python/main_bots.py` - Launcher combiné pour les 2 bots Discord
- `render.yaml` - Configuration de déploiement Render.com
- `docs_perso/.env.example` - Template des variables d'environnement (non versionné)
- `docs_perso/DEPLOIEMENT_RENDER.md` - Guide complet de déploiement (non versionné)

---
## [1.0.2] - 2026-01-13

### ✨ Ajouté

#### 🌐 Hébergement et Déploiement
- **Configuration Render.com** : Fichier `render.yaml` pour déploiement automatique
  - Service 1 : Background Worker pour les 2 bots Discord combinés (750h/mois gratuit)
  - Service 2 : Web Service pour l'API Publisher (750h/mois gratuit)
  - Variables d'environnement configurables via dashboard
- **Launcher de bots combiné** : `python/main_bots.py`
  - Lance `bot_discord_server1.py` et `bot_discord_server2.py` en parallèle
  - Gestion d'erreurs optimisée
  - Optimisé pour hébergement cloud (Render.com / Fly.io)
- **Documentation d'hébergement** : Guide complet de déploiement sur Render.com
  - Configuration des services
  - Variables d'environnement
  - Vérification et debugging
  - Astuces pour optimiser le plan gratuit

### 🔄 Modifié

#### 🔒 Sécurité et Gestion des Fichiers
- **`.gitignore` amélioré** :
  - Exclusion renforcée des fichiers sensibles (`.env.local`, `.env.*.local`, `*.env`)
  - Exclusion des tokens (`*_token.txt`, `*_key.txt`)
  - Exclusion des fichiers d'exemple (`*.example`)
- **Organisation de la documentation** :
  - Fichiers de documentation déplacés dans `docs_perso/` (non versionné)
  - `.env.example` → `docs_perso/.env.example`
  - Guide de déploiement disponible localement uniquement

#### 📖 Documentation
- **README.md mis à jour** :
  - Section hébergement des bots avec recommandations
  - Architecture mise à jour avec `main_bots.py` et `render.yaml`
  - Lien vers le guide de déploiement Render.com

### 📦 Fichiers ajoutés

- `python/main_bots.py` - Launcher combiné pour les 2 bots Discord
- `render.yaml` - Configuration de déploiement Render.com
- `docs_perso/.env.example` - Template des variables d'environnement (non versionné)
- `docs_perso/DEPLOIEMENT_RENDER.md` - Guide complet de déploiement (non versionné)

---

## [1.0.1] - 2026-01-12

### ✨ Ajouté

#### 🎨 UX et Interface
- **Système de thèmes** : Basculer entre mode clair ☀️ et mode sombre 🌙 avec bouton dédié
  - Persistance du choix dans localStorage
  - Thème sombre inspiré de Le Nexus (couleurs riches et contrastées)
  - Adaptation automatique de tous les composants (inputs, selects, modales)
- **Validation visuelle** : Encadrement rouge du titre du post s'il est vide (aide à repérer les champs manquants)
- **Raccourcis clavier** :
  - `Ctrl+H` : Ouvrir l'historique des publications
  - `Ctrl+T` : Basculer entre thème clair/sombre
  - `Ctrl+Z` / `Ctrl+Y` : Undo/Redo dans le textarea Synopsis (historique de 50 états)
- **Icône Discord SVG** sur le bouton "Publier sur Discord" (remplace l'emoji 🚀)
- **Support formats d'images étendus** : AVIF, WebP, BMP, TIFF, SVG en plus de JPEG/PNG/GIF
- **Fonction de réinitialisation** : Bouton 🔄 dans la configuration pour remettre l'application à zéro (supprime localStorage et toutes les images)
- **Émojis sur tous les boutons** : Interface plus visuelle et cohérente
  - 🚪 Fermer - Ferme la modale
  - ❌ Annuler - Annule l'édition en cours
  - ✅ Enregistrer - Sauvegarde les modifications
  - ➕ Ajouter - Ajoute un nouvel élément
  - 📋 Copier le contenu - Copie le contenu d'un post pour créer un nouveau post
  - ✏️ Modifier - Charge un post pour modification
  - 🗑️ Supprimer - Supprime un élément

#### 🔒 UX des Modales
- **Fermeture par touche Échap** : Hook `useEscapeKey` pour toutes les modales
- **Verrouillage du scroll** : Hook `useModalScrollLock` empêche le scroll en arrière-plan
- **Sécurité anti-fermeture accidentelle** : Impossible de fermer en cliquant à l'extérieur de la modale
- **Hooks réutilisables** : `useEscapeKey.ts` et `useModalScrollLock.ts` pour cohérence

### 🔄 Modifié

#### 🎨 Interface et Cohérence
- **Palette de couleurs améliorée** : Application du thème de Le Nexus pour un rendu plus professionnel
  - Background: `#0f172a` → `#1e293b` (plus chaleureux)
  - Bordures solides `#334155` au lieu de transparentes
  - Accent indigo plus vif `#6366f1`
  - Couleurs success/error plus douces
- **Labels plus lisibles** : Assombrissement dans le thème clair (`#475569`)
- **Champs de saisie uniformisés** : Tous les inputs, selects et champs de recherche utilisent les mêmes styles
- **Placeholders cohérents** : Couleur adaptative selon le thème via variable CSS `--placeholder`
- **Select amélioré** : Option par défaut affichée en gris (couleur placeholder)
- **Suppression du titre "📝 Variables"** : Redondant car toutes les variables font partie du contenu par défaut

#### 📝 Templates
- **Variables corrigées** : Uniformisation des noms de variables dans les templates par défaut
  - `[Name_game]` → `[game_name]`
  - `[Game_version]` → `[game_version]`
  - `[Translate_version]` → `[translate_version]`
  - `[Game_link]` → `[game_link]`
  - `[Translate_link]` → `[translate_link]`
  - `[traductor]` → `[translator]`

#### 🎯 Boutons
- **Uniformisation complète** : Tous les boutons suivent la même logique
  - "🚪 Fermer" pour fermer les modales (plus de confusion avec Annuler)
  - "❌ Annuler" uniquement pour annuler une édition en cours
  - "✅ Enregistrer" sans émojis dupliqués (déjà ajouté par le système)
- **Clarification "Dupliquer"** : Renommé en "📋 Copier le contenu" pour clarifier qu'on copie le contenu, pas l'ID

#### 👁️ Preview
- **Espacement des titres** : Réduction drastique de l'espace sous les titres Markdown pour correspondre au rendu Discord
  - ### (h3) : 16px, marge bottom -4px
  - ## (h2) : 20px, marge bottom -6px
  - # (h1) : 24px, marge bottom -4px
  - Line-height réduit à 1.2 pour un rendu compact

#### 🖼️ Images
- **Support MIME types étendus** : Mapping complet pour AVIF, WebP, TIFF, SVG, ICO, BMP
- **Attribut accept étendu** : Input file accepte explicitement tous les formats modernes

### 🐛 Corrigé

- **Émojis dupliqués** : Retrait des émojis dans les messages `showToast` car le `ToastProvider` les ajoute automatiquement
  - ✅/❌/⚠️/ℹ️ ajoutés automatiquement selon le type (success/error/warning/info)
- **Double bouton Fermer** : Correction dans TemplatesModal (Annuler vs Fermer)
- **Section "Soutenez le Traducteur"** : Vérification de la présence dans le template "Mes traductions"

### 📦 Fichiers ajoutés

- `frontend/src/hooks/useEscapeKey.ts` - Hook de détection touche Échap
- `frontend/src/hooks/useModalScrollLock.ts` - Hook de verrouillage scroll
- `frontend/src/hooks/useUndoRedo.ts` - Hook pour gérer l'historique undo/redo
- `frontend/src/assets/discord-icon.svg` - Icône Discord officielle
- `docs_perso/roadmap.md` - Feuille de route des améliorations futures (non versionné)

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
