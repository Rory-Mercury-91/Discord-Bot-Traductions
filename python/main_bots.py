import os
import sys
import asyncio
import logging
import random
from aiohttp import web
from dotenv import load_dotenv

import discord
from discord.http import Route

# Import direct des instances de bots
from bot_server1 import bot as bot1
from bot_server2 import bot as bot2

# Import des handlers du publisher
from publisher_api import (
    health as publisher_health,
    options_handler,
    configure,
    forum_post,
    forum_post_update,
    get_history
)

# Configuration de l'encodage pour Windows si nécessaire
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("orchestrator")

PORT = int(os.getenv("PORT", "8080"))

# -------------------------
# WEB APP (health + API)
# -------------------------
async def health(request):
    status = {
        "status": "ok",
        "bots": {"server1": bot1.is_ready(), "server2": bot2.is_ready()},
        "timestamp": int(asyncio.get_event_loop().time()),
    }
    return web.json_response(status)

def make_app():
    app = web.Application()

    app.router.add_get("/", health)
    app.router.add_get("/api/status", health)

    app.router.add_options("/api/configure", options_handler)
    app.router.add_post("/api/configure", configure)

    app.router.add_options("/api/forum-post", options_handler)
    app.router.add_post("/api/forum-post", forum_post)

    app.router.add_options("/api/forum-post/update", options_handler)
    app.router.add_post("/api/forum-post/update", forum_post_update)

    app.router.add_get("/api/publisher/health", publisher_health)
    app.router.add_get("/api/history", get_history)

    return app

# -------------------------
# BOT START (anti 429)
# -------------------------
async def start_bot_with_backoff(bot: discord.Client, token: str, name: str):
    """
    Démarre un bot Discord avec retry/backoff.
    IMPORTANT: sur échec, on ferme le bot pour éviter les "Unclosed client session".
    """
    delay = 30  # base plus safe que 15s
    while True:
        try:
            logger.info(f"🔌 {name}: tentative de login...")
            await bot.start(token)
            logger.info(f"✅ {name}: start() terminé (arrêt normal).")
            return
        except discord.errors.HTTPException as e:
            if getattr(e, "status", None) == 429:
                logger.warning(f"⛔ {name}: 429 Too Many Requests. Retry dans {delay:.0f}s...")
            else:
                logger.error(f"❌ {name}: HTTPException status={getattr(e,'status',None)}: {e}")
                raise
        except Exception as e:
            logger.error(f"❌ {name}: erreur au démarrage: {e}. Retry dans {delay:.0f}s...", exc_info=e)

        # ✅ évite les fuites de sessions aiohttp lors des retry
        try:
            await bot.close()
        except Exception:
            pass

        jitter = random.random() * 5
        await asyncio.sleep(delay + jitter)
        delay = min(delay * 2, 300)  # max 5 minutes

async def wait_ready(bot: discord.Client, name: str, timeout: int = 180):
    """
    Attend que le bot soit ready (Gateway OK).
    Si timeout, on considère que Discord bloque encore, mais on ne lance pas l'autre bot.
    """
    start_t = asyncio.get_event_loop().time()
    while not bot.is_ready():
        if asyncio.get_event_loop().time() - start_t > timeout:
            raise TimeoutError(f"{name} n'est pas ready après {timeout}s")
        await asyncio.sleep(2)

# -------------------------
# ORCHESTRATOR
# -------------------------
async def start():
    TOKEN1 = os.getenv("DISCORD_TOKEN")
    TOKEN2 = os.getenv("DISCORD_TOKEN_F95")

    if not TOKEN1:
        logger.error("❌ DISCORD_TOKEN manquant dans .env")
        return
    if not TOKEN2:
        logger.error("❌ DISCORD_TOKEN_F95 manquant dans .env")
        return

    # 1) Serveur Web (healthchecks)
    app = make_app()
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", PORT)
    await site.start()
    logger.info(f"🚀 Serveur API et HealthCheck lancé sur le port {PORT}")

    # 2) Démarrage réellement séquentiel:
    #    Bot1 -> attendre READY -> Bot2
    logger.info("🤖 Lancement Bot1 (séquentiel, avec backoff)...")
    bot1_task = asyncio.create_task(start_bot_with_backoff(bot1, TOKEN1, "Bot1"))

    try:
        await wait_ready(bot1, "Bot1", timeout=180)
        logger.info("✅ Bot1 ready. Lancement Bot2...")
    except Exception as e:
        # Si Bot1 n'arrive pas à être ready, on ne lance pas Bot2 (sinon on aggrave le 429)
        logger.error(f"⛔ Bot1 n'est pas ready, Bot2 ne sera pas lancé: {e}")
        await bot1_task  # garde le process vivant sur Bot1 retries
        return

    # Lancer Bot2 seulement après Bot1 READY
    await start_bot_with_backoff(bot2, TOKEN2, "Bot2")

if __name__ == "__main__":
    try:
        # Force l'API officielle pour les bots (ne touche pas ton Publisher API)
        Route.BASE = "https://discord.com/api/v10"
        logger.info("🛡️  Configuration : Bots en direct, Publisher via Proxy (inchangé).")

        asyncio.run(start())
    except KeyboardInterrupt:
        logger.info("🛑 Arrêt de l'orchestrateur (KeyboardInterrupt)")
