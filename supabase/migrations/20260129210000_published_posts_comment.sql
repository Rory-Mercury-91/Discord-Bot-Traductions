-- Cohérence table published_posts : source de vérité pour le bot server 1.
-- Le bot lit cette table par thread_id pour construire les annonces (moins d'appels Discord).
-- Schéma aligné avec l'app et le bot : id, title, content, tags, template, image_path,
-- translation_type, is_integrated, thread_id, message_id, discord_url, forum_id,
-- author_discord_id, saved_inputs, saved_link_configs, saved_additional_translation_links,
-- template_id, created_at, updated_at.

COMMENT ON TABLE public.published_posts IS 'Historique des publications ; source de vérité pour bot server 1 (annonces).';
