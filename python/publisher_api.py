"""
API Publisher - Serveur 1 : Création de posts Discord
API REST pour créer des posts de forum Discord automatiquement
"""
import os
import sys
import json
import time
import asyncio
import logging
from datetime import datetime
from typing import Optional, Tuple
import aiohttp
from aiohttp import web
from dotenv import load_dotenv

# Fix encoding pour Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

load_dotenv()

# --- LOGGING CONFIGURATION ---
LOG_FILE = "errors.log"
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE, encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# --- CONFIGURATION PUBLISHER ---
DISCORD_PUBLISHER_TOKEN = os.getenv("DISCORD_PUBLISHER_TOKEN", "")
FORUM_MY_ID = int(os.getenv("PUBLISHER_FORUM_MY_ID", "0"))
FORUM_PARTNER_ID = int(os.getenv("PUBLISHER_FORUM_PARTNER_ID", "0"))
ALLOWED_ORIGINS = os.getenv("PUBLISHER_ALLOWED_ORIGINS", "*")
PORT = int(os.getenv("PORT", "8080"))
DISCORD_API_BASE = "https://discord.com/api"

# Vérifications
if not DISCORD_PUBLISHER_TOKEN:
    raise ValueError("❌ DISCORD_PUBLISHER_TOKEN manquant")
if not FORUM_MY_ID:
    raise ValueError("❌ PUBLISHER_FORUM_MY_ID manquant")
if not FORUM_PARTNER_ID:
    raise ValueError("❌ PUBLISHER_FORUM_PARTNER_ID manquant")

# --- RATE LIMITING TRACKING ---
class RateLimitTracker:
    """Suit les limites de taux de l'API Discord"""
    def __init__(self):
        self.remaining: Optional[int] = None
        self.limit: Optional[int] = None
        self.reset_at: Optional[float] = None
        self.last_updated: Optional[float] = None
    
    def update_from_headers(self, headers: dict):
        """Met à jour les informations de rate limit depuis les headers de réponse Discord"""
        try:
            if 'X-RateLimit-Remaining' in headers:
                self.remaining = int(headers['X-RateLimit-Remaining'])
            if 'X-RateLimit-Limit' in headers:
                self.limit = int(headers['X-RateLimit-Limit'])
            if 'X-RateLimit-Reset' in headers:
                self.reset_at = float(headers['X-RateLimit-Reset'])
            self.last_updated = time.time()
            
            # Log warning if approaching limit
            if self.remaining is not None and self.remaining < 5:
                logger.warning(f"⚠️  Rate limit proche: {self.remaining} requêtes restantes")
        except (ValueError, KeyError) as e:
            logger.error(f"Erreur lors de la lecture des headers de rate limit: {e}")
    
    def get_info(self) -> dict:
        """Retourne les informations de rate limit pour l'API"""
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
    
    def should_wait(self) -> Tuple[bool, float]:
        """Vérifie si on doit attendre avant la prochaine requête"""
        if self.remaining is not None and self.remaining == 0 and self.reset_at:
            wait_time = max(0, self.reset_at - time.time())
            if wait_time > 0:
                return True, wait_time
        return False, 0.0

rate_limiter = RateLimitTracker()


def _auth_headers() -> dict:
    """Retourne les headers d'authentification Discord"""
    return {"Authorization": f"Bot {DISCORD_PUBLISHER_TOKEN}"}


def _cors_origin_ok(origin: str | None) -> str | None:
    """Vérifie si l'origine est autorisée pour CORS"""
    if not origin:
        return None
    if ALLOWED_ORIGINS.strip() == "*":
        return "*"
    allowed = [o.strip() for o in ALLOWED_ORIGINS.split(",") if o.strip()]
    return origin if origin in allowed else None


