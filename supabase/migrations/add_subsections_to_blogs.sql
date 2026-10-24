-- ==============================================================================
-- Migration: Add Repeatable Sub-Sections and Pull Quote Position to Blogs
-- Supports repeatable blocks (up to 8) and flexible pull quote placement
-- ==============================================================================

ALTER TABLE public.blogs
  ADD COLUMN IF NOT EXISTS sub_sections JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS pull_quote_position INTEGER DEFAULT 1;

-- Backfill existing blogs: migrate legacy title2 / content2 into sub_sections[0]
UPDATE public.blogs
SET sub_sections = jsonb_build_array(
  jsonb_build_object(
    'id', 'sub-legacy-1',
    'heading', COALESCE(title2, ''),
    'body', COALESCE(content2, ''),
    'highlight_type', 'none',
    'highlight_text', ''
  )
)
WHERE (sub_sections IS NULL OR sub_sections = '[]'::jsonb)
  AND (title2 IS NOT NULL OR content2 IS NOT NULL);
