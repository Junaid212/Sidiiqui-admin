-- ============================================
-- Migration: Add admin_id to blogs & comments
-- Purpose:   Multi-admin data isolation
--            Each admin only sees their own blogs/comments.
-- Run this in the Supabase SQL Editor.
-- ============================================

-- 1. Add admin_id to blogs table
ALTER TABLE public.blogs
  ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Index for fast per-admin queries
CREATE INDEX IF NOT EXISTS idx_blogs_admin_id ON public.blogs(admin_id);

-- 2. Add admin_id to blog_comments table (for admin reply ownership)
ALTER TABLE public.blog_comments
  ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_blog_comments_admin_id ON public.blog_comments(admin_id);

-- ============================================
-- NOTE on existing data:
-- Existing blogs/comments have admin_id = NULL.
-- They will NOT be shown to any admin after this
-- migration (because the backend filters by admin_id).
--
-- If you want to assign existing blogs to a specific
-- admin, run:
--   UPDATE public.blogs
--     SET admin_id = '<your-admin-uuid>'
--     WHERE admin_id IS NULL;
--
-- You can find your admin UUID in:
--   Supabase Dashboard → Authentication → Users
-- ============================================

-- 3. Drop old overly-permissive policies on blogs (service role bypasses RLS anyway,
--    but this keeps the schema tidy for direct-client access if ever needed).
DROP POLICY IF EXISTS "Anyone can read blogs" ON public.blogs;

-- New policy: anyone can read blogs (public site still needs this for the blog listing page)
CREATE POLICY "Public can read published blogs"
  ON public.blogs FOR SELECT
  USING (true);

-- Admins can only manage their own blogs (for direct Supabase client use)
CREATE POLICY "Admins can insert their own blogs"
  ON public.blogs FOR INSERT
  WITH CHECK (auth.uid() = admin_id);

CREATE POLICY "Admins can update their own blogs"
  ON public.blogs FOR UPDATE
  USING (auth.uid() = admin_id);

CREATE POLICY "Admins can delete their own blogs"
  ON public.blogs FOR DELETE
  USING (auth.uid() = admin_id);
