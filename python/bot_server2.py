"""
Bot Discord - Serveur 2 : Rappels F95fr + Contrôle versions
Gère les notifications de rappel pour les publications F95fr
+ Contrôle automatique des versions F95 avec alertes groupées
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
from collections import defaultdict
from typing import Optional, Tuple, Dict, List

load_dotenv()

# ==================== CONFIGURATION ====================
TOKEN = os.getenv('DISCORD_TOKEN_F95')
FORUM_SEMI_AUTO_ID = int(os.getenv('FORUM_SEMI_AUTO_ID')) if os.getenv('FORUM_SEMI_AUTO_ID') else None
FORUM_AUTO_ID = int(os.getenv('FORUM_AUTO_ID')) if os.getenv('FORUM_AUTO_ID') else None
NOTIFICATION_CHANNEL_F95_ID = int(os.getenv('NOTIFICATION_CHANNEL_F95_ID')) if os.getenv('NOTIFICATION_CHANNEL_F95_ID') else None
WARNING_MAJ_CHANNEL_ID = int(os.getenv('WARNING_MAJ_CHANNEL_ID', '1436297589854310441'))
DAYS_BEFORE_PUBLICATION = int(os.getenv('DAYS_BEFORE_PUBLICATION', '14'))
CHECK_TIME_HOUR = int(os.getenv('VERSION_CHECK_HOUR', '6'))
CHECK_TIME_MINUTE = int(os.getenv('VERSION_CHECK_MINUTE', '0'))

intents = discord.Intents.default()
intents.message_content = True
intents.guilds = True

bot = commands.Bot(command_prefix="!", intents=intents)

# ==================== ANTI-RATE LIMIT / CONCURRENCY ====================
CHECK_LOCK = asyncio.Lock()
_LAST_MANUAL_CHECK_AT: Optional[datetime.datetime] = None
MANUAL_CHECK_COOLDOWN_SECONDS = int(os.getenv("MANUAL_CHECK_COOLDOWN_SECONDS", "90"))

_LAST_SYNC_AT: Dict[int, datetime.datetime] = {}
SYNC_COOLDOWN_SECONDS = int(os.getenv("SYNC_COOLDOWN_SECONDS", "300"))

async def _sleep_for_rate_limit(e: Exception, default_seconds: float = 10.0):
    """Attend en cas de 429. Tente de lire retry_after si dispo."""
    retry_after = None
    try:
        data = getattr(e, "text", None)
        if isinstance(data, dict) and "retry_after" in data:
            retry_after = float(data["retry_after"])
    except Exception:
        retry_after = None
    await asyncio.sleep(retry_after if retry_after and retry_after > 0 else default_seconds)

async def _safe_channel_send(channel: discord.abc.Messageable, content: str, **kwargs):
    """Send Discord avec retry léger sur 429."""
    for attempt in range(3):
        try:
            return await channel.send(content=content, **kwargs)
        except discord.errors.HTTPException as e:
            if getattr(e, "status", None) == 429:
                await _sleep_for_rate_limit(e, default_seconds=5.0 * (attempt + 1))
                continue
            raise
    return None

async def _safe_followup_send(interaction: discord.Interaction, content: str, **kwargs):
    """Followup send avec retry léger sur 429."""
    for attempt in range(3):
        try:
            return await interaction.followup.send(content, **kwargs)
        except discord.errors.HTTPException as e:
            if getattr(e, "status", None) == 429:
                await _sleep_for_rate_limit(e, default_seconds=5.0 * (attempt + 1))
                continue
            raise
    return None

def _manual_check_allowed() -> bool:
    global _LAST_MANUAL_CHECK_AT
    now = datetime.datetime.now()
    if _LAST_MANUAL_CHECK_AT is None:
        _LAST_MANUAL_CHECK_AT = now
        return True
    delta = (now - _LAST_MANUAL_CHECK_AT).total_seconds()
    if delta < MANUAL_CHECK_COOLDOWN_SECONDS:
        return False
    _LAST_MANUAL_CHECK_AT = now
    return True

async def _safe_tree_sync(*, guild: Optional[discord.abc.Snowflake] = None):
    """Sync des commandes avec retry sur 429."""
    for attempt in range(3):
        try:
            if guild is None:
                return await bot.tree.sync()
            return await bot.tree.sync(guild=guild)
        except discord.errors.HTTPException as e:
            if getattr(e, "status", None) == 429:
                await _sleep_for_rate_limit(e, default_seconds=8.0 * (attempt + 1))
                continue
            raise
    return None

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
_RE_BRACKETS = re.compile(r"\[(?P<val>[^\]]+)\]")

# ==================== STOCKAGE ANTI-DOUBLON ====================
_notified_versions: Dict[int, Dict] = {}

def _clean_old_notifications():
    """Nettoie les entrées de plus de 30 jours"""
    cutoff = datetime.datetime.now() - datetime.timedelta(days=30)
    to_remove = [
        tid for tid, data in _notified_versions.items()
        if data.get("timestamp", datetime.datetime.min) < cutoff
    ]
    for tid in to_remove:
        del _notified_versions[tid]

def _is_already_notified(thread_id: int, f95_version: str) -> bool:
    """Vérifie si cette version a déjà été notifiée pour ce thread"""
    if thread_id not in _notified_versions:
        return False
    return _notified_versions[thread_id].get("f95_version") == f95_version

def _mark_as_notified(thread_id: int, f95_version: str):
    """Marque cette version comme notifiée"""
    _notified_versions[thread_id] = {
        "f95_version": f95_version,
        "timestamp": datetime.datetime.now()
    }

# ==================== DÉTECTION TAG MAJ ====================
def a_tag_maj(thread) -> bool:
    """Vérifie si le tag 'Mise à jour' ou 'MAJ' est présent"""
    for tag in thread.applied_tags:
        if "mise à jour" in tag.name.lower() or "maj" in tag.name.lower():
            return True
    return False

# ==================== EXTRACTION VERSION ====================
def _extract_link_and_versions(text: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """Extrait (url_f95, version_jeu, version_traduction) depuis le contenu du message."""
    if not text:
        return None, None, None
    
    m_link = _RE_GAME_LINK.search(text)
    m_game_ver = _RE_GAME_VERSION.search(text)
    m_trad_ver = _RE_TRANSLATION_VERSION.search(text)
    
    url = m_link.group("url").strip() if m_link else None
    game_ver = m_game_ver.group("ver").strip() if m_game_ver else None
    trad_ver = m_trad_ver.group("ver").strip() if m_trad_ver else None
    
    return url, game_ver, trad_ver

def _extract_version_from_f95_title(title_text: str) -> Optional[str]:
    """Récupère la version depuis le titre F95, ex: 'Game [Ch.7] [Author]' -> 'Ch.7'"""
    if not title_text:
        return None
    
    parts = [m.group("val").strip() for m in _RE_BRACKETS.finditer(title_text)]
    return parts[0] if parts else None

async def _fetch_f95_title(session: aiohttp.ClientSession, url: str) -> Optional[str]:
    """Télécharge la page F95 et extrait le titre H1"""
    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=25)) as resp:
            if resp.status >= 300:
                print(f"⚠️ F95 HTTP {resp.status} sur {url}")
                return None
            html = await resp.text(errors="ignore")
    except Exception as e:
        print(f"⚠️ Erreur fetch F95 {url}: {e}")
        return None

    m = re.search(r"<h1[^>]*class=\"p-title-value\"[^>]*>(.*?)</h1>", html, re.IGNORECASE | re.DOTALL)
    if not m:
        return None
    
    raw = m.group(1)
    txt = re.sub(r"<[^>]+>", "", raw)
    txt = re.sub(r"\s+", " ", txt).strip()
    
    return txt or None

# ==================== CONTRÔLE VERSIONS ====================
class VersionAlert:
    """Représente une alerte de version"""
    def __init__(self, thread_name: str, thread_url: str, f95_version: Optional[str], 
                 post_game_version: Optional[str], post_trad_version: Optional[str], 
                 forum_type: str):
        self.thread_name = thread_name
        self.thread_url = thread_url
        self.f95_version = f95_version
        self.post_game_version = post_game_version
        self.post_trad_version = post_trad_version
        self.forum_type = forum_type

async def _group_and_send_alerts(channel: discord.TextChannel, alerts: List[VersionAlert]):
    """Regroupe et envoie les alertes par catégorie (max 5 par message)"""
    if not alerts:
        return
    
    groups = {
        "Auto_diff": [],
        "Auto_missing": [],
        "SemiAuto_diff": [],
        "SemiAuto_missing": []
    }
    
    for alert in alerts:
        prefix = "Auto" if alert.forum_type == "Auto" else "SemiAuto"
        suffix = "diff" if alert.f95_version else "missing"
        key = f"{prefix}_{suffix}"
        groups[key].append(alert)
    
    for key, alert_list in groups.items():
        if not alert_list:
            continue
        
        if "Auto" in key:
            forum_name = "Mes traductions"
        else:
            forum_name = "Traductions communautaires"
        
        if "diff" in key:
            title = f"🚨 **Mises à jour détectées : {forum_name}** ({len(alert_list)} jeux)"
        else:
            title = f"⚠️ **Version indisponible sur F95 : {forum_name}** ({len(alert_list)} jeux)"
        
        for i in range(0, len(alert_list), 5):
            batch = alert_list[i:i+5]
            
            msg_parts = [title, ""]
            for alert in batch:
                if alert.f95_version:
                    msg_parts.append(
                        f"**{alert.thread_name}**\n"
                        f"├ Version F95 : `{alert.f95_version}`\n"
                        f"├ Version du poste : `{alert.post_game_version or 'Non renseignée'}`\n"
                        f"├ Version traduction : `{alert.post_trad_version or 'Non renseignée'}`\n"
                        f"└ Lien : {alert.thread_url}\n"
                    )
                else:
                    msg_parts.append(
                        f"**{alert.thread_name}**\n"
                        f"├ Version du poste : `{alert.post_game_version or 'Non renseignée'}`\n"
                        f"├ Version traduction : `{alert.post_trad_version or 'Non renseignée'}`\n"
                        f"└ Lien : {alert.thread_url}\n"
                    )
            
            await _safe_channel_send(channel, "\n".join(msg_parts))
            await asyncio.sleep(1.5)


async def _collect_all_forum_threads(forum: discord.ForumChannel) -> List[discord.Thread]:
    """Retourne TOUS les threads d'un forum : actifs + archivés"""
    all_threads: Dict[int, discord.Thread] = {}

    for t in list(getattr(forum, "threads", []) or []):
        all_threads[t.id] = t

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
            await asyncio.sleep(0.8)

            if before is None:
                break

    return list(all_threads.values())


