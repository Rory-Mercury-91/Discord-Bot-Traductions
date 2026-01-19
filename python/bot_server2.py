"""
Bot Discord - Serveur 2 : Rappels F95fr
Gère les notifications de rappel pour les publications F95fr
"""
import discord
from discord.ext import commands
from discord import app_commands
import os
import asyncio
import datetime
import random
import re
import aiohttp
from zoneinfo import ZoneInfo
from dotenv import load_dotenv

load_dotenv()

# --- CONFIGURATION SERVEUR 2 CONSERVÉE ---
TOKEN = os.getenv('DISCORD_TOKEN_F95')
FORUM_SEMI_AUTO_ID = int(os.getenv('FORUM_SEMI_AUTO_ID')) if os.getenv('FORUM_SEMI_AUTO_ID') else None
FORUM_AUTO_ID = int(os.getenv('FORUM_AUTO_ID')) if os.getenv('FORUM_AUTO_ID') else None
NOTIFICATION_CHANNEL_F95_ID = int(os.getenv('NOTIFICATION_CHANNEL_F95_ID')) if os.getenv('NOTIFICATION_CHANNEL_F95_ID') else None
# ✅ Nouveau : salon des avertissements MAJ/version (par défaut celui que tu as donné)
WARNING_MAJ_CHANNEL_ID = int(os.getenv('WARNING_MAJ_CHANNEL_ID', '1436297589854310441'))
DAYS_BEFORE_PUBLICATION = int(os.getenv('DAYS_BEFORE_PUBLICATION', '14'))

# ✅ Horaire du check quotidien (Europe/Paris)
CHECK_TIME_HOUR = int(os.getenv('VERSION_CHECK_HOUR', '6'))
CHECK_TIME_MINUTE = int(os.getenv('VERSION_CHECK_MINUTE', '0'))

intents = discord.Intents.default()
intents.message_content = True
intents.guilds = True

bot = commands.Bot(command_prefix="!", intents=intents)

# --- LOGIQUE DE DÉTECTION ---

def a_tag_maj(thread):
    """Vérifie si le tag 'Mise à jour' ou 'MAJ' est présent"""
    for tag in thread.applied_tags:
        if "mise à jour" in tag.name.lower() or "maj" in tag.name.lower():
            return True
    return False

# --- LOGIQUE VERSION F95 ---

_RE_GAME_LINK = re.compile(r"^\s*Lien\s+du\s+jeu\s*:\s*\[(?P<label>[^\]]+)\]\((?P<url>https?://[^)]+)\)\s*$", re.IGNORECASE | re.MULTILINE)
_RE_GAME_VERSION = re.compile(r"^\s*Version\s+du\s+jeu\s*:\s*(?P<ver>.+?)\s*$", re.IGNORECASE | re.MULTILINE)
_RE_BRACKETS = re.compile(r"\[(?P<val>[^\]]+)\]")


def _extract_link_and_declared_version(text: str) -> tuple[str | None, str | None]:
    """Extrait (url_f95, version_thread) depuis le contenu du message."""
    if not text:
        return None, None
    m_link = _RE_GAME_LINK.search(text)
    m_ver = _RE_GAME_VERSION.search(text)
    url = m_link.group("url").strip() if m_link else None
    ver = m_ver.group("ver").strip() if m_ver else None
    return url, ver


def _extract_version_from_f95_title(title_text: str) -> str | None:
    """Récupère la 'version' depuis le titre F95, ex: 'Heated Hashtag [Ch.7] [Velvet-Ink]' -> 'Ch.7'."""
    if not title_text:
        return None
    parts = [m.group("val").strip() for m in _RE_BRACKETS.finditer(title_text)]
    # convention: la version est le 1er bloc entre crochets
    return parts[0] if parts else None


async def _fetch_f95_title(session: aiohttp.ClientSession, url: str) -> str | None:
    """Télécharge la page F95 et tente d'extraire le texte du H1 p-title-value."""
    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=25)) as resp:
            if resp.status >= 300:
                print(f"⚠️ F95 HTTP {resp.status} sur {url}")
                return None
            html = await resp.text(errors="ignore")
    except Exception as e:
        print(f"⚠️ Erreur fetch F95 {url}: {e}")
        return None

    # parsing léger sans dépendance: on cherche <h1 class="p-title-value"> ... </h1>
    m = re.search(r"<h1[^>]*class=\"p-title-value\"[^>]*>(.*?)</h1>", html, re.IGNORECASE | re.DOTALL)
    if not m:
        return None
    raw = m.group(1)
    # supprimer les tags HTML
    txt = re.sub(r"<[^>]+>", "", raw)
    txt = re.sub(r"\s+", " ", txt).strip()
    return txt or None