def _with_cors(request: web.Request, resp: web.StreamResponse) -> web.StreamResponse:
    """Ajoute les headers CORS à la réponse"""
    origin = request.headers.get("Origin")
    allowed_origin = _cors_origin_ok(origin)
    if allowed_origin:
        resp.headers["Access-Control-Allow-Origin"] = allowed_origin
        resp.headers["Vary"] = "Origin"
        resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
        resp.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS, GET, PATCH"
    return resp


def _split_tags(tags_raw: str) -> list[str]:
    """Sépare les tags par virgule"""
    if not tags_raw:
        return []
    return [t.strip() for t in tags_raw.split(",") if t.strip()]


def _pick_forum_id(template_value: str) -> int:
    """Choisit le bon forum selon le template"""
    t = (template_value or "").strip().lower()
    if t in {"partner", "partenaire", "partenaires"}:
        return FORUM_PARTNER_ID
    return FORUM_MY_ID


async def _discord_request_with_retry(
    session: aiohttp.ClientSession,
    method: str,
    path: str,
    max_retries: int = 3,
    **kwargs
) -> Tuple[int, dict, dict]:
    """
    Effectue une requête vers l'API Discord avec retry automatique
    Retourne: (status, data, headers)
    """
    url = f"{DISCORD_API_BASE}{path}"
    
    for attempt in range(max_retries):
        try:
            # Check rate limit before making request
            should_wait, wait_time = rate_limiter.should_wait()
            if should_wait:
                logger.warning(f"Rate limit atteint, attente de {wait_time:.1f}s")
                await asyncio.sleep(wait_time)
            
            async with session.request(method, url, **kwargs) as r:
                # Update rate limit info from response headers
                rate_limiter.update_from_headers(dict(r.headers))
                
                try:
                    data = await r.json(content_type=None)
                except Exception:
                    data = {}
                
                # Success or client error (don't retry client errors)
                if r.status < 500:
                    return r.status, data, dict(r.headers)
                
                # Server error - retry with exponential backoff
                if attempt < max_retries - 1:
                    wait_time = 2 ** attempt  # 1s, 2s, 4s
                    logger.warning(f"Erreur serveur {r.status}, tentative {attempt + 1}/{max_retries}, attente {wait_time}s")
                    await asyncio.sleep(wait_time)
                else:
                    # Last attempt failed
                    logger.error(f"Échec après {max_retries} tentatives: {r.status}")
                    return r.status, data, dict(r.headers)
                    
        except aiohttp.ClientError as e:
            # Network error
            if attempt < max_retries - 1:
                wait_time = 2 ** attempt
                logger.warning(f"Erreur réseau: {e}, tentative {attempt + 1}/{max_retries}, attente {wait_time}s")
                await asyncio.sleep(wait_time)
            else:
                logger.error(f"Erreur réseau après {max_retries} tentatives: {e}")
                return 0, {"error": str(e)}, {}
        except Exception as e:
            logger.error(f"Erreur inattendue lors de la requête: {e}")
            return 0, {"error": str(e)}, {}
    
    return 0, {"error": "max_retries_exceeded"}, {}


async def _discord_get(session: aiohttp.ClientSession, path: str):
    """Effectue une requête GET vers l'API Discord"""
    status, data, _ = await _discord_request_with_retry(
        session, "GET", path, headers=_auth_headers()
    )
    return status, data


async def _discord_post_form(session: aiohttp.ClientSession, path: str, form: aiohttp.FormData):
    """Effectue une requête POST vers l'API Discord"""
    status, data, _ = await _discord_request_with_retry(
        session, "POST", path, headers=_auth_headers(), data=form
    )
    return status, data


async def _discord_patch_json(session: aiohttp.ClientSession, path: str, payload: dict):
    """Effectue une requête PATCH vers l'API Discord (JSON)"""
    status, data, _ = await _discord_request_with_retry(
        session, "PATCH", path,
        headers={**_auth_headers(), "Content-Type": "application/json"},
        json=payload
    )
    return status, data


async def _discord_patch_form(session: aiohttp.ClientSession, path: str, form: aiohttp.FormData):
    """Effectue une requête PATCH vers l'API Discord (FormData)"""
    status, data, _ = await _discord_request_with_retry(
        session, "PATCH", path, headers=_auth_headers(), data=form
    )
    return status, data


