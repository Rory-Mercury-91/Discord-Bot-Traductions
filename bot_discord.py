import discord
from discord.ext import commands
import re
import os
from dotenv import load_dotenv

# Charger les variables d'environnement depuis le fichier .env
load_dotenv()

# --- CONFIGURATION ---
TOKEN = os.getenv('DISCORD_TOKEN')
FORUM_CHANNEL_ID = int(os.getenv('FORUM_CHANNEL_ID'))
ANNOUNCE_CHANNEL_ID = int(os.getenv('ANNOUNCE_CHANNEL_ID'))

# Permissions
intents = discord.Intents.default()
intents.message_content = True
intents.guilds = True

bot = commands.Bot(command_prefix="!", intents=intents)

# --- OUTILS ---

def trier_tags(tags):
    """ Récupère les tags de traduction avec leurs EMOJIS """
    trads_formatted = []
    for tag in tags:
        name = tag.name
        # Ignore les versions (v + chiffre)
        if name.lower().startswith('v') and any(char.isdigit() for char in name):
            continue
        
        # Ajout de l'emoji si présent
        emoji_visuel = (str(tag.emoji) + " ") if tag.emoji else ""
        trads_formatted.append(f"{emoji_visuel}{name}")
    
    return sorted(trads_formatted)

async def nettoyer_doublons_et_verifier_historique(channel, thread_id):
    """
    1. Cherche si ce jeu a déjà été annoncé (pour savoir si c'est une MAJ).
    2. Supprime le message précédent s'il est tout récent (Anti-spam modifications rapides).
    Retourne : True si le jeu a déjà été annoncé dans le passé, False sinon.
    """
    deja_publie = False
    
    # On scanne les 50 derniers messages du salon annonce
    messages = [msg async for msg in channel.history(limit=50)]
    
    if not messages:
        return False

    # Vérification Anti-Spam (Le tout dernier message concerne-t-il ce jeu ?)
    dernier_msg = messages[0]
    if dernier_msg.author == bot.user and str(thread_id) in dernier_msg.content:
        # Oui, c'est le même jeu, on supprime pour remplacer par la nouvelle version
        await dernier_msg.delete()
        deja_publie = True # On considère que c'est une mise à jour
    
    # Si on n'a pas trouvé dans le dernier message, on cherche dans l'historique plus vieux
    if not deja_publie:
        for msg in messages:
            if msg.author == bot.user and str(thread_id) in msg.content:
                deja_publie = True
                break
    
    return deja_publie

async def envoyer_annonce(thread, liste_tags_trads):
    # 1. Vérif canal
    channel_annonce = bot.get_channel(ANNOUNCE_CHANNEL_ID)
    if not channel_annonce: return

    # 2. On détermine si c'est une UPDATE ou un NOUVEAU JEU en regardant l'historique
    is_update = await nettoyer_doublons_et_verifier_historique(channel_annonce, thread.id)

    # 3. Lire le contenu
    try:
        message = await thread.fetch_message(thread.id)
        contenu = message.content
    except discord.NotFound:
        return

    # 4. Regex Version
    match = re.search(r"Version du Patch\s*:\*\*\s*[`']?([^`\n\r]+)[`']?", contenu)
    version_txt = match.group(1).strip() if match else "Non spécifiée"

    # 5. Texte des tags
    etat_txt = ", ".join(liste_tags_trads)

    # 6. Image
    image_url = None
    if message.attachments:
        for attachment in message.attachments:
            if attachment.content_type and attachment.content_type.startswith('image'):
                image_url = attachment.url
                break
    if not image_url and message.embeds:
        for emb in message.embeds:
            if emb.image:
                image_url = emb.image.url
                break
            elif emb.thumbnail:
                image_url = emb.thumbnail.url
                break

    # 7. Choix du titre
    prefixe = "🔄 MISE À JOUR DE" if is_update else "🚀 NOUVEAU JEU AJOUTÉ"
    
    msg_content = (
        f"## {prefixe} : [{thread.name}]({thread.jump_url})\n\n"
        f"> **Version actuelle :** `{version_txt}`\n"
        f"> **Etat de la traduction :** {etat_txt}"
    )

    # 8. Envoi
    if image_url:
        embed = discord.Embed(color=discord.Color.blue())
        embed.set_image(url=image_url)
        await channel_annonce.send(content=msg_content, embed=embed)
    else:
        await channel_annonce.send(content=msg_content)
        
    print(f"Annonce envoyée ({prefixe}) : {thread.name}")


# --- ÉVÉNEMENTS ---

@bot.event
async def on_ready():
    print(f'Bot prêt : {bot.user}')

@bot.event
async def on_thread_create(thread):
    if thread.parent_id != FORUM_CHANNEL_ID: return
    await discord.utils.sleep_until(discord.utils.utcnow()) 
    
    trads = trier_tags(thread.applied_tags)
    if len(trads) > 0:
        await envoyer_annonce(thread, trads)

@bot.event
async def on_thread_update(before, after):
    if after.parent_id != FORUM_CHANNEL_ID: return

    trads_after = trier_tags(after.applied_tags)
    trads_before = trier_tags(before.applied_tags)

    # Si aucun tag de traduction actuellement, on ne fait rien (on attend que vous en mettiez un)
    if len(trads_after) == 0:
        return

    # On déclenche SEULEMENT si les tags ont changé
    # OU si c'est la première fois qu'on met des tags (0 avant -> X après)
    if trads_before != trads_after:
        await envoyer_annonce(after, trads_after)

bot.run(TOKEN)
