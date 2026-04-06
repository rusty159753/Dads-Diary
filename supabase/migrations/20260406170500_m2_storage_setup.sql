-- M2.4: Entry Photos Storage Setup
-- Note: This migration handles the storage bucket creation via Supabase API
-- Storage bucket creation cannot be done via SQL migrations
-- Instead, this documents the expected setup:
--
-- 1. Create bucket named "entries" in Supabase Storage dashboard
-- 2. Set bucket to Private (not Public)
-- 3. Apply RLS policies below
--
-- SQL-based RLS policies for storage:

-- Allow authenticated users to upload photos to their own entry paths
CREATE POLICY "Users can upload photos to their own entries" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'entries' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to download photos from their own entry paths
CREATE POLICY "Users can view photos from their own entries" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'entries' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to delete photos from their own entries
CREATE POLICY "Users can delete photos from their own entries" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'entries' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