async def run_version_check_once(forum_filter: Optional[str] = None):
    """Effectue le contrôle des versions F95"""
    channel_warn = bot.get_channel(WARNING_MAJ_CHANNEL_ID)
    if not channel_warn:
        print("❌ Salon avertissements MAJ/version introuvable")
        return
    
    forum_configs = []
    if forum_filter is None or forum_filter == "auto":
        if FORUM_AUTO_ID:
            forum_configs.append((FORUM_AUTO_ID, "Auto"))
    if forum_filter is None or forum_filter == "semiauto":
        if FORUM_SEMI_AUTO_ID:
            forum_configs.append((FORUM_SEMI_AUTO_ID, "Semi-Auto"))
    
    if not forum_configs:
        print("⚠️ Aucun forum configuré pour le check version")
        return
    
    _clean_old_notifications()
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
    }
    
    all_alerts = []
    
    async with aiohttp.ClientSession(headers=headers) as session:
        for forum_id, forum_type in forum_configs:
            forum = bot.get_channel(forum_id)
            if not forum:
                print(f"⚠️ Forum {forum_id} introuvable")
                continue
            
            threads = await _collect_all_forum_threads(forum)
            print(f"🔎 Check version F95 [{forum_type}]: {len(threads)} threads (actifs + archivés)")

            for thread in threads:
                await asyncio.sleep(0.6 + random.random() * 0.6)
                
                msg = thread.starter_message
                if not msg:
                    try:
                        await asyncio.sleep(0.8)
                        msg = thread.starter_message or await thread.fetch_message(thread.id)
                    except Exception:
                        msg = None
                
                content = (msg.content if msg else "") or ""
                f95_url, post_game_version, post_trad_version = _extract_link_and_versions(content)
                
                if not f95_url or not post_game_version:
                    continue
                
                title_text = await _fetch_f95_title(session, f95_url)
                f95_version = _extract_version_from_f95_title(title_text or "")
                
                if not f95_version:
                    if not _is_already_notified(thread.id, "NO_VERSION"):
                        all_alerts.append(VersionAlert(
                            thread.name, thread.jump_url, None, 
                            post_game_version, post_trad_version, forum_type
                        ))
                        _mark_as_notified(thread.id, "NO_VERSION")
                    continue
                
                if f95_version.strip() != post_game_version.strip():
                    if not _is_already_notified(thread.id, f95_version):
                        all_alerts.append(VersionAlert(
                            thread.name, thread.jump_url, f95_version,
                            post_game_version, post_trad_version, forum_type
                        ))
                        _mark_as_notified(thread.id, f95_version)
                else:
                    print(f"✅ Version OK [{forum_type}]: {thread.name} ({post_game_version})")
    
    await _group_and_send_alerts(channel_warn, all_alerts)
    print(f"📊 Contrôle terminé : {len(all_alerts)} alertes envoyées")

