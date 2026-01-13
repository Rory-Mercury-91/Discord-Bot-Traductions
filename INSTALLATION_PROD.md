# Installation de l'application en production

## Prérequis

### 1. Python 3.10+

L'application nécessite Python pour exécuter l'API Discord et les bots de surveillance.

**Installation sur Windows :**
1. Téléchargez Python depuis https://www.python.org/downloads/
2. **IMPORTANT** : Cochez "Add Python to PATH" pendant l'installation
3. Vérifiez l'installation :
   ```powershell
   python --version
   ```

### 2. Dépendances Python

Une fois Python installé, installez les dépendances requises :

```powershell
# Naviguer vers le dossier resources de l'application
cd "C:\Program Files\PublicationGenerator\resources"

# Installer les dépendances
pip install -r requirements.txt
```

**Liste des dépendances :**
- `discord.py` - Bibliothèque Discord
- `aiohttp` - Serveur web asynchrone pour l'API
- `python-dotenv` - Gestion des variables d'environnement

### 3. Configuration (.env)

Le fichier `.env` contient vos tokens Discord et configurations. Vous devez le créer manuellement.

#### Où créer le fichier .env ?

**En production (application installée) :**
```
C:\Users\VotreNom\AppData\Roaming\PublicationGenerator\resources\.env
```

**Pour trouver facilement ce dossier :**
1. Ouvrez l'application
2. Appuyez sur `F12` (ouvre la console)
3. Tapez : `require('electron').app.getPath('userData')`
4. Le chemin s'affiche dans la console
5. Naviguez vers ce dossier puis entrez dans `resources\`

#### Comment créer le fichier .env

1. **Ouvrez le Bloc-notes** (ou tout éditeur de texte)

2. **Copiez-collez cette structure :**

```env
# ==========================================
# TOKENS DISCORD
# ==========================================

# Token du bot principal (surveillance serveur 1 - Annonces de traductions)
DISCORD_TOKEN=

# Token du bot secondaire (surveillance serveur 2 - Rappels F95)
DISCORD_TOKEN_F95=

# Token pour publier sur Discord via l'API
DISCORD_PUBLISHER_TOKEN=

# ==========================================
# IDS DES FORUMS DISCORD
# ==========================================

# ID du forum "Mes traductions"
PUBLISHER_FORUM_MY_ID=

# ID du forum "Traductions partenaire"
PUBLISHER_FORUM_PARTNER_ID=

# ==========================================
# CONFIGURATION API
# ==========================================

# Port de l'API locale (laisser 8080 par défaut)
PORT=8080

# Origines autorisées pour CORS (laisser * pour localhost)
PUBLISHER_ALLOWED_ORIGINS=*
```

3. **Remplissez les valeurs** (voir section suivante)

4. **Enregistrez sous le nom `.env`** (avec le point au début)
   - Dans "Type": choisissez "Tous les fichiers (*.*)"
   - Nom du fichier: `.env`

---

### 📋 Comment obtenir les tokens et IDs Discord

#### 🤖 Créer un bot Discord et obtenir le token

1. **Allez sur le portail développeur Discord** : https://discord.com/developers/applications

2. **Cliquez sur "New Application"**
   - Donnez un nom (ex: "Mon Bot Traductions")
   - Acceptez les conditions

3. **Allez dans l'onglet "Bot"**
   - Cliquez sur "Add Bot" → "Yes, do it!"
   - **Token** : Cliquez sur "Reset Token" puis "Copy"
   - ⚠️ **IMPORTANT** : Ne partagez jamais ce token !

4. **Activez les intents nécessaires** (en bas de la page) :
   - ☑️ Message Content Intent
   - ☑️ Server Members Intent
   - ☑️ Presence Intent

5. **Invitez le bot sur votre serveur** :
   - Allez dans "OAuth2" → "URL Generator"
   - Cochez : `bot`
   - Permissions : `Administrator` (ou permissions spécifiques)
   - Copiez l'URL générée et ouvrez-la dans votre navigateur
   - Sélectionnez votre serveur et autorisez

**Répétez cette opération 3 fois** pour obtenir :
- `DISCORD_TOKEN` → Bot 1 (surveillance serveur 1)
- `DISCORD_TOKEN_F95` → Bot 2 (surveillance serveur 2)
- `DISCORD_PUBLISHER_TOKEN` → Bot 3 (publication via API)

#### 🆔 Obtenir les IDs des forums Discord

1. **Activez le mode développeur dans Discord** :
   - Paramètres utilisateur (⚙️) → Avancé → Mode développeur (ON)

2. **Trouvez votre forum** :
   - Faites un clic droit sur le nom du forum/channel
   - Cliquez sur "Copier l'identifiant du salon"
   - Collez cette valeur dans le `.env`

**Exemple de .env rempli :**
```env
DISCORD_TOKEN=VOTRE_TOKEN_BOT_1_ICI
DISCORD_TOKEN_F95=VOTRE_TOKEN_BOT_2_ICI
DISCORD_PUBLISHER_TOKEN=VOTRE_TOKEN_PUBLISHER_ICI
PUBLISHER_FORUM_MY_ID=1427703869844230317
PUBLISHER_FORUM_PARTNER_ID=1459651299602858055
PORT=8080
PUBLISHER_ALLOWED_ORIGINS=*
```

⚠️ **IMPORTANT** : Remplacez `VOTRE_TOKEN_BOT_X_ICI` par les vrais tokens obtenus sur Discord Developer Portal.

Les tokens Discord ressemblent à : `MTIzNDU2Nzg5.GhJkLm.OpQrStUvWxYzAbCdEfGh` (exemple fictif)

---

## Vérification

Une fois tout installé, lancez l'application. Vous devriez voir dans la console :

```
🤖 Démarrage des bots Discord...
🚀 Démarrage de l'API Publisher...
[API] 🚀 Démarrage Publisher API sur le port 8080
```

Le badge "Connecté" en vert dans l'interface indique que l'API fonctionne correctement.

## Problèmes courants

### "Python n'est pas installé ou pas dans le PATH"

**Solution :**
1. Réinstallez Python en cochant "Add Python to PATH"
2. OU ajoutez manuellement Python au PATH :
   - Ouvrez les variables d'environnement Windows
   - Ajoutez `C:\Python310` (ou votre chemin Python) à la variable PATH
   - Redémarrez l'application

### "⚠️ Impossible de joindre l'API"

**Causes possibles :**
1. Python n'est pas installé
2. Les dépendances Python ne sont pas installées (`pip install -r requirements.txt`)
3. Le fichier `.env` est manquant ou mal configuré
4. Un autre programme utilise déjà le port 8080

**Solution :**
Vérifiez les logs de la console Electron (F12 ou Ctrl+Shift+I dans l'app)

### L'API démarre mais l'application ne se connecte pas

Vérifiez que le port 8080 n'est pas bloqué par le pare-feu Windows.

## Support

En cas de problème persistant, consultez les logs dans :
- Console de l'application (F12)
- Fichier `errors.log` dans le dossier de l'application
