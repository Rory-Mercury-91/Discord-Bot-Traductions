-- Droits d'édition : qui peut modifier les posts de qui.
-- Chaque utilisateur choisit qui peut modifier ses posts (section utilisateur).
-- Master Admin (code validé) peut tout faire.

-- 1. Colonne is_master_admin sur profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_master_admin boolean NOT NULL DEFAULT false;

-- 2. Les utilisateurs authentifiés peuvent lire tous les profils (id, pseudo, discord_id) pour la liste "qui peut modifier"
CREATE POLICY "profiles_select_all_authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);

-- 3. Table : l'utilisateur owner_id autorise l'utilisateur editor_id à modifier ses posts
CREATE TABLE IF NOT EXISTS public.allowed_editors (
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  editor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, editor_id),
  CHECK (owner_id != editor_id)
);

CREATE INDEX IF NOT EXISTS idx_allowed_editors_editor_id
  ON public.allowed_editors(editor_id);

ALTER TABLE public.allowed_editors ENABLE ROW LEVEL SECURITY;

-- L'utilisateur voit les lignes où il est owner (pour gérer sa liste) ou editor (pour savoir s'il peut éditer les posts de quelqu'un)
CREATE POLICY "allowed_editors_select_own_or_editor" ON public.allowed_editors
  FOR SELECT TO authenticated
  USING (auth.uid() = owner_id OR auth.uid() = editor_id);

-- Seul le owner peut ajouter / supprimer (autoriser / révoquer)
CREATE POLICY "allowed_editors_insert_own" ON public.allowed_editors
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "allowed_editors_delete_own" ON public.allowed_editors
  FOR DELETE TO authenticated USING (auth.uid() = owner_id);