async def _resolve_applied_tag_ids(session: aiohttp.ClientSession, forum_id: int, tags_raw: str) -> list[int]:
    """
    Résout les tags demandés en IDs Discord valides
    Accepte soit des IDs numériques, soit des noms de tags
    """
    wanted = _split_tags(tags_raw)
    if not wanted:
        return []

    status, ch = await _discord_get(session, f"/channels/{forum_id}")
    if status >= 300:
        return []

    available = ch.get("available_tags", []) or []
    applied: list[int] = []

    for w in wanted:
        # Si c'est déjà un ID numérique
        if w.isdigit():
            wid = int(w)
            if any(int(t.get("id", 0)) == wid for t in available):
                applied.append(wid)
            continue

        # Sinon, recherche par nom (insensible à la casse)
        wl = w.lower()
        for t in available:
            name = (t.get("name") or "").lower()
            if name == wl:
                try:
                    applied.append(int(t["id"]))
                except Exception:
                    pass
                break

    # Dédupliquer tout en préservant l'ordre
    seen = set()
    uniq = []
    for tid in applied:
        if tid not in seen:
            seen.add(tid)
            uniq.append(tid)
    return uniq


async def _create_forum_post(
    session: aiohttp.ClientSession,
    forum_id: int,
    title: str,
    content: str,
    tags_raw: str,
    images: list[dict] | None,
):
    """
    Crée un nouveau post de forum sur Discord
    images: list of {"bytes": bytes, "filename": str, "content_type": str}
    Retourne : (success, result_dict)
    """
    applied_tag_ids = await _resolve_applied_tag_ids(session, forum_id, tags_raw)

    payload = {"name": title, "message": {"content": content if content else " "}}
    if applied_tag_ids:
        payload["applied_tags"] = applied_tag_ids

    form = aiohttp.FormData()
    form.add_field("payload_json", json.dumps(payload), content_type="application/json")

    # Add all images as files[0], files[1], files[2], etc.
    if images:
        for i, img in enumerate(images):
            if img.get("bytes") and img.get("filename"):
                form.add_field(
                    f"files[{i}]",
                    img["bytes"],
                    filename=img["filename"],
                    content_type=img.get("content_type") or "application/octet-stream",
                )

    status, data = await _discord_post_form(session, f"/channels/{forum_id}/threads", form)

    if status >= 300:
        return False, {"status": status, "discord": data}

    thread_id = data.get("id")
    guild_id = data.get("guild_id")
    return True, {
        "thread_id": thread_id,
        "guild_id": guild_id,
        "thread_url": f"https://discord.com/channels/{guild_id}/{thread_id}" if guild_id and thread_id else None,
    }


