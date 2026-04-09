-- M3 Pre-Cleanup Migration
-- Date: 2026-04-09
-- Purpose: Fix security issues, performance issues, orphan tables, and backfill missing user profiles

-- ============================================================
-- 1. BACKFILL public.users FOR EXISTING AUTH USERS
-- ============================================================
INSERT INTO public.users (id, display_name, photo_url)
SELECT
  au.id,
  au.raw_user_meta_data->>'display_name',
  au.raw_user_meta_data->>'photo_url'
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.users pu WHERE pu.id = au.id
);

-- ============================================================
-- 2. DROP ORPHAN TABLES
-- ============================================================
DROP TABLE IF EXISTS public.media;
DROP TABLE IF EXISTS public.share_tokens;

-- ============================================================
-- 3. FIX RLS POLICIES
-- ============================================================

-- users table
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can delete own profile" ON public.users;

CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING ((select auth.uid()) = id);

CREATE POLICY "Users can insert own profile"
  ON public.users FOR INSERT
  WITH CHECK ((select auth.uid()) = id);

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

CREATE POLICY "Users can delete own profile"
  ON public.users FOR DELETE
  USING ((select auth.uid()) = id);

-- childrenprofiles table
DROP POLICY IF EXISTS "Dad can view own children" ON public.childrenprofiles;
DROP POLICY IF EXISTS "Dad can insert own children" ON public.childrenprofiles;
DROP POLICY IF EXISTS "Dad can update own children" ON public.childrenprofiles;
DROP POLICY IF EXISTS "Dad can delete own children" ON public.childrenprofiles;

CREATE POLICY "Dad can view own children"
  ON public.childrenprofiles FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Dad can insert own children"
  ON public.childrenprofiles FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Dad can update own children"
  ON public.childrenprofiles FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Dad can delete own children"
  ON public.childrenprofiles FOR DELETE
  USING ((select auth.uid()) = user_id);

-- entries table
DROP POLICY IF EXISTS "entries_select_own" ON public.entries;
DROP POLICY IF EXISTS "entries_insert_own" ON public.entries;
DROP POLICY IF EXISTS "entries_update_own" ON public.entries;
DROP POLICY IF EXISTS "entries_delete_own" ON public.entries;

CREATE POLICY "entries_select_own"
  ON public.entries FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "entries_insert_own"
  ON public.entries FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "entries_update_own"
  ON public.entries FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "entries_delete_own"
  ON public.entries FOR DELETE
  USING ((select auth.uid()) = user_id);

-- entry_children table
DROP POLICY IF EXISTS "entry_children_select_own" ON public.entry_children;
DROP POLICY IF EXISTS "entry_children_insert_own" ON public.entry_children;
DROP POLICY IF EXISTS "entry_children_delete_own" ON public.entry_children;

CREATE POLICY "entry_children_select_own"
  ON public.entry_children FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM entries e
    WHERE e.id = entry_children.entry_id
    AND e.user_id = (select auth.uid())
  ));

CREATE POLICY "entry_children_insert_own"
  ON public.entry_children FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM entries e
    WHERE e.id = entry_children.entry_id
    AND e.user_id = (select auth.uid())
  ));

CREATE POLICY "entry_children_delete_own"
  ON public.entry_children FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM entries e
    WHERE e.id = entry_children.entry_id
    AND e.user_id = (select auth.uid())
  ));

-- entry_photos table
DROP POLICY IF EXISTS "entry_photos_select_own" ON public.entry_photos;
DROP POLICY IF EXISTS "entry_photos_insert_own" ON public.entry_photos;
DROP POLICY IF EXISTS "entry_photos_delete_own" ON public.entry_photos;

CREATE POLICY "entry_photos_select_own"
  ON public.entry_photos FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM entries e
    WHERE e.id = entry_photos.entry_id
    AND e.user_id = (select auth.uid())
  ));

CREATE POLICY "entry_photos_insert_own"
  ON public.entry_photos FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM entries e
    WHERE e.id = entry_photos.entry_id
    AND e.user_id = (select auth.uid())
  ));

CREATE POLICY "entry_photos_delete_own"
  ON public.entry_photos FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM entries e
    WHERE e.id = entry_photos.entry_id
    AND e.user_id = (select auth.uid())
  ));

-- ============================================================
-- 4. FIX FUNCTION SEARCH PATHS
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, display_name, photo_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'photo_url'
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- 5. ADD MISSING INDEX
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_childrenprofiles_user_id
  ON public.childrenprofiles (user_id);
