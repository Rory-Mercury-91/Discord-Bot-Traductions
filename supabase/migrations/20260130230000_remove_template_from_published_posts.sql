-- Suppression des colonnes template et template_id de published_posts
-- Un seul template existe, pas besoin de clé pour le différencier
ALTER TABLE public.published_posts
  DROP COLUMN IF EXISTS template,
  DROP COLUMN IF EXISTS template_id;