# ==================== TÂCHE QUOTIDIENNE ====================
@tasks.loop(time=datetime.time(hour=CHECK_TIME_HOUR, minute=CHECK_TIME_MINUTE, tzinfo=ZoneInfo("Europe/Paris")))
async def daily_version_check():
    """Contrôle quotidien à 06:00 Europe/Paris"""
    print(f"🕕 Démarrage contrôle quotidien des versions F95")

    if CHECK_LOCK.locked():
        print("⏭️ Contrôle quotidien ignoré: un contrôle est déjà en cours.")
        return

    async with CHECK_LOCK:
        try:
            await run_version_check_once()
        except Exception as e:
            print(f"❌ Erreur contrôle quotidien: {e}")

# ==================== ENVOI NOTIFICATION F95 ====================
async def envoyer_notification_f95(thread, is_update: bool = False):
    """Envoie un rappel pour la publication F95fr"""
    channel_notif = bot.get_channel(NOTIFICATION_CHANNEL_F95_ID)
    if not channel_notif:
        print("❌ Canal de notification F95 non trouvé")
        return
    
    try:
        await asyncio.sleep(random.random() * 3)
        
        message = thread.starter_message
        if not message:
            await asyncio.sleep(1.5)
            message = thread.starter_message or await thread.fetch_message(thread.id)
        
        auteur = "Inconnu"
        if message and getattr(message, "author", None):
            auteur = message.author.display_name
        
        date_ref = message.edited_at if (message and message.edited_at) else thread.created_at
        date_publication = date_ref + datetime.timedelta(days=DAYS_BEFORE_PUBLICATION)
        timestamp_discord = int(date_publication.timestamp())
        
        action_txt = "a été mis à jour" if is_update else "a été créé"
        
        msg_content = (
            f"🔔 **Rappel Publication F95fr**\n"
            f"Le thread **{thread.name}** {action_txt}.\n"
            f"**Traducteur :** {auteur}\n"
            f"📅 À publier le : <t:{timestamp_discord}:D> (<t:{timestamp_discord}:R>)\n"
            f"🔗 Lien : {thread.jump_url}"
        )
        
        await _safe_channel_send(channel_notif, msg_content)
        print(f"✅ Notification F95 envoyée pour : {thread.name}")
        
    except Exception as e:
        print(f"❌ Erreur notification F95 : {e}")