async def _update_forum_post(
    session: aiohttp.ClientSession,
    thread_id: str,
    message_id: str,
    forum_id: int,
    title: str | None,
    content: str | None,
    tags_raw: str | None,
    images: list[dict] | None,
):
    """
    Met à jour un post de forum existant sur Discord
    images: list of {"bytes": bytes, "filename": str, "content_type": str}
    Retourne : (success, result_dict)
    """
    # 1. Update thread title and tags if provided
    if title is not None or tags_raw is not None:
        payload = {}
        if title:
            payload["name"] = title
        if tags_raw is not None:
            applied_tag_ids = await _resolve_applied_tag_ids(session, forum_id, tags_raw)
            payload["applied_tags"] = applied_tag_ids
        
        if payload:
            status, data = await _discord_patch_json(session, f"/channels/{thread_id}", payload)
            if status >= 300:
                return False, {"status": status, "discord": data, "step": "update_thread"}
    
    # 2. Update message content and/or add new images
    if content is not None or images:
        if images:
            # If images provided, use FormData
            payload = {}
            if content is not None:
                payload["content"] = content if content else " "
            
            form = aiohttp.FormData()
            form.add_field("payload_json", json.dumps(payload), content_type="application/json")
            
            # Add all images as files[0], files[1], files[2], etc.
            for i, img in enumerate(images):
                if img.get("bytes") and img.get("filename"):
                    form.add_field(
                        f"files[{i}]",
                        img["bytes"],
                        filename=img["filename"],
                        content_type=img.get("content_type") or "application/octet-stream",
                    )
            
            status, data = await _discord_patch_form(session, f"/channels/{thread_id}/messages/{message_id}", form)
        else:
            # No image, just update content
            payload = {"content": content if content else " "}
            status, data = await _discord_patch_json(session, f"/channels/{thread_id}/messages/{message_id}", payload)
        
        if status >= 300:
            return False, {"status": status, "discord": data, "step": "update_message"}
    
    # Success
    status, thread_data = await _discord_get(session, f"/channels/{thread_id}")
    guild_id = thread_data.get("guild_id") if status < 300 else None
    
    return True, {
        "thread_id": thread_id,
        "message_id": message_id,
        "guild_id": guild_id,
        "thread_url": f"https://discord.com/channels/{guild_id}/{thread_id}" if guild_id and thread_id else None,
    }


# --- HANDLERS HTTP ---

async def health(request: web.Request):
    """Endpoint de santé avec informations de rate limit"""
    resp = web.json_response({
        "ok": True,
        "service": "discord-publisher-api",
        "rate_limit": rate_limiter.get_info()
    })
    return _with_cors(request, resp)


async def options_handler(request: web.Request):
    """Handler pour les requêtes OPTIONS (CORS preflight)"""
    resp = web.Response(status=204)
    return _with_cors(request, resp)


async def forum_post(request: web.Request):
    """
    Endpoint principal : POST /api/forum-post
    Crée un post de forum Discord avec titre, contenu, tags et image optionnelle
    """
    # Vérification configuration
    if not DISCORD_PUBLISHER_TOKEN:
        resp = web.json_response({"ok": False, "error": "missing_DISCORD_PUBLISHER_TOKEN"}, status=500)
        return _with_cors(request, resp)

    if not FORUM_MY_ID or not FORUM_PARTNER_ID:
        resp = web.json_response({"ok": False, "error": "missing_PUBLISHER_FORUM_IDS"}, status=500)
        return _with_cors(request, resp)

    # Variables
    title = ""
    content = ""
    tags = ""
    template = "my"
    images = []
    main_image_index = 0

    ctype = request.headers.get("Content-Type", "")

    # Parsing multipart/form-data
    try:
        if "multipart/form-data" not in ctype:
            resp = web.json_response({"ok": False, "error": "expected_multipart_form_data"}, status=400)
            return _with_cors(request, resp)

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
            elif part.name == "main_image_index":
                try:
                    main_image_index = int(await part.text())
                except:
                    pass
            elif part.name and part.name.startswith("image_"):
                # Parse image_0, image_1, image_2, etc.
                if part.filename:
                    images.append({
                        "bytes": await part.read(decode=False),
                        "filename": part.filename,
                        "content_type": part.headers.get("Content-Type"),
                    })
            elif part.name == "image":  # Legacy single image support
                if part.filename:
                    images.append({
                        "bytes": await part.read(decode=False),
                        "filename": part.filename,
                        "content_type": part.headers.get("Content-Type"),
                    })

    except Exception as e:
        resp = web.json_response({"ok": False, "error": "bad_request", "details": str(e)}, status=400)
        return _with_cors(request, resp)

    # Reorder images so main image is first
    if images and 0 <= main_image_index < len(images):
        main_img = images.pop(main_image_index)
        images.insert(0, main_img)

    # Validation
    if not title:
        resp = web.json_response({"ok": False, "error": "missing_title"}, status=400)
        return _with_cors(request, resp)

    # Choix du forum
    forum_id = _pick_forum_id(template)

    # Création du post
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
        resp = web.json_response({"ok": False, "error": "discord_error", "details": result}, status=500)
        return _with_cors(request, resp)

    # Succès
    resp = web.json_response({
        "ok": True,
        "template": template,
        "forum_id": forum_id,
        "rate_limit": rate_limiter.get_info(),
        **result
    })
    return _with_cors(request, resp)


