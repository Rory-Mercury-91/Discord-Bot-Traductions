-- Migration : Optimisation du schéma de la table tags
-- 1. Fusionner is_translator + category en tag_type
-- 2. Supprimer la colonne template (obsolète)

-- Étape 1 : Créer la nouvelle colonne tag_type
ALTER TABLE public.tags
  ADD COLUMN IF NOT EXISTS tag_type text NULL;

-- Étape 2 : Migrer les données existantes
-- Si is_translator = true → tag_type = 'translator'
-- Sinon → tag_type = category (ou 'other' si NULL)
UPDATE public.tags
SET tag_type = CASE
  WHEN is_translator = true THEN 'translator'
  WHEN category IS NOT NULL THEN category
  ELSE 'other'
END
WHERE tag_type IS NULL;

-- Étape 3 : Rendre tag_type NOT NULL avec contrainte CHECK
ALTER TABLE public.tags
  ALTER COLUMN tag_type SET NOT NULL,
  ALTER COLUMN tag_type SET DEFAULT 'other',
  ADD CONSTRAINT tags_tag_type_check 
    CHECK (tag_type IN ('translator', 'translationType', 'gameStatus', 'sites', 'other'));

-- Étape 4 : Supprimer les anciennes colonnes
ALTER TABLE public.tags
  DROP COLUMN IF EXISTS template,
  DROP COLUMN IF EXISTS is_translator,
  DROP COLUMN IF EXISTS category;

-- Étape 5 : Supprimer l'ancien index sur category et créer le nouveau
DROP INDEX IF EXISTS idx_tags_category;
CREATE INDEX idx_tags_tag_type ON public.tags (tag_type);

-- Commentaire pour documenter
COMMENT ON COLUMN public.tags.tag_type IS 'Type de tag : translator (tags traducteurs) ou translationType/gameStatus/sites/other (tags génériques)';
