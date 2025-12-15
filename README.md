# Bot Discord - Annonces de Traductions

Bot Discord qui surveille un salon de type **Forum** sur Discord et envoie automatiquement des annonces dans un canal dédié lorsque de nouveaux threads sont créés ou modifiés.

## 🚀 Fonctionnalités

- Détection automatique des nouveaux threads dans le forum
- Détection des modifications du contenu des posts (pas seulement les tags)
- Annonces avec distinction "Nouvelle traduction" vs "Mise à jour"
- Extraction automatique du titre du jeu, version du jeu et version de la traduction
- Affichage des tags (Terminé, En cours) avec emojis
- Affichage de l'image du jeu
- Anti-spam : supprime les doublons récents
- Lien direct vers le thread du forum

## 📦 Installation locale

1. Clone le repo
2. Installe les dépendances :
```bash
pip install -r requirements.txt
```

3. Crée un fichier `.env` à la racine du projet avec le contenu suivant :
```env
DISCORD_TOKEN=ton_token_discord
FORUM_CHANNEL_ID=id_du_salon_forum
ANNOUNCE_CHANNEL_ID=id_du_salon_annonces
```

**Important** : Remplace les valeurs par tes propres informations :
- `ton_token_discord` : Le token de ton bot Discord (obtenu depuis le [Discord Developer Portal](https://discord.com/developers/applications))
- `id_du_salon_forum` : L'ID du salon de type **Forum** que tu veux surveiller (clic droit sur le salon → Copier l'identifiant)
- `id_du_salon_annonces` : L'ID du salon textuel où le bot enverra les annonces (clic droit sur le salon → Copier l'identifiant)

4. Lance le bot :
```bash
python bot_discord.py
```

## 🌐 Déploiement sur Railway.app

### 💰 Coûts Railway
Railway offre un plan gratuit avec :
- **Essai gratuit** : 30 jours avec **5$ de crédits**
- **Après l'essai** : **1$ par mois** de crédits inclus
- Limites : jusqu'à 0.5 GB RAM, 1 vCPU par service, 0.5 GB de stockage

Ce bot consomme très peu de ressources, le plan gratuit est donc largement suffisant ! 🎉

### Étape 1 : Préparer ton repo GitHub
1. Crée un nouveau repo GitHub (ou utilise un repo existant)
2. Upload tous les fichiers de ce projet **SAUF le fichier `.env`**
   - ⚠️ **IMPORTANT** : Ne jamais commit le fichier `.env` (il contient ton token Discord secret)
   - Les fichiers nécessaires : `bot_discord.py`, `requirements.txt`, `Procfile`, `README.md`

