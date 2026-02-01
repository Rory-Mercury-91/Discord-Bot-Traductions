"""
🐝 Bot Discord - Serveur FRELON (F95Zone Checker)
Vérifie les MAJ F95Zone via API checker.php quotidiennement à 6h
Anciennement "Bot Serveur 2"
"""
import discord
from discord.ext import commands, tasks
from discord import app_commands
import os
import asyncio
import datetime
import random
import re
import aiohttp
from zoneinfo import ZoneInfo
from dotenv import load_dotenv
from typing import Optional, Dict, List

load_dotenv()

# ==================== CONFIGURATION ====================
TOKEN = os.getenv('DISCORD_TOKEN_F95')
FORUM_SEMI_AUTO_ID = int(os.getenv('FORUM_SEMI_AUTO_ID')) if os.getenv('FORUM_SEMI_AUTO_ID') else None
FORUM_AUTO_ID = int(os.getenv('FORUM_AUTO_ID')) if os.getenv('FORUM_AUTO_ID') else None
NOTIFICATION_CHANNEL_F95_ID = int(os.getenv('NOTIFICATION_CHANNEL_F95_ID')) if os.getenv('NOTIFICATION_CHANNEL_F95_ID') else None
WARNING_MAJ_CHANNEL_ID = int(os.getenv('WARNING_MAJ_CHANNEL_ID')) if os.getenv('WARNING_MAJ_CHANNEL_ID') else None
ALLOWED_USER_ID = int(os.getenv('ALLOWED_USER_ID')) if os.getenv('ALLOWED_USER_ID') else None
DAYS_BEFORE_PUBLICATION = int(os.getenv('DAYS_BEFORE_PUBLICATION', '14'))
CHECK_TIME_HOUR = int(os.getenv('VERSION_CHECK_HOUR', '6'))
CHECK_TIME_MINUTE = int(os.getenv('VERSION_CHECK_MINUTE', '0'))
MANUAL_CHECK_COOLDOWN_SECONDS = int(os.getenv('MANUAL_CHECK_COOLDOWN_SECONDS', '90'))
RSS_URL = "https://f95zone.to/sam/latest_alpha/latest_data.php?cmd=rss&cat=games&rows=90&ignored=hide"

print("🐝 [FRELON] Configuration chargée:")
print(f"   - FORUM_SEMI_AUTO_ID: {FORUM_SEMI_AUTO_ID}")
print(f"   - FORUM_AUTO_ID: {FORUM_AUTO_ID}")
print(f"   - NOTIFICATION_CHANNEL_F95_ID: {NOTIFICATION_CHANNEL_F95_ID}")
print(f"   - WARNING_MAJ_CHANNEL_ID: {WARNING_MAJ_CHANNEL_ID}")
print(f"   - CHECK_TIME: {CHECK_TIME_HOUR:02d}:{CHECK_TIME_MINUTE:02d}")
print(f"   - DAYS_BEFORE_PUBLICATION: {DAYS_BEFORE_PUBLICATION}")

intents = discord.Intents.default()
intents.message_content = True
intents.guilds = True

bot = commands.Bot(command_prefix="!", intents=intents)

# ==================== ANTI-SPAM ====================
CHECK_LOCK = asyncio.Lock()
_LAST_MANUAL_CHECK_AT: Optional[datetime.datetime] = None
MANUAL_CHECK_COOLDOWN_SECONDS = 90

# Stockage anti-doublon (mémoire simple)
_notified_versions: Dict[int, Dict] = {}

def _manual_check_allowed() -> bool:
    global _LAST_MANUAL_CHECK_AT
    now = datetime.datetime.now()
    print(f"🐝 [FRELON] Vérification cooldown manuel...")
    if _LAST_MANUAL_CHECK_AT is None:
        print(f"🐝 [FRELON] Premier check manuel, autorisation accordée")
        _LAST_MANUAL_CHECK_AT = now
        return True
    delta = (now - _LAST_MANUAL_CHECK_AT).total_seconds()
    if delta < MANUAL_CHECK_COOLDOWN_SECONDS:
        remaining = MANUAL_CHECK_COOLDOWN_SECONDS - delta
        print(f"🐝 [FRELON] Cooldown actif: {remaining:.0f}s restantes")
        return False
    print(f"🐝 [FRELON] Cooldown expiré, autorisation accordée")
    _LAST_MANUAL_CHECK_AT = now
    return True