async def forum_post_update(request: web.Request):
    """
    Endpoint PATCH /api/forum-post/{thread_id}/{message_id}
    Met à jour un post de forum Discord existant
    """
    # Récupérer thread_id et message_id depuis l'URL
    thread_id = request.match_info.get("thread_id", "")
    message_id = request.match_info.get("message_id", "")
    
    if not thread_id or not message_id:
        resp = web.json_response({"ok": False, "error": "missing_thread_or_message_id"}, status=400)
        return _with_cors(request, resp)

    # Variables
    title = None
    content = None
    tags = None
    template = "my"
    images = []
    main_image_index = 0

    ctype = request.headers.get("Content-Type", "")

    # Parsing multipart/form-data
    try:
        if "multipart/form-data" not in ctype:
            resp = web.json_response({"ok": False, "error": "expected_multipart_form_data"}, status=400)
            return _with_cors(request, resp)

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
            elif part.name == "main_image_index":
                try:
                    main_image_index = int(await part.text())
                except:
                    pass
            elif part.name and part.name.startswith("image_"):
                # Parse image_0, image_1, image_2, etc.
                if part.filename:
                    images.append({
                        "bytes": await part.read(decode=False),
                        "filename": part.filename,
                        "content_type": part.headers.get("Content-Type"),
                    })
            elif part.name == "image":  # Legacy single image support
                if part.filename:
                    images.append({
                        "bytes": await part.read(decode=False),
                        "filename": part.filename,
                        "content_type": part.headers.get("Content-Type"),
                    })

    except Exception as e:
        resp = web.json_response({"ok": False, "error": "bad_request", "details": str(e)}, status=400)
        return _with_cors(request, resp)

    # Reorder images so main image is first
    if images and 0 <= main_image_index < len(images):
        main_img = images.pop(main_image_index)
        images.insert(0, main_img)

    # Choix du forum
    forum_id = _pick_forum_id(template)

    # Mise à jour du post
    async with aiohttp.ClientSession() as session:
        ok, result = await _update_forum_post(
            session=session,
            thread_id=thread_id,
            message_id=message_id,
            forum_id=forum_id,
            title=title,
            content=content,
            tags_raw=tags,
            images=images if images else None,
        )

    if not ok:
        resp = web.json_response({"ok": False, "error": "discord_error", "details": result}, status=500)
        return _with_cors(request, resp)

    # Succès
    resp = web.json_response({
        "ok": True,
        "template": template,
        "forum_id": forum_id,
        "rate_limit": rate_limiter.get_info(),
        **result
    })
    return _with_cors(request, resp)


def make_app() -> web.Application:
    """Crée l'application web aiohttp"""
    app = web.Application()
    app.router.add_get("/health", health)
    app.router.add_route("OPTIONS", "/api/status", options_handler)
    app.router.add_get("/api/status", health)  # Alias for health check
    app.router.add_route("OPTIONS", "/api/forum-post", options_handler)
    app.router.add_route("OPTIONS", "/api/forum-post/{thread_id}/{message_id}", options_handler)
    app.router.add_post("/api/forum-post", forum_post)
    app.router.add_patch("/api/forum-post/{thread_id}/{message_id}", forum_post_update)
    return app


if __name__ == "__main__":
    print(f"🚀 Démarrage Publisher API sur le port {PORT}")
    print(f"📊 Forum 'Mes traductions' : {FORUM_MY_ID}")
    print(f"📊 Forum 'Partenaire' : {FORUM_PARTNER_ID}")
    print(f"🔒 CORS autorisé : {ALLOWED_ORIGINS}")
    
    app = make_app()
    web.run_app(app, host="0.0.0.0", port=PORT)