# ==================== COMMANDES SLASH ====================
ALLOWED_USER_ID = 394893413843206155

def _user_can_run_checks(interaction: discord.Interaction) -> bool:
    """Autorise admin/manage_guild OU un user ID spécifique."""
    if getattr(interaction.user, "id", None) == ALLOWED_USER_ID:
        return True
    perms = getattr(interaction.user, "guild_permissions", None)
    return bool(perms and (perms.administrator or perms.manage_guild))

@bot.tree.command(name="check_help", description="Affiche la liste des commandes et leur utilité")
async def check_help(interaction: discord.Interaction):
    try:
        await interaction.response.defer(ephemeral=True)
    except Exception:
        pass
    if not _user_can_run_checks(interaction):
        await _safe_followup_send(interaction, "⛔ Permission insuffisante.", ephemeral=True)
        return
    help_text = (
        "**🧰 Commandes disponibles (Bot Publication Traduction)**\n\n"
        "**/check_version** — Lance le contrôle complet des versions F95 (Auto + Semi-Auto).\n"
        "**/check_auto** — Lance le contrôle des versions F95 uniquement sur le forum Auto.\n"
        "**/check_semiauto** — Lance le contrôle des versions F95 uniquement sur le forum Semi-Auto.\n"
        "**/check_count** — Compte les threads du forum (actifs + archivés) pour vérifier que le bot \"voit tout\".\n"
        "**/force_sync** — Force la synchronisation des commandes slash (serveur).\n"
        "**/clean_ghost_commands** — Nettoie les commandes fantômes (serveur) et resynchronise.\n"
    )
    await _safe_followup_send(interaction, help_text, ephemeral=True)


@bot.tree.command(name="check_version", description="Contrôle les versions F95 (Auto + Semi-Auto)")
async def check_version(interaction: discord.Interaction):
    """Lance le contrôle complet immédiatement."""
    if not _user_can_run_checks(interaction):
        try:
            await interaction.response.send_message("⛔ Permission insuffisante.", ephemeral=True)
        except Exception:
            pass
        return

    if not _manual_check_allowed():
        try:
            await interaction.response.send_message(
                f"⏳ Merci d'attendre ~{MANUAL_CHECK_COOLDOWN_SECONDS}s entre deux contrôles manuels.",
                ephemeral=True
            )
        except Exception:
            pass
        return

    try:
        await interaction.response.defer(ephemeral=True, thinking=True)
    except discord.errors.HTTPException as e:
        if getattr(e, "status", None) == 429:
            return
        raise
    except Exception:
        pass

    if CHECK_LOCK.locked():
        await _safe_followup_send(interaction, "⏳ Un contrôle est déjà en cours. Réessaie plus tard.", ephemeral=True)
        return

    async with CHECK_LOCK:
        await _safe_followup_send(interaction, "⏳ Contrôle des versions F95 en cours…", ephemeral=True)
        try:
            await run_version_check_once()
            await _safe_followup_send(interaction, "✅ Contrôle terminé.", ephemeral=True)
        except Exception as e:
            await _safe_followup_send(interaction, f"❌ Erreur: {e}", ephemeral=True)


