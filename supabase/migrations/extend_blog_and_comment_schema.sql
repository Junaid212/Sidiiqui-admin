-- ==============================================================================
-- Migration: Extend Blog & Comment Schema for Editorial Platform
-- Preserves all existing blog records, categories, and comments.
-- ==============================================================================

-- 1. Extend public.blogs with editorial fields
ALTER TABLE public.blogs
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS standfirst TEXT,
  ADD COLUMN IF NOT EXISTS reading_time TEXT,
  ADD COLUMN IF NOT EXISTS author_byline TEXT DEFAULT 'By M. Q. Siddiqui, Founder, Siddiqui.digital',
  ADD COLUMN IF NOT EXISTS image_caption TEXT,
  ADD COLUMN IF NOT EXISTS image_alt TEXT,
  ADD COLUMN IF NOT EXISTS pull_quote TEXT,
  ADD COLUMN IF NOT EXISTS pull_quote_author TEXT,
  ADD COLUMN IF NOT EXISTS concluding_insight TEXT,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS related_to_book BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS book_concept TEXT,
  ADD COLUMN IF NOT EXISTS related_blog_ids JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS seo_title TEXT,
  ADD COLUMN IF NOT EXISTS seo_description TEXT;

-- 2. Create index on slug and status for fast public querying
CREATE INDEX IF NOT EXISTS idx_blogs_slug ON public.blogs(slug);
CREATE INDEX IF NOT EXISTS idx_blogs_status ON public.blogs(status);
CREATE INDEX IF NOT EXISTS idx_blogs_is_featured ON public.blogs(is_featured);

-- 3. Populate default slug for existing blogs if missing
UPDATE public.blogs
SET slug = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(title, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'))
WHERE slug IS NULL OR slug = '';

-- Ensure existing blogs have status = 'published'
UPDATE public.blogs
SET status = 'published'
WHERE status IS NULL;

-- 4. Extend public.blog_comments for moderation
ALTER TABLE public.blog_comments
  ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'approved';

-- Mark any historical comments as approved so existing content is not hidden
UPDATE public.blog_comments
SET is_approved = true, status = 'approved'
WHERE is_approved IS NULL;

-- For new comments submitted by public readers, default will be pending
ALTER TABLE public.blog_comments
  ALTER COLUMN is_approved SET DEFAULT false,
  ALTER COLUMN status SET DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS idx_blog_comments_approved ON public.blog_comments(is_approved);