async def _already_notified(channel: discord.TextChannel, thread_url: str) -> bool:
    """Évite les doublons: si une notif contenant le lien du thread a déjà été envoyée, on skip."""
    try:
        async for msg in channel.history(limit=1000):
            if msg.content and thread_url in msg.content:
                return True
    except Exception as e:
        print(f"⚠️ Impossible de lire l'historique du salon avertissements: {e}")
    return False


async def _send_version_alert(channel: discord.TextChannel, *, f95_version: str | None, declared_version: str | None,
                              f95_url: str, thread_url: str, game_label: str | None = None) -> None:
    if f95_version:
        title = "🚨 **Nouvelle version détectée sur F95**"
        msg = (
            f"{title}\n"
            f"**Version F95 :** `{f95_version}`\n"
            f"**Thread annonce :** `{declared_version or 'Non renseignée'}`\n\n"
            f"🔗 **Lien F95 :** {f95_url}\n"
            f"🔗 **Thread Discord :** {thread_url}"
        )
    else:
        title = "⚠️ **Version non détectée sur F95**"
        msg = (
            f"{title}\n"
            f"Le titre F95 ne contient pas de version entre crochets (ex: `[Ch.7]`).\n\n"
            f"🔗 **Lien F95 :** {f95_url}\n"
            f"🔗 **Thread Discord :** {thread_url}"
        )
    await channel.send(content=msg)


async def check_versions_daily() -> None:
    """Boucle: exécute le contrôle 1 fois par jour à 06:00 Europe/Paris."""
    tz = ZoneInfo("Europe/Paris")
    await bot.wait_until_ready()

    while not bot.is_closed():
        now = datetime.datetime.now(tz)
        run_at = now.replace(hour=CHECK_TIME_HOUR, minute=CHECK_TIME_MINUTE, second=0, microsecond=0)
        if run_at <= now:
            run_at = run_at + datetime.timedelta(days=1)
        sleep_s = (run_at - now).total_seconds()
        print(f"🕕 Prochain check versions F95: {run_at.isoformat()} (dans {int(sleep_s)}s)")
        await asyncio.sleep(sleep_s)

        try:
            await run_version_check_once()
        except Exception as e:
            print(f"❌ Erreur run_version_check_once: {e}")


async def run_version_check_once() -> None:
    """Passe sur les threads et compare la version déclarée vs la version du titre F95."""
    channel_warn = bot.get_channel(WARNING_MAJ_CHANNEL_ID)
    if not channel_warn:
        print("❌ Salon avertissements MAJ/version introuvable")
        return

    forum_ids = [i for i in [FORUM_SEMI_AUTO_ID, FORUM_AUTO_ID] if i]
    if not forum_ids:
        print("⚠️ Aucun forum configuré pour le check version")
        return

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
    }

    async with aiohttp.ClientSession(headers=headers) as session:
        for forum_id in forum_ids:
            forum = bot.get_channel(forum_id)
            if not forum:
                print(f"⚠️ Forum {forum_id} introuvable")
                continue

            # Threads actifs
            threads = list(getattr(forum, "threads", []) or [])
            print(f"🔎 Check version F95: {len(threads)} threads actifs dans forum {forum_id}")

            for thread in threads:
                # petit jitter pour rester doux
                await asyncio.sleep(0.6 + random.random() * 0.6)

                # pas de doublon
                if await _already_notified(channel_warn, thread.jump_url):
                    continue

                # récupérer starter message
                msg = thread.starter_message
                if not msg:
                    try:
                        await asyncio.sleep(0.8)
                        msg = thread.starter_message or await thread.fetch_message(thread.id)
                    except Exception:
                        msg = None

                content = (msg.content if msg else "") or ""
                f95_url, declared_version = _extract_link_and_declared_version(content)
                if not f95_url or not declared_version:
                    # rien à comparer
                    continue

                title_text = await _fetch_f95_title(session, f95_url)
                f95_version = _extract_version_from_f95_title(title_text or "")

                if not f95_version:
                    await _send_version_alert(channel_warn, f95_version=None, declared_version=declared_version,
                                              f95_url=f95_url, thread_url=thread.jump_url)
                    continue

                # compare simple (strip)
                if f95_version.strip() != declared_version.strip():
                    await _send_version_alert(channel_warn, f95_version=f95_version, declared_version=declared_version,
                                              f95_url=f95_url, thread_url=thread.jump_url)
                else:
                    print(f"✅ Version OK: {thread.name} ({declared_version})")

# --- ENVOI DE NOTIFICATION (OPTIMISÉ ANTI-429) ---