@bot.tree.command(name="check_auto", description="Contrôle uniquement les traductions Auto")
async def check_auto(interaction: discord.Interaction):
    """Lance le contrôle Auto uniquement."""
    if not _user_can_run_checks(interaction):
        try:
            await interaction.response.send_message("⛔ Permission insuffisante.", ephemeral=True)
        except Exception:
            pass
        return

    if not _manual_check_allowed():
        try:
            await interaction.response.send_message(
                f"⏳ Merci d'attendre ~{MANUAL_CHECK_COOLDOWN_SECONDS}s entre deux contrôles manuels.",
                ephemeral=True
            )
        except Exception:
            pass
        return

    try:
        await interaction.response.defer(ephemeral=True, thinking=True)
    except discord.errors.HTTPException as e:
        if getattr(e, "status", None) == 429:
            return
        raise
    except Exception:
        pass

    if CHECK_LOCK.locked():
        await _safe_followup_send(interaction, "⏳ Un contrôle est déjà en cours. Réessaie plus tard.", ephemeral=True)
        return

    async with CHECK_LOCK:
        await _safe_followup_send(interaction, "⏳ Contrôle Auto en cours…", ephemeral=True)
        try:
            await run_version_check_once(forum_filter="auto")
            await _safe_followup_send(interaction, "✅ Contrôle Auto terminé.", ephemeral=True)
        except Exception as e:
            await _safe_followup_send(interaction, f"❌ Erreur: {e}", ephemeral=True)


@bot.tree.command(name="check_semiauto", description="Contrôle uniquement les traductions Semi-Auto")
async def check_semiauto(interaction: discord.Interaction):
    """Lance le contrôle Semi-Auto uniquement."""
    if not _user_can_run_checks(interaction):
        try:
            await interaction.response.send_message("⛔ Permission insuffisante.", ephemeral=True)
        except Exception:
            pass
        return

    if not _manual_check_allowed():
        try:
            await interaction.response.send_message(
                f"⏳ Merci d'attendre ~{MANUAL_CHECK_COOLDOWN_SECONDS}s entre deux contrôles manuels.",
                ephemeral=True
            )
        except Exception:
            pass
        return

    try:
        await interaction.response.defer(ephemeral=True, thinking=True)
    except discord.errors.HTTPException as e:
        if getattr(e, "status", None) == 429:
            return
        raise
    except Exception:
        pass

    if CHECK_LOCK.locked():
        await _safe_followup_send(interaction, "⏳ Un contrôle est déjà en cours. Réessaie plus tard.", ephemeral=True)
        return

    async with CHECK_LOCK:
        await _safe_followup_send(interaction, "⏳ Contrôle Semi-Auto en cours…", ephemeral=True)
        try:
            await run_version_check_once(forum_filter="semiauto")
            await _safe_followup_send(interaction, "✅ Contrôle Semi-Auto terminé.", ephemeral=True)
        except Exception as e:
            await _safe_followup_send(interaction, f"❌ Erreur: {e}", ephemeral=True)


@bot.tree.command(name="force_sync", description="Force la synchronisation des commandes")
async def force_sync(interaction: discord.Interaction):
    """Force le sync des commandes (serveur). Autorisé pour admin/manage_guild OU ALLOWED_USER_ID."""
    try:
        await interaction.response.defer(ephemeral=True)
    except Exception:
        pass

    if not _user_can_run_checks(interaction):
        await _safe_followup_send(interaction, "⛔ Permission insuffisante.", ephemeral=True)
        return

    guild = interaction.guild
    if guild is None:
        await _safe_followup_send(interaction, "❌ Impossible: commande utilisable uniquement dans un serveur.", ephemeral=True)
        return

    # Cooldown sync par guild (évite spam et 429)
    now = datetime.datetime.now()
    last = _LAST_SYNC_AT.get(guild.id)
    if last and (now - last).total_seconds() < SYNC_COOLDOWN_SECONDS:
        await _safe_followup_send(
            interaction,
            f"⏳ Sync déjà fait récemment. Attends ~{SYNC_COOLDOWN_SECONDS}s avant de resynchroniser.",
            ephemeral=True
        )
        return
    _LAST_SYNC_AT[guild.id] = now

    try:
        bot.tree.copy_global_to(guild=guild)
        await _safe_tree_sync(guild=guild)
        await _safe_followup_send(interaction, "✅ Commandes synchronisées pour ce serveur !", ephemeral=True)
    except discord.errors.HTTPException as e:
        if getattr(e, "status", None) == 429:
            await _safe_followup_send(interaction, "⚠️ Rate limit Discord (429). Réessaie dans quelques minutes.", ephemeral=True)
            return
        await _safe_followup_send(interaction, f"❌ Erreur: {e}", ephemeral=True)
    except Exception as e:
        await _safe_followup_send(interaction, f"❌ Erreur: {e}", ephemeral=True)


