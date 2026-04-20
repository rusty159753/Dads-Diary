-- M4: Child auto-visibility based on entry tagging
-- Replaces releases-based child read policy.
-- Entries with no child tag (entry_children empty) are visible to all children.
-- Entries tagged to specific children are visible only to those children.

-- Drop old releases-based child read policy
DROP POLICY IF EXISTS "Child can read released entries" ON entries;

-- Child sees entries from their dad where:
-- no child tag = visible to all children
-- OR specifically tagged to this child
CREATE POLICY "Child can read entries from dad"
  ON entries FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM child_accounts ca
      JOIN childrenprofiles cp ON cp.id = ca.child_profile_id
      WHERE ca.child_user_id = (SELECT auth.uid())
        AND cp.user_id = entries.user_id
        AND (
          NOT EXISTS (
            SELECT 1 FROM entry_children ec WHERE ec.entry_id = entries.id
          )
          OR EXISTS (
            SELECT 1 FROM entry_children ec
            WHERE ec.entry_id = entries.id
              AND ec.child_id = ca.child_profile_id
          )
        )
    )
  );

-- Allow child to read photos for entries they can access
CREATE POLICY "Child can read entry photos"
  ON entry_photos FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM entries e
      JOIN child_accounts ca ON ca.child_user_id = (SELECT auth.uid())
      JOIN childrenprofiles cp ON cp.id = ca.child_profile_id
      WHERE e.id = entry_photos.entry_id
        AND e.deleted_at IS NULL
        AND cp.user_id = e.user_id
        AND (
          NOT EXISTS (
            SELECT 1 FROM entry_children ec WHERE ec.entry_id = e.id
          )
          OR EXISTS (
            SELECT 1 FROM entry_children ec
            WHERE ec.entry_id = e.id
              AND ec.child_id = ca.child_profile_id
          )
        )
    )
  );
