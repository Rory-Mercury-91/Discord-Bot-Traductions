-- Tables pour Discord Publisher : tags, config globale, historique des posts.
-- RLS : lecture/écriture autorisées avec la clé anon (contrôle fin côté app).

-- Tags sauvegardés (partagés, toujours à jour)
CREATE TABLE IF NOT EXISTS public.tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  template text,
  is_translator boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Config globale (ex: URL API Koyeb) — clé/valeur
CREATE TABLE IF NOT EXISTS public.app_config (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Historique global des publications
CREATE TABLE IF NOT EXISTS public.published_posts (
  id text PRIMARY KEY,
  title text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  tags text NOT NULL DEFAULT '',
  template text NOT NULL DEFAULT 'my',
  image_path text,
  translation_type text,
  is_integrated boolean DEFAULT false,
  thread_id text NOT NULL DEFAULT '',
  message_id text NOT NULL DEFAULT '',
  discord_url text NOT NULL DEFAULT '',
  forum_id bigint NOT NULL DEFAULT 0,
  author_discord_id text,
  saved_inputs jsonb,
  saved_link_configs jsonb,
  saved_additional_translation_links jsonb,
  template_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index pour trier l'historique par date
CREATE INDEX IF NOT EXISTS idx_published_posts_updated_at
  ON public.published_posts (updated_at DESC);

-- RLS : activer sur toutes les tables
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.published_posts ENABLE ROW LEVEL SECURITY;

-- Politiques : anon peut tout lire et écrire (sécurité gérée par l'app : code maître, etc.)
CREATE POLICY "tags_select" ON public.tags FOR SELECT TO anon USING (true);
CREATE POLICY "tags_insert" ON public.tags FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "tags_update" ON public.tags FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "tags_delete" ON public.tags FOR DELETE TO anon USING (true);

CREATE POLICY "app_config_select" ON public.app_config FOR SELECT TO anon USING (true);
CREATE POLICY "app_config_insert" ON public.app_config FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "app_config_update" ON public.app_config FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "app_config_delete" ON public.app_config FOR DELETE TO anon USING (true);

CREATE POLICY "published_posts_select" ON public.published_posts FOR SELECT TO anon USING (true);
CREATE POLICY "published_posts_insert" ON public.published_posts FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "published_posts_update" ON public.published_posts FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "published_posts_delete" ON public.published_posts FOR DELETE TO anon USING (true);