def _clean_old_notifications():
    """Nettoie les entrées de plus de 30 jours"""
    cutoff = datetime.datetime.now() - datetime.timedelta(days=30)
    to_remove = [
        tid for tid, data in _notified_versions.items()
        if data.get("timestamp", datetime.datetime.min) < cutoff
    ]
    if to_remove:
        print(f"🐝 [FRELON] Nettoyage de {len(to_remove)} notifications anciennes (>30j)")
    for tid in to_remove:
        del _notified_versions[tid]

def _is_already_notified(thread_id: int, f95_version: str) -> bool:
    if thread_id not in _notified_versions:
        print(f"🐝 [FRELON] Thread {thread_id} jamais notifié")
        return False
    stored_version = _notified_versions[thread_id].get("f95_version")
    is_same = stored_version == f95_version
    print(f"🐝 [FRELON] Thread {thread_id}: version stockée={stored_version}, nouvelle={f95_version}, déjà notifié={is_same}")
    return is_same

def _mark_as_notified(thread_id: int, f95_version: str):
    print(f"🐝 [FRELON] Marquage thread {thread_id} comme notifié (version {f95_version})")
    _notified_versions[thread_id] = {
        "f95_version": f95_version,
        "timestamp": datetime.datetime.now()
    }

# ==================== REGEX PATTERNS ====================
_RE_GAME_LINK = re.compile(
    r"^\s*Lien\s+du\s+jeu\s*:\s*\[(?P<label>[^\]]+)\]\((?P<url>https?://[^)]+)\)\s*$",
    re.IGNORECASE | re.MULTILINE
)
_RE_GAME_VERSION = re.compile(
    r"^\s*Version\s+du\s+jeu\s*:\s*(?P<ver>.+?)\s*$",
    re.IGNORECASE | re.MULTILINE
)
_RE_TRANSLATION_VERSION = re.compile(
    r"^\s*Version\s+de\s+la\s+traduction\s*:\s*(?P<ver>.+?)\s*$",
    re.IGNORECASE | re.MULTILINE
)

def _extract_link_and_versions(text: str):
    """Extrait (url_f95, version_jeu, version_traduction)"""
    if not text:
        print(f"🐝 [FRELON] _extract_link_and_versions: texte vide")
        return None, None, None
    
    m_link = _RE_GAME_LINK.search(text)
    m_game_ver = _RE_GAME_VERSION.search(text)
    m_trad_ver = _RE_TRANSLATION_VERSION.search(text)
    
    url = m_link.group("url").strip() if m_link else None
    game_ver = m_game_ver.group("ver").strip() if m_game_ver else None
    trad_ver = m_trad_ver.group("ver").strip() if m_trad_ver else None
    
    print(f"🐝 [FRELON] Extraction: url={url}, game_ver={game_ver}, trad_ver={trad_ver}")
    
    return url, game_ver, trad_ver

# ==================== NORMALISATION URLs ====================

def extract_f95_thread_id(url: str) -> Optional[str]:
    """
    Extrait l'ID numérique d'un thread F95Zone
    
    Examples:
        https://f95zone.to/threads/game-name.285451/ -> "285451"
        https://f95zone.to/threads/285451 -> "285451"
        https://f95zone.to/threads/game-name.285451/page-5#post-123 -> "285451"
    
    Returns:
        L'ID numérique comme string, ou None si non trouvé
    """
    if not url:
        print(f"🐝 [FRELON] extract_f95_thread_id: URL vide")
        return None
    
    # Pattern pour capturer l'ID : soit après "threads/" soit après le dernier "."
    # Format 1: /threads/285451
    # Format 2: /threads/game-name.285451/
    pattern = r'/threads/(?:[^/]+\.)?(\d+)'
    
    match = re.search(pattern, url)
    if match:
        thread_id = match.group(1)
        print(f"🐝 [FRELON] Thread ID extrait: {thread_id} depuis {url}")
        return thread_id
    
    print(f"🐝 [FRELON] ⚠️ Impossible d'extraire l'ID de: {url}")
    return None


def normalize_f95_url(url: str) -> str:
    """
    Normalise une URL F95Zone en gardant juste l'ID
    
    Returns:
        URL normalisée : "https://f95zone.to/threads/285451"
    """
    thread_id = extract_f95_thread_id(url)
    if thread_id:
        return f"https://f95zone.to/threads/{thread_id}"
    return url.lower().rstrip('/').split('#')[0]


# ==================== PARSING RSS ====================

import xml.etree.ElementTree as ET

