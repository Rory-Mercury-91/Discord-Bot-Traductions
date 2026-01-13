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

Créez un fichier `.env` dans le dossier `resources` avec vos tokens Discord :

```env
# Token du bot principal (serveur 1 - Annonces)
DISCORD_TOKEN=votre_token_bot_1

# Token du bot secondaire (serveur 2 - Rappels F95)
DISCORD_TOKEN_F95=votre_token_bot_2

# Token pour publier sur Discord
DISCORD_PUBLISHER_TOKEN=votre_token_publisher

# IDs des forums Discord
PUBLISHER_FORUM_MY_ID=1234567890
PUBLISHER_FORUM_PARTNER_ID=0987654321

# Port de l'API locale (par défaut 8080)
PORT=8080
```

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
