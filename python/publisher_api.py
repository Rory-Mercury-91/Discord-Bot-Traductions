"""
API Publisher - Corrigé pour gérer FormData ET JSON
"""

import os
import sys
import json
import time
import asyncio
import logging
import base64
from datetime import datetime
from typing import Optional, Tuple
import aiohttp
from aiohttp import web
from dotenv import load_dotenv

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

load_dotenv()

# Configure logging to output to stdout only.  File handling has been removed
# because Koyeb captures standard output for log collection.
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class Config:
    def __init__(self):
        self.DISCORD_PUBLISHER_TOKEN = os.getenv("DISCORD_PUBLISHER_TOKEN", "")
        self.PUBLISHER_API_KEY = os.getenv("PUBLISHER_API_KEY", "")
        self.FORUM_MY_ID = int(os.getenv("PUBLISHER_FORUM_MY_ID", "0")) if os.getenv("PUBLISHER_FORUM_MY_ID") else 0
        self.FORUM_PARTNER_ID = int(os.getenv("PUBLISHER_FORUM_PARTNER_ID", "0")) if os.getenv("PUBLISHER_FORUM_PARTNER_ID") else 0
        self.ALLOWED_ORIGINS = os.getenv("PUBLISHER_ALLOWED_ORIGINS", "*")
        self.PORT = int(os.getenv("PORT", "8080"))
        self.DISCORD_API_BASE = "https://discord.com/api"
        self.configured = bool(self.DISCORD_PUBLISHER_TOKEN and self.FORUM_MY_ID and self.FORUM_PARTNER_ID)
    
    def update_from_frontend(self, config_data: dict):
        if 'discordPublisherToken' in config_data and config_data['discordPublisherToken']:
            self.DISCORD_PUBLISHER_TOKEN = config_data['discordPublisherToken']
        if 'publisherForumMyId' in config_data and config_data['publisherForumMyId']:
            self.FORUM_MY_ID = int(config_data['publisherForumMyId'])
        if 'publisherForumPartnerId' in config_data and config_data['publisherForumPartnerId']:
            self.FORUM_PARTNER_ID = int(config_data['publisherForumPartnerId'])
        
        self.configured = bool(self.DISCORD_PUBLISHER_TOKEN and self.FORUM_MY_ID and self.FORUM_PARTNER_ID)
        logger.info(f"✅ Configuration mise à jour (configured: {self.configured})")

config = Config()

class RateLimitTracker:
    def __init__(self):
        self.remaining: Optional[int] = None
        self.limit: Optional[int] = None
        self.reset_at: Optional[float] = None
        self.last_updated: Optional[float] = None
    
    def update_from_headers(self, headers: dict):
        try:
            if 'X-RateLimit-Remaining' in headers:
                self.remaining = int(headers['X-RateLimit-Remaining'])
            if 'X-RateLimit-Limit' in headers:
                self.limit = int(headers['X-RateLimit-Limit'])
            if 'X-RateLimit-Reset' in headers:
                self.reset_at = float(headers['X-RateLimit-Reset'])
            self.last_updated = time.time()
            if self.remaining is not None and self.remaining < 5:
                logger.warning(f"⚠️  Rate limit proche: {self.remaining} requêtes restantes")
        except (ValueError, KeyError) as e:
            logger.error(f"Erreur lecture headers rate limit: {e}")
    
    def get_info(self) -> dict:
        info = {
            "remaining": self.remaining,
            "limit": self.limit,
            "reset_at": self.reset_at,
            "reset_in_seconds": None
        }
        if self.reset_at:
            reset_in = max(0, self.reset_at - time.time())
            info["reset_in_seconds"] = int(reset_in)
        return info

rate_limiter = RateLimitTracker()

def _auth_headers():
    return {"Authorization": f"Bot {config.DISCORD_PUBLISHER_TOKEN}"}

async def _discord_request(session, method, path, headers=None, json_data=None, data=None):
    url = f"{config.DISCORD_API_BASE}{path}"
    try:
        async with session.request(method, url, headers=headers, json=json_data, data=data) as resp:
            rate_limiter.update_from_headers(resp.headers)
            try:
                data = await resp.json()
            except Exception:
                data = await resp.text()
            return resp.status, data, resp.headers
    except Exception as e:
        logger.error(f"Erreur requête Discord: {e}")
        return 500, {"error": str(e)}, {}

async def _discord_get(session: aiohttp.ClientSession, path: str):
    status, data, _ = await _discord_request(session, "GET", path, headers=_auth_headers())
    return status, data

async def _discord_patch_json(session: aiohttp.ClientSession, path: str, payload: dict):
    status, data, _ = await _discord_request(
        session, "PATCH", path,
        headers={**_auth_headers(), "Content-Type": "application/json"},
        json_data=payload
    )
    return status, data

async def _discord_post_form(session, path, form):
    return await _discord_request(session, "POST", path, headers=_auth_headers(), data=form)

def _split_tags(tags_raw):
    if not tags_raw:
        return []
    return [t.strip() for t in tags_raw.replace(';', ',').replace('|', ',').split(',') if t.strip()]

def _with_cors(request, resp):
    origin = request.headers.get("Origin", "*")
    resp.headers["Access-Control-Allow-Origin"] = config.ALLOWED_ORIGINS if config.ALLOWED_ORIGINS != '*' else origin
    resp.headers["Access-Control-Allow-Methods"] = "GET,POST,PATCH,OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = "*"
    resp.headers["Access-Control-Allow-Credentials"] = "true"
    return resp

def _pick_forum_id(template):
    if template == "partner":
        return config.FORUM_PARTNER_ID
    return config.FORUM_MY_ID