@bot.tree.command(name="clean_ghost_commands", description="Nettoie les commandes fantômes (serveur) et resynchronise")
async def clean_ghost_commands(interaction: discord.Interaction):
    """Supprime les commandes de guild côté Discord, puis republie les commandes actuelles.
    Utile si tu vois des commandes fantômes / CommandNotFound.
    """
    try:
        await interaction.response.defer(ephemeral=True, thinking=True)
    except Exception:
        pass

    if not _user_can_run_checks(interaction):
        await _safe_followup_send(interaction, "⛔ Permission insuffisante.", ephemeral=True)
        return

    guild = interaction.guild
    if guild is None:
        await _safe_followup_send(interaction, "❌ Impossible: commande utilisable uniquement dans un serveur.", ephemeral=True)
        return

    # Petite protection anti-spam sync/clean
    now = datetime.datetime.now()
    last = _LAST_SYNC_AT.get(guild.id)
    if last and (now - last).total_seconds() < 30:
        await _safe_followup_send(interaction, "⏳ Attends quelques secondes avant de relancer un nettoyage.", ephemeral=True)
        return
    _LAST_SYNC_AT[guild.id] = now

    try:
        # 1) Supprime toutes les commandes guild enregistrées côté Discord
        bot.tree.clear_commands(guild=guild)
        await _safe_tree_sync(guild=guild)
        await asyncio.sleep(1.0)

        # 2) Republie l'état actuel des commandes (global -> guild)
        bot.tree.copy_global_to(guild=guild)
        await _safe_tree_sync(guild=guild)

        await _safe_followup_send(interaction, "🧹 Nettoyage terminé. Les commandes du serveur ont été régénérées.", ephemeral=True)
    except discord.errors.HTTPException as e:
        if getattr(e, "status", None) == 429:
            await _safe_followup_send(interaction, "⚠️ Rate limit Discord (429). Réessaie dans quelques minutes.", ephemeral=True)
            return
        await _safe_followup_send(interaction, f"❌ Erreur: {e}", ephemeral=True)
    except Exception as e:
        await _safe_followup_send(interaction, f"❌ Erreur: {e}", ephemeral=True)


@bot.tree.command(name="check_count", description="Compte les threads (actifs + archivés) dans les forums")
async def check_count(interaction: discord.Interaction):
    if not _user_can_run_checks(interaction):
        try:
            await interaction.response.send_message("⛔ Permission insuffisante.", ephemeral=True)
        except Exception:
            pass
        return

    try:
        await interaction.response.defer(ephemeral=True, thinking=True)
    except Exception:
        pass

    results = []
    for forum_id, forum_type in [
        (FORUM_SEMI_AUTO_ID, "Semi-Auto"),
        (FORUM_AUTO_ID, "Auto"),
    ]:
        if not forum_id:
            continue

        forum = bot.get_channel(forum_id)
        if not forum:
            results.append(f"⚠️ Forum {forum_type} introuvable")
            continue

        threads = await _collect_all_forum_threads(forum)
        results.append(f"📌 {forum_type}: {len(threads)} threads (actifs + archivés)")

    await _safe_followup_send(interaction, "\n".join(results), ephemeral=True)


# ==================== GESTION ERREURS COMMANDES (ANTI-BRUIT / ANTI-GHOST) ====================
@bot.tree.error
async def on_app_command_error(interaction: discord.Interaction, error: app_commands.AppCommandError):
    # Commandes fantômes / caches Discord : on ignore le bruit
    if isinstance(error, app_commands.CommandNotFound):
        return

    # Si Discord est en 429 global, on évite de spammer les logs
    underlying = getattr(error, "original", None)
    if isinstance(underlying, discord.errors.HTTPException) and getattr(underlying, "status", None) == 429:
        return

    # Laisse remonter les autres erreurs (pour debug)
    raise error

# Définir l'ID du propriétaire (celui qui peut utiliser ces commandes)
OWNER_IDS = {394893413843206155}

def owner_only():
    """Décorateur pour limiter les commandes aux propriétaires uniquement"""
    async def predicate(interaction: discord.Interaction) -> bool:
        return interaction.user and interaction.user.id in OWNER_IDS
    return app_commands.check(predicate)


