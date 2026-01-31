-- Ajouter la catégorie pour les tags génériques
ALTER TABLE public.tags
  ADD COLUMN IF NOT EXISTS category text NULL;

COMMENT ON COLUMN public.tags.category IS 'Catégorie du tag (translationType, gameStatus, sites, other). NULL pour les tags traducteurs.';

-- Index pour améliorer les performances de filtrage par catégorie
CREATE INDEX IF NOT EXISTS idx_tags_category ON public.tags (category) WHERE category IS NOT NULL;
