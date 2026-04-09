-- M3 Task 3.1 - reminder_settings table
-- Date: 2026-04-09
-- Purpose: Store per-user notification preferences for writing reminders

CREATE TABLE public.reminder_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  frequency text NOT NULL DEFAULT 'weekly'
    CONSTRAINT reminder_settings_frequency_check
    CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly')),
  preferred_time time NOT NULL DEFAULT '09:00:00',
  preferred_day smallint DEFAULT 0
    CONSTRAINT reminder_settings_preferred_day_check
    CHECK (preferred_day IS NULL OR preferred_day BETWEEN 0 AND 6),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT reminder_settings_user_id_key UNIQUE (user_id)
);

-- One row per user - index on user_id for fast lookups
CREATE INDEX idx_reminder_settings_user_id
  ON public.reminder_settings (user_id);

-- Auto-update updated_at on changes
CREATE TRIGGER reminder_settings_updated_at
  BEFORE UPDATE ON public.reminder_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Enable RLS
ALTER TABLE public.reminder_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies - user can only access their own row
CREATE POLICY "reminder_settings_select_own"
  ON public.reminder_settings FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "reminder_settings_insert_own"
  ON public.reminder_settings FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "reminder_settings_update_own"
  ON public.reminder_settings FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "reminder_settings_delete_own"
  ON public.reminder_settings FOR DELETE
  USING ((select auth.uid()) = user_id);