@owner_only()
@bot.tree.command(name="reset_commands", description="[OWNER] Nettoie et resynchronise TOUTES les commandes (global + serveur)")
async def reset_commands(interaction: discord.Interaction):
    """
    Commande ultime de reset : nettoie tout et resynchronise
    - Supprime les commandes globales
    - Supprime les commandes du serveur
    - Resynchronise tout proprement
    """
    try:
        await interaction.response.defer(ephemeral=True)
    except Exception as e:
        print(f"⚠️ Erreur defer: {e}")
        return

    bot_name = bot.user.name if bot.user else "Bot"
    guild = interaction.guild
    
    try:
        # ÉTAPE 1: Nettoyage global
        print(f"🧹 [{bot_name}] Étape 1/4: Suppression commandes globales...")
        bot.tree.clear_commands(guild=None)
        await bot.tree.sync()
        await asyncio.sleep(2)
        
        # ÉTAPE 2: Nettoyage serveur (si dans un serveur)
        if guild:
            print(f"🧹 [{bot_name}] Étape 2/4: Suppression commandes serveur {guild.name}...")
            bot.tree.clear_commands(guild=guild)
            await bot.tree.sync(guild=guild)
            await asyncio.sleep(2)
        else:
            print(f"⏭️  [{bot_name}] Étape 2/4: Ignorée (pas dans un serveur)")
        
        # ÉTAPE 3: Resync global
        print(f"🔄 [{bot_name}] Étape 3/4: Synchronisation globale...")
        await bot.tree.sync()
        await asyncio.sleep(2)
        
        # ÉTAPE 4: Resync serveur (si dans un serveur)
        if guild:
            print(f"🔄 [{bot_name}] Étape 4/4: Synchronisation serveur {guild.name}...")
            bot.tree.copy_global_to(guild=guild)
            await bot.tree.sync(guild=guild)
        else:
            print(f"⏭️  [{bot_name}] Étape 4/4: Ignorée (pas dans un serveur)")
        
        # Message de succès
        success_msg = (
            f"✅ **Reset terminé pour {bot_name}**\n\n"
            f"**Actions effectuées:**\n"
            f"✓ Commandes globales nettoyées\n"
        )
        if guild:
            success_msg += f"✓ Commandes serveur '{guild.name}' nettoyées\n"
        success_msg += (
            f"✓ Resynchronisation globale\n"
        )
        if guild:
            success_msg += f"✓ Resynchronisation serveur '{guild.name}'\n"
        
        success_msg += f"\n**⏰ Délai total: ~8-10 secondes**\n"
        success_msg += f"**ℹ️ Les commandes peuvent mettre jusqu'à 1h pour apparaître partout.**"
        
        await interaction.followup.send(success_msg, ephemeral=True)
        print(f"✅ [{bot_name}] Reset complet terminé avec succès!")
        
    except discord.errors.HTTPException as e:
        error_msg = f"❌ Erreur Discord HTTP: {e}"
        print(f"❌ [{bot_name}] {error_msg}")
        await interaction.followup.send(error_msg, ephemeral=True)
    except Exception as e:
        error_msg = f"❌ Erreur inattendue: {type(e).__name__}: {e}"
        print(f"❌ [{bot_name}] {error_msg}")
        await interaction.followup.send(error_msg, ephemeral=True)


@owner_only()
@bot.tree.command(name="sync_commands", description="[OWNER] Synchronise les commandes sans nettoyer")
async def sync_commands(interaction: discord.Interaction):
    """
    Synchronise les commandes sans faire de nettoyage
    Utile pour mettre à jour après modification du code
    """
    try:
        await interaction.response.defer(ephemeral=True)
    except Exception as e:
        print(f"⚠️ Erreur defer: {e}")
        return

    bot_name = bot.user.name if bot.user else "Bot"
    guild = interaction.guild
    
    try:
        # Sync global
        print(f"🔄 [{bot_name}] Synchronisation globale...")
        await bot.tree.sync()
        await asyncio.sleep(1)
        
        # Sync serveur si applicable
        if guild:
            print(f"🔄 [{bot_name}] Synchronisation serveur {guild.name}...")
            bot.tree.copy_global_to(guild=guild)
            await bot.tree.sync(guild=guild)
        
        success_msg = f"✅ **Sync terminé pour {bot_name}**\n\n"
        success_msg += "✓ Commandes globales synchronisées\n"
        if guild:
            success_msg += f"✓ Commandes serveur '{guild.name}' synchronisées\n"
        success_msg += "\n**ℹ️ Les commandes peuvent mettre jusqu'à 1h pour apparaître partout.**"
        
        await interaction.followup.send(success_msg, ephemeral=True)
        print(f"✅ [{bot_name}] Sync terminé avec succès!")
        
    except discord.errors.HTTPException as e:
        error_msg = f"❌ Erreur Discord HTTP: {e}"
        print(f"❌ [{bot_name}] {error_msg}")
        await interaction.followup.send(error_msg, ephemeral=True)
    except Exception as e:
        error_msg = f"❌ Erreur inattendue: {type(e).__name__}: {e}"
        print(f"❌ [{bot_name}] {error_msg}")
        await interaction.followup.send(error_msg, ephemeral=True)


