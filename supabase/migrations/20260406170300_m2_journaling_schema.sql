-- M2.1: Journaling Schema
-- Creates entries, entry_children (many-to-many), and entry_photos tables
-- All scoped to authenticated user via RLS

-- Entries table: one entry per journal write
CREATE TABLE entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text VARCHAR(3000) NOT NULL,
  entry_date DATE NOT NULL, -- allows backdating
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL -- soft delete
);

CREATE INDEX idx_entries_user_id ON entries(user_id);
CREATE INDEX idx_entries_created_at ON entries(created_at DESC);
CREATE INDEX idx_entries_entry_date ON entries(entry_date DESC);
CREATE INDEX idx_entries_deleted_at ON entries(deleted_at);

-- Entry_children: many-to-many junction table
-- Links entries to child profiles for tagging
CREATE TABLE entry_children (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES childrenprofiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(entry_id, child_id)
);

CREATE INDEX idx_entry_children_entry_id ON entry_children(entry_id);
CREATE INDEX idx_entry_children_child_id ON entry_children(child_id);

-- Entry_photos: photo metadata and storage pointers
-- Stores reference to files in Supabase Storage
CREATE TABLE entry_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL, -- e.g., users/{user_id}/entries/{entry_id}/{filename}
  original_filename TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(entry_id, storage_path)
);

CREATE INDEX idx_entry_photos_entry_id ON entry_photos(entry_id);
