-- ============================================================
-- MIGRATION: Add ask_sid_settings table (SAFE & ADDITIVE ONLY)
-- Can be executed in Supabase SQL Editor for persistent settings
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ask_sid_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ask_sid_settings ENABLE ROW LEVEL SECURITY;

-- Allow public read of settings
CREATE POLICY "Public can view Ask SID settings"
    ON public.ask_sid_settings FOR SELECT
    USING (true);

-- Allow authenticated users / admins to modify
CREATE POLICY "Admins can update Ask SID settings"
    ON public.ask_sid_settings FOR ALL
    USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');