@owner_only()
@bot.tree.command(name="list_commands", description="[OWNER] Liste toutes les commandes enregistrées")
async def list_commands(interaction: discord.Interaction):
    """
    Affiche la liste des commandes actuellement enregistrées
    Utile pour diagnostiquer les problèmes
    """
    try:
        await interaction.response.defer(ephemeral=True)
    except Exception as e:
        print(f"⚠️ Erreur defer: {e}")
        return

    bot_name = bot.user.name if bot.user else "Bot"
    
    try:
        # Récupérer les commandes
        global_commands = await bot.tree.fetch_commands()
        
        msg = f"📋 **Commandes enregistrées pour {bot_name}**\n\n"
        msg += f"**Commandes globales ({len(global_commands)}):**\n"
        
        if global_commands:
            for cmd in global_commands:
                msg += f"• `/{cmd.name}` - {cmd.description}\n"
        else:
            msg += "*Aucune commande globale*\n"
        
        # Commandes serveur (si dans un serveur)
        if interaction.guild:
            guild_commands = await bot.tree.fetch_commands(guild=interaction.guild)
            msg += f"\n**Commandes serveur ({len(guild_commands)}):**\n"
            if guild_commands:
                for cmd in guild_commands:
                    msg += f"• `/{cmd.name}` - {cmd.description}\n"
            else:
                msg += "*Aucune commande serveur*\n"
        
        await interaction.followup.send(msg, ephemeral=True)
        
    except Exception as e:
        error_msg = f"❌ Erreur: {type(e).__name__}: {e}"
        print(f"❌ [{bot_name}] {error_msg}")
        await interaction.followup.send(error_msg, ephemeral=True)
# ==================== ÉVÉNEMENTS ====================

@bot.event
async def on_ready():
    print(f'🤖 Bot Serveur 2 prêt : {bot.user}')

    # Sync commandes slash (avec jitter + retry sur 429)
    # Tu peux désactiver l'auto-sync via DISABLE_AUTO_SYNC=1
    if not getattr(bot, "_did_initial_sync", False):
        bot._did_initial_sync = True
        if os.getenv("DISABLE_AUTO_SYNC", "0") != "1":
            await asyncio.sleep(2.0 + random.random() * 4.0)
            try:
                await _safe_tree_sync(guild=None)
                print("✅ Commandes slash synchronisées (/check_version, /check_auto, /check_semiauto)")
            except discord.errors.HTTPException as e:
                if getattr(e, "status", None) == 429:
                    print("⚠️ Sync commandes slash rate-limited (429). Ignoré au démarrage.")
                else:
                    print(f"⚠️ Sync commandes slash échouée: {e}")
            except Exception as e:
                print(f"⚠️ Sync commandes slash échouée: {e}")

    # Lancement tâche quotidienne
    if not daily_version_check.is_running():
        daily_version_check.start()
        print(f"✅ Contrôle quotidien programmé à {CHECK_TIME_HOUR:02d}:{CHECK_TIME_MINUTE:02d} Europe/Paris")

@bot.event
async def on_thread_create(thread):
    """Envoi rappel F95 lors de la création d'un thread"""
    if thread.parent_id in [FORUM_SEMI_AUTO_ID, FORUM_AUTO_ID]:
        await asyncio.sleep(5 + random.random() * 2)
        thread_actuel = bot.get_channel(thread.id)
        if thread_actuel:
            await envoyer_notification_f95(thread_actuel, is_update=a_tag_maj(thread_actuel))

@bot.event
async def on_thread_update(before, after):
    """Détecte l'ajout du tag MAJ"""
    if after.parent_id in [FORUM_SEMI_AUTO_ID, FORUM_AUTO_ID]:
        if a_tag_maj(after) and not a_tag_maj(before):
            print(f"✅ Tag MAJ détecté sur : {after.name}")
            await envoyer_notification_f95(after, is_update=True)

@bot.event
async def on_message_edit(before, after):
    """Détecte les modifications sur le premier message du thread"""
    if not isinstance(after.channel, discord.Thread):
        return
    
    # Vérifier que c'est bien le starter message
    if after.id == after.channel.id:
        if before.content != after.content:
            if after.channel.parent_id in [FORUM_SEMI_AUTO_ID, FORUM_AUTO_ID]:
                if a_tag_maj(after.channel):
                    await envoyer_notification_f95(after.channel, is_update=True)

# ==================== LANCEMENT ====================
if __name__ == "__main__":
    from discord.http import Route
    Route.BASE = "https://discord.com/api"
    bot.run(TOKEN)