async def envoyer_notification_f95(thread, is_update: bool = True):
    """Envoie un rappel pour la publication F95fr"""
    channel_notif = bot.get_channel(NOTIFICATION_CHANNEL_F95_ID)
    if not channel_notif:
        print("❌ Canal de notification F95 non trouvé")
        return

    try:
        # Ajout d'un petit jitter pour ne pas percuter l'autre bot
        await asyncio.sleep(random.random() * 3)

        # Utilisation du cache starter_message
        message = thread.starter_message
        if not message:
            await asyncio.sleep(1.5)
            message = thread.starter_message or await thread.fetch_message(thread.id)

        # ✅ Auteur du starter message (personne qui a posté le thread)
        auteur = "Inconnu"
        if message and getattr(message, "author", None):
            auteur = message.author.display_name
            
        # Calcul de la date (Ta logique originale)
        date_creation = thread.created_at
        date_publication = date_creation + datetime.timedelta(days=DAYS_BEFORE_PUBLICATION)
        timestamp_discord = int(date_publication.timestamp())

        action_txt = "a été mis à jour" if is_update else "a été créé"

        msg_content = (
            f"🔔 **Rappel Publication F95fr**\n"
            f"Le thread **{thread.name}** {action_txt}.\n"
            f"**Traducteur :** {auteur}\n"
            f"📅 À publier le : <t:{timestamp_discord}:D> (<t:{timestamp_discord}:R>)\n"
            f"🔗 Lien : {thread.jump_url}"
        )

        await channel_notif.send(content=msg_content)
        print(f"✅ Notification F95 envoyée pour : {thread.name}")
        
    except Exception as e:
        print(f"❌ Erreur notification F95 : {e}")

# --- ÉVÉNEMENTS ---

@bot.tree.command(name="check_version", description="Force un contrôle des versions F95 maintenant")
async def check_version(interaction: discord.Interaction):
    """Commande slash: lance immédiatement le contrôle des versions (anti-doublons conservé)."""
    # Permission simple: admin ou gérer le serveur
    perms = getattr(interaction.user, "guild_permissions", None)
    if not perms or not (perms.administrator or perms.manage_guild):
        await interaction.response.send_message("⛔ Permission insuffisante.", ephemeral=True)
        return

    await interaction.response.send_message("⏳ Contrôle des versions F95 en cours…", ephemeral=True)
    try:
        await run_version_check_once()
        await interaction.followup.send("✅ Contrôle terminé.", ephemeral=True)
    except Exception as e:
        await interaction.followup.send(f"❌ Erreur pendant le contrôle: {e}", ephemeral=True)

@bot.event
async def on_ready():
    print(f'🤖 Bot Serveur 2 prêt : {bot.user}')
    # ✅ Sync des commandes slash
    try:
        await bot.tree.sync()
        print("✅ Commandes slash synchronisées")
    except Exception as e:
        print(f"⚠️ Sync commandes slash échouée: {e}")
    # ✅ Lance le check quotidien (06:00 Europe/Paris)
    if not getattr(bot, "_version_check_task", None):
        bot._version_check_task = bot.loop.create_task(check_versions_daily())
@bot.event
async def on_thread_create(thread):
    # On attend un peu que les tags soient bien appliqués par l'utilisateur/système
    if thread.parent_id in [FORUM_SEMI_AUTO_ID, FORUM_AUTO_ID]:
        await asyncio.sleep(5 + random.random() * 2)
        thread_actuel = bot.get_channel(thread.id)
        if thread_actuel:
            # ✅ Envoi toujours le rappel, MAJ ou non
            await envoyer_notification_f95(thread_actuel, is_update=a_tag_maj(thread_actuel))

@bot.event
async def on_thread_update(before, after):
    if after.parent_id in [FORUM_SEMI_AUTO_ID, FORUM_AUTO_ID]:
        # Si le tag MAJ vient d'être ajouté
        if a_tag_maj(after) and not a_tag_maj(before):
            print(f"✅ Tag MAJ détecté sur : {after.name}")
            await envoyer_notification_f95(after, is_update=True)

@bot.event
async def on_message_edit(before, after):
    """Détecte les modifs sur le premier message du thread"""
    if not isinstance(after.channel, discord.Thread):
        return
    
    if after.id == after.channel.id: # C'est le message de départ
        if before.content != after.content:
            if after.channel.parent_id in [FORUM_SEMI_AUTO_ID, FORUM_AUTO_ID]:
                if a_tag_maj(after.channel):
                    await envoyer_notification_f95(after.channel, is_update=True)

if __name__ == "__main__":
    # On force l'URL officielle ici pour ignorer le proxy
    from discord.http import Route
    Route.BASE = "https://discord.com/api"
    bot.run(TOKEN)