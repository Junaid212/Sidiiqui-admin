-- ============================================================
-- FIX: Add missing columns to ebooks table
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/cneariiepqywvjpmznqn/sql
-- ============================================================

ALTER TABLE public.ebooks
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS format TEXT DEFAULT 'PDF',
  ADD COLUMN IF NOT EXISTS file_path TEXT DEFAULT 'ebooks/marketing-reclassified.pdf',
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'AED',
  ADD COLUMN IF NOT EXISTS sku TEXT,
  ADD COLUMN IF NOT EXISTS author TEXT DEFAULT 'M. Q. Siddiqui',
  ADD COLUMN IF NOT EXISTS product_type TEXT DEFAULT 'ebook',
  ADD COLUMN IF NOT EXISTS download_limit INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS download_expiry_hours INTEGER DEFAULT 72;

CREATE INDEX IF NOT EXISTS idx_ebooks_active ON public.ebooks(active);
CREATE INDEX IF NOT EXISTS idx_ebooks_sku ON public.ebooks(sku);
