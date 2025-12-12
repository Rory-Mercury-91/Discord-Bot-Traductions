# Bot Discord - Annonces de Traductions

Bot Discord qui surveille un forum et envoie automatiquement des annonces dans un canal dédié.

## 🚀 Fonctionnalités

- Détection automatique des nouveaux threads dans le forum
- Annonces avec distinction "Nouveau jeu" vs "Mise à jour"
- Extraction automatique de la version du patch
- Affichage des tags de traduction avec emojis
- Anti-spam : supprime les doublons récents

## 📦 Installation locale

1. Clone le repo
2. Installe les dépendances :
```bash
pip install -r requirements.txt
```

3. Crée un fichier `.env` à partir de `.env.example` :
```bash
copy .env.example .env
```

4. Remplis le fichier `.env` avec tes vraies valeurs :
```env
DISCORD_TOKEN=ton_token_discord
FORUM_CHANNEL_ID=1427703869844230317
ANNOUNCE_CHANNEL_ID=1449148521084096695
```

5. Lance le bot :
```bash
python bot_discord.py
```

## 🌐 Déploiement sur Railway.app

### Étape 1 : Préparer GitHub
1. Va sur https://github.com/Rory-Mercury-91/Stockage
2. Supprime tous les fichiers existants (ou crée un nouveau repo)
3. Upload tous les fichiers de ce dossier SAUF le fichier `.env`

### Étape 2 : Configurer Railway
1. Va sur [railway.app](https://railway.app) et connecte-toi avec GitHub
2. Clique sur "New Project" → "Deploy from GitHub repo"
3. Sélectionne ton repo `Stockage`
4. Dans "Variables", ajoute ces 3 variables :
   - `DISCORD_TOKEN` = ton token Discord
   - `FORUM_CHANNEL_ID` = 1427703869844230317
   - `ANNOUNCE_CHANNEL_ID` = 1449148521084096695
5. Railway va automatiquement détecter le `Procfile` et lancer ton bot ! 🚀

### Étape 3 : Vérifier que ça marche
- Va dans les "Logs" de Railway
- Tu devrais voir : "Bot prêt : [nom de ton bot]"

## ⚙️ Configuration

Les variables d'environnement nécessaires :
- `DISCORD_TOKEN` : Token de ton bot Discord
- `FORUM_CHANNEL_ID` : ID du canal forum à surveiller (1427703869844230317)
- `ANNOUNCE_CHANNEL_ID` : ID du canal où envoyer les annonces (1449148521084096695)

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
├── .env.example       # Modèle de configuration
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
