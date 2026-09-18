-- ============================================================
-- MIGRATION: Add publication content columns to ebooks table
-- Run in Supabase SQL Editor for cneariiepqywvjpmznqn
-- SAFE: additive only, no drops, no data loss
-- All existing records are preserved
-- ============================================================

ALTER TABLE public.ebooks
  ADD COLUMN IF NOT EXISTS subtitle TEXT,
  ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS publication_status TEXT DEFAULT 'available',
  ADD COLUMN IF NOT EXISTS why_this_book_matters TEXT,
  ADD COLUMN IF NOT EXISTS who_its_for JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS what_readers_will_learn JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS author_note TEXT,
  ADD COLUMN IF NOT EXISTS faq JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS related_learning JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS related_frameworks JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS related_blogs JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS access_options JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_ebooks_slug ON public.ebooks(slug);
CREATE INDEX IF NOT EXISTS idx_ebooks_pub_status ON public.ebooks(publication_status);