### Étape 2 : Configurer Railway
1. Va sur [railway.app](https://railway.app) et connecte-toi avec GitHub
2. Clique sur "New Project" → "Deploy from GitHub repo"
3. Sélectionne ton repo GitHub
4. Dans l'onglet "Variables", ajoute ces 3 variables d'environnement :
   - `DISCORD_TOKEN` = ton token Discord (obtenu depuis le [Discord Developer Portal](https://discord.com/developers/applications))
   - `FORUM_CHANNEL_ID` = l'ID de ton salon de type **Forum** (clic droit sur le salon → Copier l'identifiant)
   - `ANNOUNCE_CHANNEL_ID` = l'ID de ton salon d'annonces (clic droit sur le salon → Copier l'identifiant)
5. Railway va automatiquement détecter le `Procfile` et déployer ton bot ! 🚀

### Étape 3 : Vérifier que ça marche
- Va dans l'onglet "Logs" de ton projet Railway
- Tu devrais voir : "Bot prêt : [nom de ton bot]"
- Le bot devrait maintenant surveiller le forum et envoyer des annonces automatiquement

## ⚙️ Configuration

Les variables d'environnement nécessaires :
- `DISCORD_TOKEN` : Token de ton bot Discord (obtenu depuis le Discord Developer Portal)
- `FORUM_CHANNEL_ID` : ID du salon de type **Forum** à surveiller sur ton serveur Discord
- `ANNOUNCE_CHANNEL_ID` : ID du salon textuel où envoyer les annonces sur ton serveur Discord

**Comment obtenir les IDs de salons :**
1. Active le "Mode développeur" dans Discord (Paramètres utilisateur → Avancés → Mode développeur)
2. Fais un clic droit sur le salon → "Copier l'identifiant"

## 📋 Format attendu des posts

### Titre du thread
Format recommandé : `Nom du jeu [Version] [Auteur]`
Exemple : `Step Bi Step [v1.0 SE] [Dumb Koala Games]`

### Contenu du post
Le bot extrait automatiquement les informations des posts qui suivent ce format :

```
### :computer: Infos du Jeu & Liens de Téléchargement :
* **Titre du jeu :** [Nom du jeu]
* **Version du jeu :** [Version] (optionnel, sinon extrait du titre)
* **Version traduite :** [Version de la traduction]
* **Lien du jeu (VO) :** [Lien vers le jeu]
* **Lien de la Traduction 1 :** [Lien]
* **Lien de la Traduction 2 (Backup) :** [Lien]
```

Le bot génère alors une annonce avec :
- Nom du jeu (titre du thread, cliquable vers le thread)
- Version du jeu (extraite du titre ou du contenu)
- Version de la traduction
- État (basé sur les tags : Terminé, En cours)
- Image du post (si présente)

### Déclenchement des annonces

Le bot envoie une annonce dans les cas suivants :
- ✅ Lors de la création d'un nouveau thread **avec des tags**
- ✅ Lors de l'**ajout** d'un tag (pas lors du retrait)
- ✅ Lors de la modification du contenu du premier message du thread

**Important** : Le bot attend **5 secondes** après une modification avant d'envoyer l'annonce. Si vous faites plusieurs modifications rapidement, une seule annonce sera envoyée avec l'état final.

### 📝 Comment poster correctement une traduction

#### 1️⃣ **Créer le thread**
- **Titre** : `Nom du jeu [Version] [Auteur]`
  - Exemple : `Step Bi Step [v1.0 SE] [Dumb Koala Games]`

#### 2️⃣ **Rédiger le contenu**
Utilisez ce format dans le premier message :

```
### :computer: Infos du Jeu & Liens de Téléchargement :
* **Titre du jeu :** Step Bi Step
* **Version du jeu :** v1.0 SE (optionnel si déjà dans le titre)
* **Version traduite :** v1.0 SE (la dernière version stable)
* **Lien du jeu (VO) :** [Accès au jeu original](https://example.com)
* **Lien de la Traduction 1 :** [LewdCorner](https://example.com)
* **Lien de la Traduction 2 (Backup) :** [Proton Drive](https://example.com)
```

#### 3️⃣ **Ajouter une image**
Joignez une image du jeu (bannière, logo, etc.)

#### 4️⃣ **Ajouter le tag "En cours"**
Dès que vous ajoutez ce tag, le bot enverra une annonce après 5 secondes.

#### 5️⃣ **Mettre à jour la traduction**
- Modifiez le contenu (version traduite, liens, etc.)
- Le bot détecte automatiquement et envoie une mise à jour après 5 secondes

#### 6️⃣ **Marquer comme terminé**
Quand la traduction est complète :
1. Retirez le tag "En cours" (pas d'annonce)
2. Ajoutez le tag "Terminé" (annonce envoyée après 5 secondes)

**Astuce** : Vous pouvez faire toutes vos modifications (contenu + tags) en 5 secondes, et le bot n'enverra qu'une seule annonce avec l'état final ! 🎯

### ⚙️ Logique des annonces

| Situation | Tag avant | Tag après | Annonce ? |
|-----------|-----------|-----------|-----------|
| Nouveau thread | Aucun | En cours | ✅ Oui |
| Modification contenu | En cours | En cours | ✅ Oui |
| Retrait tag | En cours | Aucun | ❌ Non |
| Ajout tag | Aucun | Terminé | ✅ Oui |
| Changement tag | En cours | Terminé | ✅ Oui |
| Modification contenu | Terminé | Terminé | ✅ Oui |

## 🔒 Sécurité

⚠️ **IMPORTANT** : Ne commit JAMAIS ton fichier `.env` ou ton token Discord !
Le fichier `.gitignore` est configuré pour protéger tes secrets.

## 📝 Structure du projet

```
Bot_Discord/
├── bot_discord.py      # Code principal du bot
├── requirements.txt    # Dépendances Python
├── Procfile           # Configuration pour Railway
├── .env               # Tes secrets (NE PAS COMMIT)
├── .gitignore         # Fichiers à ignorer par Git
└── README.md          # Ce fichier
```

## 🐛 Dépannage

**Le bot ne démarre pas sur Railway :**
- Vérifie que les 3 variables d'environnement sont bien configurées
- Regarde les logs pour voir l'erreur exacte

**Le bot ne répond pas aux threads :**
- Vérifie que les IDs des canaux sont corrects
- Vérifie que le bot a les permissions nécessaires sur Discord

**Erreur "Invalid Token" :**
- Ton token Discord est incorrect ou a expiré
- Génère un nouveau token sur le Discord Developer Portal
