-- E2: Add is_test column to entries table
-- Supports eval framework test data isolation.
-- Eval-created rows set is_test = true. Cleanup scripts require
-- both user_id = TEST_USER_ID AND is_test = true before deleting
-- any row. Prevents accidental deletion of real user data.
-- Real user rows default to false and are never touched by cleanup scripts.
-- This column is removed when a separate staging environment exists.

ALTER TABLE entries
  ADD COLUMN is_test BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_entries_is_test ON entries(is_test)
  WHERE is_test = true;

-- Note: releases table does not exist yet (M4 task 4.1).
-- When releases is created in M4, include is_test BOOLEAN NOT NULL DEFAULT false
-- in that CREATE TABLE statement. Do not add it via ALTER TABLE later.
