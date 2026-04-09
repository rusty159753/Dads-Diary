-- M3 Task 3.4 - On This Day database function
-- Date: 2026-04-09
-- Purpose: Return the current user's entries from the same month and day in prior years

CREATE OR REPLACE FUNCTION public.get_on_this_day()
RETURNS SETOF public.entries
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.*
  FROM public.entries e
  WHERE e.user_id = (select auth.uid())
    AND e.deleted_at IS NULL
    AND EXTRACT(MONTH FROM e.entry_date) = EXTRACT(MONTH FROM CURRENT_DATE)
    AND EXTRACT(DAY FROM e.entry_date) = EXTRACT(DAY FROM CURRENT_DATE)
    AND EXTRACT(YEAR FROM e.entry_date) < EXTRACT(YEAR FROM CURRENT_DATE)
  ORDER BY e.entry_date DESC;
$$;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION public.get_on_this_day() TO authenticated;