async def fetch_f95_versions_by_ids(session: aiohttp.ClientSession, thread_ids: list) -> Dict[str, str]:
    """
    🆕 NOUVELLE MÉTHODE: Récupère les versions depuis l'API F95 checker.php
    Plus fiable et précise que le flux RSS !
    
    ⚠️ LIMITE API F95: Maximum 100 IDs par requête
    Cette fonction découpe automatiquement en blocs de 50 IDs pour la sécurité
    
    Args:
        session: Session aiohttp
        thread_ids: Liste des IDs de threads F95 (ex: ["100", "285451"])
    
    Returns:
        Dict {thread_id: version}
        Example: {"100": "v0.68", "285451": "Ch.7"}
    """
    if not thread_ids:
        print(f"🐝 [FRELON] fetch_f95_versions_by_ids: liste vide, aucune requête")
        return {}
    
    # ⚠️ LIMITE API: Maximum 100 IDs, on utilise des chunks de 50 par sécurité
    CHUNK_SIZE = 50
    total_ids = len(thread_ids)
    all_versions = {}
    
    print(f"🐝 [FRELON] Récupération pour {total_ids} threads (par blocs de {CHUNK_SIZE})")
    
    # Découper en chunks de 50 IDs
    for chunk_idx in range(0, total_ids, CHUNK_SIZE):
        chunk = thread_ids[chunk_idx:chunk_idx + CHUNK_SIZE]
        chunk_num = (chunk_idx // CHUNK_SIZE) + 1
        total_chunks = (total_ids + CHUNK_SIZE - 1) // CHUNK_SIZE
        
        print(f"🐝 [FRELON] ----------------------------------------")
        print(f"🐝 [FRELON] Bloc {chunk_num}/{total_chunks}: {len(chunk)} IDs")
        print(f"🐝 [FRELON] IDs: {chunk[:5]}{'...' if len(chunk) > 5 else ''}")
        
        # Construire l'URL pour ce chunk
        ids_str = ",".join(str(tid) for tid in chunk)
        checker_url = f"https://f95zone.to/sam/checker.php?threads={ids_str}"
        
        try:
            async with session.get(checker_url, timeout=aiohttp.ClientTimeout(total=30)) as resp:
                print(f"🐝 [FRELON] Réponse HTTP: {resp.status}")
                
                if resp.status != 200:
                    print(f"🐝 [FRELON] ⚠️ F95 Checker API HTTP {resp.status} pour le bloc {chunk_num}")
                    continue  # Passer au chunk suivant
                
                data = await resp.json()
                
                # Format de réponse: {"status":"ok","msg":{"100":"v0.68","285451":"Ch.7"}}
                if data.get("status") == "ok" and "msg" in data:
                    chunk_versions = data["msg"]
                    print(f"🐝 [FRELON] ✅ Bloc {chunk_num}: {len(chunk_versions)} versions récupérées")
                    
                    # Afficher quelques exemples
                    for tid, ver in list(chunk_versions.items())[:3]:
                        print(f"🐝 [FRELON]    Thread {tid} → {ver}")
                    
                    # Fusionner avec les résultats globaux
                    all_versions.update(chunk_versions)
                else:
                    print(f"🐝 [FRELON] ⚠️ Bloc {chunk_num}: réponse invalide: {data}")
                    
        except Exception as e:
            print(f"🐝 [FRELON] ❌ Erreur bloc {chunk_num}: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()
        
        # Petit délai entre les requêtes pour ne pas surcharger l'API
        if chunk_idx + CHUNK_SIZE < total_ids:
            await asyncio.sleep(1)
            print(f"🐝 [FRELON] ⏱️ Pause 1s avant le bloc suivant...")
    
    print(f"🐝 [FRELON] ========================================")
    print(f"🐝 [FRELON] ✅ TOTAL: {len(all_versions)}/{total_ids} versions récupérées")
    print(f"🐝 [FRELON] ========================================")
    
    return all_versions


async def fetch_f95_rss_updates(session: aiohttp.ClientSession) -> Dict[str, str]:
    """
    Récupère le flux RSS F95Zone
    
    Returns:
        Dict {url_normalisée: version}
        Example: {"https://f95zone.to/threads/285451": "Ch.7"}
    """
    try:
        async with session.get(RSS_URL, timeout=aiohttp.ClientTimeout(total=30)) as resp:
            if resp.status != 200:
                print(f"⚠️ RSS F95 HTTP {resp.status}")
                return {}
            xml_content = await resp.text()
    except Exception as e:
        print(f"❌ Erreur fetch RSS: {e}")
        raise  # On propage pour signaler l'erreur HTTP
    
    updates_map = {}
    
    try:
        root = ET.fromstring(xml_content)
        
        for item in root.findall('.//item'):
            link_elem = item.find('link')
            title_elem = item.find('title')
            
            if link_elem is None or title_elem is None:
                continue
            
            url = link_elem.text.strip() if link_elem.text else ""
            title = title_elem.text.strip() if title_elem.text else ""
            
            if not url or not title:
                continue
            
            # Normaliser l'URL (juste l'ID)
            clean_url = normalize_f95_url(url)
            
            # Extraire version du titre: "Game Name [Ch.7] [Author]"
            version = extract_version_from_rss_title(title)
            
            if clean_url and version:
                updates_map[clean_url] = version
        
        print(f"📡 RSS: {len(updates_map)} jeux avec MAJ récente")
        
    except ET.ParseError as e:
        print(f"❌ XML parsing error: {e}")
        raise
    except Exception as e:
        print(f"❌ Erreur traitement RSS: {e}")
        raise
    
    return updates_map


def extract_version_from_rss_title(title: str) -> Optional[str]:
    """
    Extrait la version / info depuis le titre RSS F95zone.
    Format: "[TAG] Titre du jeu [Version ou Chapitre ou Libellé]"
    Retourne le dernier segment entre crochets (après le titre), quel qu'en soit le format :
    - versions : [v26.1.0a], [v1.0], [v.2 Release], [0.22]
    - chapitres : [Ch. 1], [Ch.7]
    - libellés : [Final], [Demo], [Alpha 0.15.2], [6000.0.24f1], etc.
    """
    bracket_pattern = re.compile(r'\[([^\]]+)\]')
    matches = bracket_pattern.findall(title)
    if not matches:
        return None
    return matches[-1].strip()


# ==================== COLLECTE THREADS ====================

async def _collect_all_forum_threads(forum: discord.ForumChannel) -> List[discord.Thread]:
    """Récupère TOUS les threads (actifs + archivés)"""
    all_threads: Dict[int, discord.Thread] = {}
    
    # Threads actifs
    for t in list(getattr(forum, "threads", []) or []):
        all_threads[t.id] = t
    
    # Threads archivés
    if hasattr(forum, "archived_threads"):
        before = None
        while True:
            batch = []
            try:
                async for t in forum.archived_threads(limit=100, before=before):
                    batch.append(t)
            except TypeError:
                async for t in forum.archived_threads(limit=100):
                    batch.append(t)
            
            if not batch:
                break
            
            for t in batch:
                all_threads[t.id] = t
            
            before = batch[-1].archive_timestamp or batch[-1].created_at
            await asyncio.sleep(0.5)
            
            if before is None:
                break
    
    return list(all_threads.values())


# ==================== CONTRÔLE VERSION RSS ====================

class VersionAlert:
    def __init__(self, thread_name: str, thread_url: str, f95_version: str,
                 post_game_version: str, post_trad_version: str, forum_type: str):
        self.thread_name = thread_name
        self.thread_url = thread_url
        self.f95_version = f95_version
        self.post_game_version = post_game_version
        self.post_trad_version = post_trad_version
        self.forum_type = forum_type


async def send_grouped_alerts(channel: discord.TextChannel, alerts: List[VersionAlert]):
    """Envoie les alertes groupées par type de forum"""
    if not alerts:
        return
    
    # Grouper par type
    auto_alerts = [a for a in alerts if a.forum_type == "Auto"]
    semiauto_alerts = [a for a in alerts if a.forum_type == "Semi-Auto"]
    
    # Envoyer Auto
    if auto_alerts:
        await _send_alert_batch(channel, auto_alerts, "Traductions Automatiques")
    
    # Envoyer Semi-Auto
    if semiauto_alerts:
        await _send_alert_batch(channel, semiauto_alerts, "Traductions Semi-Automatiques")


async def _send_alert_batch(channel: discord.TextChannel, alerts: List[VersionAlert], forum_name: str):
    """Envoie un batch d'alertes (max 5 par message)"""
    for i in range(0, len(alerts), 5):
        batch = alerts[i:i+5]
        
        msg_parts = [
            f"🚨 **Mises à jour détectées : {forum_name}** ({len(batch)} jeu{'x' if len(batch) > 1 else ''})",
            ""
        ]
        
        for alert in batch:
            msg_parts.append(
                f"**{alert.thread_name}**\n"
                f"├ Version F95 : `{alert.f95_version}`\n"
                f"├ Version du poste : `{alert.post_game_version}`\n"
                f"├ Version traduction : `{alert.post_trad_version}`\n"
                f"└ Lien : {alert.thread_url}\n"
            )
        
        await channel.send("\n".join(msg_parts))
        await asyncio.sleep(1.0)


async def run_api_version_check():
    """
    🆕 CONTRÔLE VIA API F95 (checker.php) - PLUS FIABLE QUE LE RSS
    
    1. Récupère les threads Discord
    2. Extrait les IDs F95 depuis les Game_link
    3. Appelle l'API checker.php avec tous les IDs groupés
    4. Compare avec les versions des posts Discord
    5. Envoie les alertes groupées
    """
    print(f"🐝 [FRELON] ================================================")
    print(f"🐝 [FRELON] Démarrage du contrôle de version F95 via API")
    print(f"🐝 [FRELON] ================================================")
    
    channel_warn = bot.get_channel(WARNING_MAJ_CHANNEL_ID)
    if not channel_warn:
        print(f"🐝 [FRELON] ❌ Canal avertissements introuvable (ID: {WARNING_MAJ_CHANNEL_ID})")
        return
    
    print(f"🐝 [FRELON] ✅ Canal d'avertissements trouvé: {channel_warn.name}")
    
    _clean_old_notifications()
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json,*/*",
    }
    
    all_alerts = []
    http_error = None
    
    try:
        async with aiohttp.ClientSession(headers=headers) as session:
            # 📊 PHASE 1: Collecter tous les threads Discord et leurs IDs F95
            thread_mapping = {}  # {thread_id_f95: (thread_discord, post_version, trad_version, forum_type)}
            
            forum_configs = []
            if FORUM_AUTO_ID:
                forum_configs.append((FORUM_AUTO_ID, "Auto"))
                print(f"🐝 [FRELON] Forum Auto configuré: {FORUM_AUTO_ID}")
            if FORUM_SEMI_AUTO_ID:
                forum_configs.append((FORUM_SEMI_AUTO_ID, "Semi-Auto"))
                print(f"🐝 [FRELON] Forum Semi-Auto configuré: {FORUM_SEMI_AUTO_ID}")
            
            print(f"🐝 [FRELON] Nombre de forums à scanner: {len(forum_configs)}")
            
            for forum_id, forum_type in forum_configs:
                print(f"🐝 [FRELON] ----------------------------------------")
                print(f"🐝 [FRELON] Scan du forum [{forum_type}] (ID: {forum_id})")
                forum = bot.get_channel(forum_id)
                if not forum:
                    print(f"🐝 [FRELON] ⚠️ Forum [{forum_type}] introuvable")
                    continue
                
                print(f"🐝 [FRELON] ✅ Forum trouvé: {forum.name}")
                threads = await _collect_all_forum_threads(forum)
                print(f"🐝 [FRELON] 🔎 [{forum_type}] {len(threads)} threads récupérés")
                
                for idx, thread in enumerate(threads, 1):
                    await asyncio.sleep(0.2)  # Anti-spam Discord
                    
                    print(f"🐝 [FRELON]    Thread {idx}/{len(threads)}: {thread.name[:50]}")
                    
                    # Récupérer le premier message
                    msg = thread.starter_message
                    if not msg:
                        print(f"🐝 [FRELON]       Pas de starter_message, tentative fetch...")
                        try:
                            msg = await thread.fetch_message(thread.id)
                            print(f"🐝 [FRELON]       ✅ Message récupéré via fetch")
                        except Exception as e:
                            print(f"🐝 [FRELON]       ❌ Impossible de récupérer le message: {e}")
                            continue
                    
                    if not msg:
                        print(f"🐝 [FRELON]       ⚠️ Aucun message disponible, skip")
                        continue
                    
                    # Extraire les infos
                    content = msg.content or ""
                    f95_url, post_game_version, post_trad_version = _extract_link_and_versions(content)
                    
                    if not f95_url or not post_game_version:
                        print(f"🐝 [FRELON]       ⚠️ Données manquantes (url={bool(f95_url)}, version={bool(post_game_version)}), skip")
                        continue
                    
                    # Extraire l'ID F95 depuis l'URL
                    f95_id = extract_f95_thread_id(f95_url)
                    if not f95_id:
                        print(f"🐝 [FRELON]       ⚠️ Impossible d'extraire l'ID F95 depuis: {f95_url}")
                        continue
                    
                    print(f"🐝 [FRELON]       ✅ Enregistré: F95 ID={f95_id}, version={post_game_version}, trad={post_trad_version or 'N/A'}")
                    thread_mapping[f95_id] = (thread, post_game_version, post_trad_version or "Non renseignée", forum_type)
            
            if not thread_mapping:
                print(f"🐝 [FRELON] ✅ Aucun thread avec lien F95 trouvé")
                return
            
            # 🚀 PHASE 2: Récupérer les versions F95 via l'API (1 seule requête groupée !)
            f95_ids = list(thread_mapping.keys())
            print(f"🐝 [FRELON] ========================================")
            print(f"🐝 [FRELON] PHASE 2: Récupération API F95")
            print(f"🐝 [FRELON] Nombre d'IDs à vérifier: {len(f95_ids)}")
            print(f"🐝 [FRELON] ========================================")
            
            try:
                f95_versions = await fetch_f95_versions_by_ids(session, f95_ids)
                print(f"🐝 [FRELON] ✅ Versions récupérées: {len(f95_versions)}")
            except Exception as e:
                http_error = str(e)
                f95_versions = {}
                print(f"🐝 [FRELON] ❌ Erreur lors de la récupération: {http_error}")
            
            if http_error:
                await channel_warn.send(
                    f"⚠️ **Contrôle F95 impossible**\n"
                    f"Erreur lors de la récupération de l'API F95 : `{http_error}`\n"
                    f"Nouvelle tentative dans 24h."
                )
                return
            
            if not f95_versions:
                print(f"🐝 [FRELON] ✅ Aucune version récupérée depuis l'API F95")
                return
            
            # 🎯 PHASE 3: Comparaison des versions
            print(f"🐝 [FRELON] ========================================")
            print(f"🐝 [FRELON] PHASE 3: Comparaison des versions")
            print(f"🐝 [FRELON] ========================================")
            
            for idx, (f95_id, api_version) in enumerate(f95_versions.items(), 1):
                if f95_id not in thread_mapping:
                    print(f"🐝 [FRELON] [{idx}/{len(f95_versions)}] Thread F95 {f95_id} non trouvé dans mapping, skip")
                    continue
                
                thread, post_version, trad_version, forum_type = thread_mapping[f95_id]
                
                # Normaliser les versions pour comparaison
                api_version_clean = api_version.strip()
                post_version_clean = post_version.strip()
                
                print(f"🐝 [FRELON] [{idx}/{len(f95_versions)}] {thread.name[:40]}")
                print(f"🐝 [FRELON]    Version Discord: {post_version_clean}")
                print(f"🐝 [FRELON]    Version F95:     {api_version_clean}")
                
                # Vérifier si différent
                if api_version_clean != post_version_clean:
                    print(f"🐝 [FRELON]    🔔 DIFFÉRENCE DÉTECTÉE !")
                    # Anti-doublon
                    if not _is_already_notified(thread.id, api_version_clean):
                        print(f"🐝 [FRELON]    ✅ Nouvelle alerte enregistrée")
                        all_alerts.append(VersionAlert(
                            thread.name,
                            thread.jump_url,
                            api_version_clean,
                            post_version_clean,
                            trad_version,
                            forum_type
                        ))
                        _mark_as_notified(thread.id, api_version_clean)
                        print(f"🐝 [FRELON]    🔔 MAJ: {thread.name} ({post_version_clean} -> {api_version_clean})")
                    else:
                        print(f"🐝 [FRELON]    ⏭️  Déjà notifié, skip")
                else:
                    print(f"🐝 [FRELON]    ✅ Versions identiques, pas d'alerte")
        
        # 📢 ENVOI DES ALERTES (ou silence)
        print(f"🐝 [FRELON] ========================================")
        print(f"🐝 [FRELON] PHASE 4: Envoi des alertes")
        print(f"🐝 [FRELON] ========================================")
        
        if all_alerts:
            print(f"🐝 [FRELON] 📢 Envoi de {len(all_alerts)} alertes...")
            await send_grouped_alerts(channel_warn, all_alerts)
            print(f"🐝 [FRELON] ✅ {len(all_alerts)} alertes envoyées avec succès")
        else:
            print(f"🐝 [FRELON] ✅ Aucune MAJ détectée, silence total")
        
        print(f"🐝 [FRELON] ================================================")
        print(f"🐝 [FRELON] Contrôle de version F95 terminé avec succès")
        print(f"🐝 [FRELON] ================================================")
    
    except Exception as e:
        print(f"🐝 [FRELON] ❌❌❌ ERREUR GLOBALE ❌❌❌")
        print(f"🐝 [FRELON] Type: {type(e).__name__}")
        print(f"🐝 [FRELON] Message: {e}")
        import traceback
        print(f"🐝 [FRELON] Traceback:")
        traceback.print_exc()
        
        if channel_warn:
            await channel_warn.send(
                f"⚠️ **Erreur lors du contrôle F95**\n"
                f"Erreur technique : `{type(e).__name__}: {e}`\n"
                f"Nouvelle tentative dans 24h."
            )


async def run_rss_version_check():
    """
    ⚠️ OBSOLÈTE: Ancienne méthode RSS - Redirige vers la nouvelle API
    Gardé pour compatibilité avec les anciens appels
    """
    await run_api_version_check()


# ==================== TÂCHE QUOTIDIENNE ====================

@tasks.loop(time=datetime.time(hour=CHECK_TIME_HOUR, minute=CHECK_TIME_MINUTE, tzinfo=ZoneInfo("Europe/Paris")))
async def daily_version_check():
    """Contrôle quotidien à 6h Europe/Paris"""
    print(f"🐝 [FRELON] ⏰⏰⏰ CONTRÔLE QUOTIDIEN DÉCLENCHÉ ⏰⏰⏰")
    print(f"🐝 [FRELON] Heure configurée: {CHECK_TIME_HOUR:02d}:{CHECK_TIME_MINUTE:02d} Europe/Paris")
    
    if CHECK_LOCK.locked():
        print(f"🐝 [FRELON] ⏸️ Contrôle ignoré: déjà en cours")
        return
    
    async with CHECK_LOCK:
        try:
            await run_rss_version_check()
        except Exception as e:
            print(f"🐝 [FRELON] ❌ Erreur contrôle quotidien: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()


# ==================== COMMANDE MANUELLE ====================

def _user_can_run_checks(interaction: discord.Interaction) -> bool:
    if getattr(interaction.user, "id", None) == ALLOWED_USER_ID:
        return True
    perms = getattr(interaction.user, "guild_permissions", None)
    return bool(perms and (perms.administrator or perms.manage_guild))


@bot.tree.command(name="check_version", description="Vérifie les MAJ F95 via RSS (manuel)")
async def check_version(interaction: discord.Interaction):
    if not _user_can_run_checks(interaction):
        try:
            await interaction.response.send_message("⛔ Permission insuffisante.", ephemeral=True)
        except Exception:
            pass
        return
    
    if not _manual_check_allowed():
        try:
            await interaction.response.send_message(
                f"⏳ Attends {MANUAL_CHECK_COOLDOWN_SECONDS}s entre deux contrôles.",
                ephemeral=True
            )
        except Exception:
            pass
        return
    
    try:
        await interaction.response.defer(ephemeral=True)
    except Exception:
        pass
    
    if CHECK_LOCK.locked():
        await interaction.followup.send("⏳ Contrôle déjà en cours.", ephemeral=True)
        return
    
    async with CHECK_LOCK:
        await interaction.followup.send("⚡ Contrôle RSS en cours...", ephemeral=True)
        try:
            await run_rss_version_check()
            await interaction.followup.send("✅ Contrôle terminé.", ephemeral=True)
        except Exception as e:
            await interaction.followup.send(f"❌ Erreur: {e}", ephemeral=True)


# ==================== NOTIFICATION F95FR ====================

def a_tag_maj(thread) -> bool:
    for tag in thread.applied_tags:
        if "mise à jour" in tag.name.lower() or "maj" in tag.name.lower():
            return True
    return False


async def envoyer_notification_f95(thread, is_update: bool = False):
    channel_notif = bot.get_channel(NOTIFICATION_CHANNEL_F95_ID)
    if not channel_notif:
        return
    
    try:
        await asyncio.sleep(random.random() * 2)
        
        message = thread.starter_message
        if not message:
            await asyncio.sleep(1)
            message = await thread.fetch_message(thread.id)
        
        auteur = "Inconnu"
        if message and getattr(message, "author", None):
            auteur = message.author.display_name
        
        date_ref = message.edited_at if (message and message.edited_at) else thread.created_at
        date_publication = date_ref + datetime.timedelta(days=DAYS_BEFORE_PUBLICATION)
        timestamp_discord = int(date_publication.timestamp())
        
        action_txt = "a été mis à jour" if is_update else "a été créé"
        
        msg_content = (
            f"📢 **Rappel Publication F95fr**\n"
            f"Le thread **{thread.name}** {action_txt}.\n"
            f"**Traducteur :** {auteur}\n"
            f"📅 À publier le : <t:{timestamp_discord}:D> (<t:{timestamp_discord}:R>)\n"
            f"🔗 Lien : {thread.jump_url}"
        )
        
        await channel_notif.send(msg_content)
        print(f"✅ Notification F95fr: {thread.name}")
        
    except Exception as e:
        print(f"❌ Erreur notification: {e}")


# ==================== ÉVÉNEMENTS ====================

@bot.event
async def on_ready():
    print(f'🤖 Bot prêt: {bot.user}')
    
    # Sync commandes (une seule fois au démarrage)
    if not getattr(bot, "_synced", False):
        bot._synced = True
        await asyncio.sleep(2)
        try:
            await bot.tree.sync()
            print("✅ Commande /check_version synchronisée")
        except Exception as e:
            print(f"⚠️ Sync échoué: {e}")
    
    # Lancement tâche quotidienne
    if not daily_version_check.is_running():
        daily_version_check.start()
        print(f"✅ Contrôle quotidien: {CHECK_TIME_HOUR:02d}:{CHECK_TIME_MINUTE:02d} Paris")


@bot.event
async def on_thread_create(thread):
    print(f"🐝 [FRELON] 📝 Nouveau thread créé: {thread.name} (ID: {thread.id}, Parent: {thread.parent_id})")
    if thread.parent_id in [FORUM_SEMI_AUTO_ID, FORUM_AUTO_ID]:
        print(f"🐝 [FRELON] ✅ Thread dans un forum surveillé, envoi notification dans 5s...")
        await asyncio.sleep(5)
        thread_actuel = bot.get_channel(thread.id)
        if thread_actuel:
            is_maj = a_tag_maj(thread_actuel)
            print(f"🐝 [FRELON] Envoi notification F95 (is_update={is_maj})")
            await envoyer_notification_f95(thread_actuel, is_update=is_maj)
        else:
            print(f"🐝 [FRELON] ⚠️ Thread introuvable après fetch")
    else:
        print(f"🐝 [FRELON] Thread hors forums surveillés, ignoré")


@bot.event
async def on_thread_update(before, after):
    print(f"🐝 [FRELON] 🔄 Thread mis à jour: {after.name} (ID: {after.id})")
    if after.parent_id in [FORUM_SEMI_AUTO_ID, FORUM_AUTO_ID]:
        has_maj_before = a_tag_maj(before)
        has_maj_after = a_tag_maj(after)
        print(f"🐝 [FRELON] Tag MAJ: avant={has_maj_before}, après={has_maj_after}")
        if has_maj_after and not has_maj_before:
            print(f"🐝 [FRELON] ✅ Tag MAJ ajouté, envoi notification F95...")
            await envoyer_notification_f95(after, is_update=True)
        else:
            print(f"🐝 [FRELON] Pas de changement de tag MAJ pertinent")
    else:
        print(f"🐝 [FRELON] Thread hors forums surveillés, ignoré")


@bot.event
async def on_message_edit(before, after):
    if not isinstance(after.channel, discord.Thread):
        return
    
    if after.id == after.channel.id:  # Message de démarrage du thread
        print(f"🐝 [FRELON] ✏️ Message de thread édité: {after.channel.name} (ID: {after.id})")
        if before.content != after.content:
            print(f"🐝 [FRELON] Contenu modifié")
            if after.channel.parent_id in [FORUM_SEMI_AUTO_ID, FORUM_AUTO_ID]:
                if a_tag_maj(after.channel):
                    print(f"🐝 [FRELON] ✅ Thread avec tag MAJ, envoi notification F95...")
                    await envoyer_notification_f95(after.channel, is_update=True)
                else:
                    print(f"🐝 [FRELON] Pas de tag MAJ, pas de notification")
            else:
                print(f"🐝 [FRELON] Thread hors forums surveillés, ignoré")
        else:
            print(f"🐝 [FRELON] Contenu identique, aucune action")


# ==================== LANCEMENT ====================

if __name__ == "__main__":
    bot.run(TOKEN)
