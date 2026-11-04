-- ============================================================
-- MIGRATION: Add missing columns to consultations table
-- Run this in the Supabase SQL Editor
-- ============================================================
-- The consultations table was originally created with only:
--   id, name, email, phone, selected_date, selected_time,
--   consultant, message, created_at
--
-- The backend controller (consultationController.js) writes:
--   user_id, date, time, selected_date, selected_time,
--   status, email_sent, consultant
--
-- This migration adds the missing columns so inserts succeed
-- without hitting the graceful fallback path, and so the
-- admin panel can display status and email_sent correctly.
-- ============================================================

-- 1. Linked Supabase auth user (optional — guests can book without logging in)
ALTER TABLE public.consultations
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. status — tracks lifecycle of each booking
ALTER TABLE public.consultations
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'booked'
    CHECK (status IN ('booked', 'confirmed', 'completed', 'cancelled', 'no-show'));

-- 3. email_sent — whether confirmation email was successfully delivered
ALTER TABLE public.consultations
    ADD COLUMN IF NOT EXISTS email_sent BOOLEAN NOT NULL DEFAULT FALSE;

-- 4. date — legacy alias for selected_date (kept for backward compatibility with
--    older controller code; both are written and both are queried)
ALTER TABLE public.consultations
    ADD COLUMN IF NOT EXISTS date DATE;

-- 5. time — legacy alias for selected_time
ALTER TABLE public.consultations
    ADD COLUMN IF NOT EXISTS time TEXT;

-- 6. Backfill legacy columns for any existing rows
UPDATE public.consultations
    SET date = selected_date
    WHERE date IS NULL AND selected_date IS NOT NULL;

UPDATE public.consultations
    SET time = selected_time
    WHERE time IS NULL AND selected_time IS NOT NULL;

-- 7. Performance index for slot-conflict queries
--    (checked on every new booking to prevent double-booking)
CREATE INDEX IF NOT EXISTS idx_consultations_date_time_status
    ON public.consultations (selected_date, selected_time, status);

CREATE INDEX IF NOT EXISTS idx_consultations_legacy_date_time
    ON public.consultations (date, time, status);

-- 8. Index for user-specific booking lookups
CREATE INDEX IF NOT EXISTS idx_consultations_user_id
    ON public.consultations (user_id);

-- 9. Verify the result
SELECT
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'consultations'
ORDER BY ordinal_position;