async def _resolve_applied_tag_ids(session: aiohttp.ClientSession, forum_id: int, tags_raw: str) -> list:
    wanted = _split_tags(tags_raw)
    if not wanted:
        return []

    status, ch = await _discord_get(session, f"/channels/{forum_id}")
    if status >= 300:
        return []

    available = ch.get("available_tags", []) or []
    applied = []

    for w in wanted:
        if w.isdigit():
            wid = int(w)
            if any(int(t.get("id", 0)) == wid for t in available):
                applied.append(wid)
            continue

        wl = w.lower()
        for t in available:
            name = (t.get("name") or "").lower()
            if name == wl:
                try:
                    applied.append(int(t["id"]))
                except Exception:
                    pass
                break

    seen = set()
    uniq = []
    for tid in applied:
        if tid not in seen:
            seen.add(tid)
            uniq.append(tid)
    return uniq

async def _create_forum_post(session, forum_id, title, content, tags_raw, images):
    applied_tag_ids = await _resolve_applied_tag_ids(session, forum_id, tags_raw)

    payload = {"name": title, "message": {"content": content if content else " "}}
    if applied_tag_ids:
        payload["applied_tags"] = applied_tag_ids

    form = aiohttp.FormData()
    form.add_field("payload_json", json.dumps(payload), content_type="application/json")

    if images:
        for i, img in enumerate(images):
            if img.get("bytes") and img.get("filename"):
                form.add_field(
                    f"files[{i}]",
                    img["bytes"],
                    filename=img["filename"],
                    content_type=img.get("content_type") or "application/octet-stream",
                )

    status, data, _ = await _discord_post_form(session, f"/channels/{forum_id}/threads", form)

    if status >= 300:
        return False, {"status": status, "discord": data}

    thread_id = data.get("id")
    guild_id = data.get("guild_id")
    return True, {
        "thread_id": thread_id,
        "guild_id": guild_id,
        "thread_url": f"https://discord.com/channels/{guild_id}/{thread_id}" if guild_id and thread_id else None,
    }

# --- HANDLERS HTTP ---
async def health(request: web.Request):
    resp = web.json_response({
        "ok": True,
        "service": "discord-publisher-api",
        "configured": config.configured,
        "rate_limit": rate_limiter.get_info()
    })
    return _with_cors(request, resp)

async def options_handler(request: web.Request):
    resp = web.Response(status=204)
    return _with_cors(request, resp)

async def configure(request: web.Request):
    try:
        data = await request.json()
        config.update_from_frontend(data)
        
        resp = web.json_response({
            "ok": True,
            "message": "Configuration mise à jour",
            "configured": config.configured
        })
        return _with_cors(request, resp)
    except Exception as e:
        logger.error(f"Erreur configuration: {e}")
        resp = web.json_response({
            "ok": False,
            "error": "configuration_failed",
            "details": str(e)
        }, status=400)
        return _with_cors(request, resp)

async def forum_post(request: web.Request):
    """
    Endpoint principal : POST /api/forum-post
    Accepte maintenant FormData depuis le frontend Tauri
    """
    
    # Vérification clé API
    api_key = request.headers.get("X-API-KEY") or request.query.get("api_key")
    if not api_key or api_key != config.PUBLISHER_API_KEY:
        resp = web.json_response({
            "ok": False,
            "error": "unauthorized",
            "message": "Clé API invalide ou manquante."
        }, status=401)
        return _with_cors(request, resp)

    if not config.configured:
        resp = web.json_response({
            "ok": False, 
            "error": "not_configured",
            "message": "API non configurée. Définissez DISCORD_PUBLISHER_TOKEN et les IDs de forum."
        }, status=503)
        return _with_cors(request, resp)

    title = ""
    content = ""
    tags = ""
    template = "my"
    images = []

    # Parser le FormData
    try:
        reader = await request.multipart()
        async for part in reader:
            if part.name == "title":
                title = (await part.text()).strip()
            elif part.name == "content":
                content = (await part.text()).strip()
            elif part.name == "tags":
                tags = (await part.text()).strip()
            elif part.name == "template":
                template = (await part.text()).strip()
            elif part.name and part.name.startswith("image_"):
                if part.filename:
                    images.append({
                        "bytes": await part.read(decode=False),
                        "filename": part.filename,
                        "content_type": part.headers.get("Content-Type", "image/png"),
                    })
    except Exception as e:
        logger.error(f"Erreur parsing FormData: {e}")
        resp = web.json_response({
            "ok": False, 
            "error": "bad_request", 
            "details": str(e)
        }, status=400)
        return _with_cors(request, resp)

    if not title:
        resp = web.json_response({"ok": False, "error": "missing_title"}, status=400)
        return _with_cors(request, resp)

    forum_id = _pick_forum_id(template)
    
    logger.info(f"📝 Publication: {title} (template: {template}, forum: {forum_id})")

    async with aiohttp.ClientSession() as session:
        ok, result = await _create_forum_post(
            session=session,
            forum_id=forum_id,
            title=title,
            content=content,
            tags_raw=tags,
            images=images if images else None,
        )

    if not ok:
        logger.error(f"❌ Échec publication: {result}")
        resp = web.json_response({
            "ok": False, 
            "error": "discord_error", 
            "details": result
        }, status=500)
        return _with_cors(request, resp)

    logger.info(f"✅ Publication réussie: {result.get('thread_url')}")
    
    resp = web.json_response({
        "ok": True,
        "template": template,
        "forum_id": forum_id,
        "rate_limit": rate_limiter.get_info(),
        **result
    })
    return _with_cors(request, resp)

async def forum_post_update(request: web.Request):
    """Endpoint PATCH (non utilisé pour l'instant)"""
    resp = web.json_response({
        "ok": False,
        "error": "not_implemented"
    }, status=501)
    return _with_cors(request, resp)