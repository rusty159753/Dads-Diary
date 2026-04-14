-- M4.1: Releases Schema
-- Creates releases table linking dad entries to child profiles
-- Releases are permanent and immutable - no UPDATE or DELETE permitted
-- is_test column required for eval framework isolation

CREATE TABLE releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dad_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES childrenprofiles(id) ON DELETE CASCADE,
  entry_id UUID NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  released_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  is_test BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(child_id, entry_id) -- prevent duplicate releases of same entry to same child
);

CREATE INDEX idx_releases_dad_id ON releases(dad_id);
CREATE INDEX idx_releases_child_id ON releases(child_id);
CREATE INDEX idx_releases_entry_id ON releases(entry_id);

-- RLS: enable row level security
ALTER TABLE releases ENABLE ROW LEVEL SECURITY;

-- Dad can read their own releases
CREATE POLICY "Dad can read own releases"
  ON releases FOR SELECT
  TO authenticated
  USING (dad_id = auth.uid());

-- Dad can create releases only for entries and children they own
CREATE POLICY "Dad can create releases for own entries and children"
  ON releases FOR INSERT
  TO authenticated
  WITH CHECK (
    dad_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM entries
      WHERE entries.id = entry_id
        AND entries.user_id = auth.uid()
        AND entries.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM childrenprofiles
      WHERE childrenprofiles.id = child_id
        AND childrenprofiles.user_id = auth.uid()
    )
  );

-- No UPDATE or DELETE permitted for any role - releases are permanent
-- (No policies created for UPDATE or DELETE = blocked by default)
