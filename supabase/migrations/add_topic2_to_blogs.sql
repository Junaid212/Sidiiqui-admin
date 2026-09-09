-- ============================================
-- Migration: Add topic2 to blogs for interlinked categories
-- Purpose:   Allow blogs to belong to multiple categories,
--            so blogs can be accessed across interlinked categories.
-- Run this in the Supabase SQL Editor.
-- ============================================

-- 1. Add topic2 column to blogs table if it doesn't already exist
ALTER TABLE public.blogs
  ADD COLUMN IF NOT EXISTS topic2 TEXT;

-- 2. Create index for fast filtering by secondary category
CREATE INDEX IF NOT EXISTS idx_blogs_topic2 ON public.blogs(topic2);

-- ============================================
-- Note: The backend application also includes graceful
-- fallback so that if this migration has not yet been
-- executed, it can safely store both categories comma-separated
-- in the existing `topic` column without throwing an error.
-- ============================================
