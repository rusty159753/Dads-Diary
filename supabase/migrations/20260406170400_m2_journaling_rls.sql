-- M2.2: Journaling RLS Policies
-- Enforces data isolation: users can only see/edit their own entries

-- Enable RLS on all tables
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE entry_children ENABLE ROW LEVEL SECURITY;
ALTER TABLE entry_photos ENABLE ROW LEVEL SECURITY;

-- ============================================
-- ENTRIES TABLE POLICIES
-- ============================================

-- Users can SELECT only their own entries
CREATE POLICY "entries_select_own" ON entries
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can INSERT only as themselves
CREATE POLICY "entries_insert_own" ON entries
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can UPDATE only their own entries
CREATE POLICY "entries_update_own" ON entries
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can DELETE (soft) only their own entries
CREATE POLICY "entries_delete_own" ON entries
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- ENTRY_CHILDREN TABLE POLICIES
-- ============================================

-- Users can SELECT child tags only for their own entries
CREATE POLICY "entry_children_select_own" ON entry_children
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM entries e
      WHERE e.id = entry_children.entry_id
      AND e.user_id = auth.uid()
    )
  );

-- Users can INSERT child tags only to their own entries
CREATE POLICY "entry_children_insert_own" ON entry_children
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM entries e
      WHERE e.id = entry_id
      AND e.user_id = auth.uid()
    )
  );

-- Users can DELETE child tags only from their own entries
CREATE POLICY "entry_children_delete_own" ON entry_children
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM entries e
      WHERE e.id = entry_id
      AND e.user_id = auth.uid()
    )
  );

-- ============================================
-- ENTRY_PHOTOS TABLE POLICIES
-- ============================================

-- Users can SELECT photos only from their own entries
CREATE POLICY "entry_photos_select_own" ON entry_photos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM entries e
      WHERE e.id = entry_photos.entry_id
      AND e.user_id = auth.uid()
    )
  );

-- Users can INSERT photos only to their own entries
CREATE POLICY "entry_photos_insert_own" ON entry_photos
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM entries e
      WHERE e.id = entry_id
      AND e.user_id = auth.uid()
    )
  );

-- Users can DELETE photos only from their own entries
CREATE POLICY "entry_photos_delete_own" ON entry_photos
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM entries e
      WHERE e.id = entry_id
      AND e.user_id = auth.uid()
    )
  );
