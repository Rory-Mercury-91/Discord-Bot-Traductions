-- =============================================================================
-- Nettoyage intégral de la base Supabase (Discord Publisher)
-- À exécuter dans le SQL Editor de Supabase : Projet → SQL Editor → New query
-- =============================================================================
-- Par défaut : Option A (données applicatives uniquement).
-- Pour un reset complet incluant les profils : commenter le bloc Option A
-- et décommenter le bloc Option B.
-- =============================================================================

-- ---------- Option A : Données applicatives uniquement (par défaut) ----------
-- Vide : publications, tags, config, autorisations éditeurs.
-- Les comptes (profiles) restent ; les utilisateurs restent connectés.

TRUNCATE TABLE public.allowed_editors CASCADE;
TRUNCATE TABLE public.published_posts CASCADE;
TRUNCATE TABLE public.tags RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.app_config CASCADE;

-- ---------- Option B : Nettoyage intégral (y compris profils) ----------
-- Décommenter le bloc ci-dessous et commenter le bloc Option A ci-dessus
-- pour tout réinitialiser. auth.users n'est pas modifié.

-- TRUNCATE TABLE public.allowed_editors CASCADE;
-- TRUNCATE TABLE public.published_posts CASCADE;
-- TRUNCATE TABLE public.tags RESTART IDENTITY CASCADE;
-- TRUNCATE TABLE public.app_config CASCADE;
-- TRUNCATE TABLE public.profiles CASCADE;
