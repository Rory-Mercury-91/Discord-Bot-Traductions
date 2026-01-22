import os
import sys
import asyncio
import logging
import random
from aiohttp import web
from discord.http import Route
from dotenv import load_dotenv

# 1. CHARGEMENT & CONSTANTES
load_dotenv()
PORT = int(os.getenv("PORT", "8080"))
FORUM_ID_F95 = int(os.getenv("FORUM_ID_F95", "0"))
FORUM_ID_6S = int(os.getenv("FORUM_ID_6S", "0"))

# 2. IMPORTS DES CLASSES (Vérifie bien que ces noms existent dans tes fichiers)
from bot_server1 import BotServer1
from bot_server2 import BotServer2
from publisher_api import PublisherBot, config as publisher_config

# 3. IMPORTS DES HANDLERS API
from publisher_api import (
    health as publisher_health,
    options_handler,
    configure,
    forum_post,
    forum_post_update,
    get_history
)

# 4. POOL DE BOTS (Pour le suivi en temps réel)
active_bots = {}

# 5. LOGGING
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("orchestrator")

# -------------------------
# WEB APP (health + API)
# -------------------------
async def health(request):
    """Vérifie l'état de chaque bot dans le pool"""
    status = {
        "status": "ok",
        "bots": {}
    }
    for name, bot in active_bots.items():
        # Vérifie si l'objet bot existe et s'il est connecté à Discord
        status["bots"][name] = bot is not None and bot.is_ready()
    
    return web.json_response(status)

def make_app():
    app = web.Application()
    app.add_routes([
        web.get('/health', health), # Notre health check global
        web.get('/api/publisher/health', publisher_health),
        web.post('/api/forum-post', forum_post),
        web.post('/api/forum-post/update', forum_post_update),
        web.get('/api/history', get_history),
        web.post('/api/configure', configure),
        web.options('/{tail:.*}', options_handler)
    ])
    return app

# -------------------------
# GESTION DES BOTS
# -------------------------
async def start_bot_with_backoff(bot_class, name, token, **kwargs):
    """Relance le bot en recréant une instance propre à chaque fois."""
    delay = 30
    while True:
        # Création d'une instance neuve
        bot = bot_class(**kwargs)
        active_bots[name] = bot # Enregistrement pour le health check
        
        try:
            logger.info(f"🔌 {name}: tentative de connexion...")
            await bot.start(token)
        except Exception as e:
            await bot.close()
            active_bots[name] = None
            logger.error(f"❌ {name} erreur: {e}. Retry dans {delay}s...")
            await asyncio.sleep(delay)
            delay = min(delay * 2, 300)

async def start():
    # Récupération des tokens
    TOKEN1 = os.getenv("DISCORD_TOKEN")
    TOKEN2 = os.getenv("DISCORD_TOKEN_F95")
    TOKEN_PUB = os.getenv("DISCORD_PUBLISHER_TOKEN") or getattr(publisher_config, "DISCORD_PUBLISHER_TOKEN", "")

    if not TOKEN1 or not TOKEN2:
        logger.error("❌ Tokens Bot1 ou Bot2 manquants !")
        return

    # Lancement Serveur Web
    app = make_app()
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", PORT)
    await site.start()
    logger.info(f"🚀 Serveur API et HealthCheck lancé sur le port {PORT}")

    # Lancement des tâches en parallèle
    tasks = [
        start_bot_with_backoff(BotServer1, "Bot1", TOKEN1),
        start_bot_with_backoff(BotServer2, "Bot2", TOKEN2, forum_id_f95=FORUM_ID_F95, forum_id_6s=FORUM_ID_6S)
    ]

    if TOKEN_PUB:
        tasks.append(start_bot_with_backoff(PublisherBot, "PublisherBot", TOKEN_PUB))

    await asyncio.gather(*tasks)

if __name__ == "__main__":
    try:
        Route.BASE = "https://discord.com/api/v10"
        asyncio.run(start())
    except KeyboardInterrupt:
        logger.info("🛑 Arrêt de l'orchestrateur")