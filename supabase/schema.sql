-- ============================================
-- Siddique Admin Dashboard — Supabase Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Profiles table (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- 2. Trigger: auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Orders table (tracks ebook purchases)
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  book_name TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'successful', 'failed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 4. Course clicks table
CREATE TABLE IF NOT EXISTS public.course_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clicked_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.course_clicks ENABLE ROW LEVEL SECURITY;

-- Allow inserts from anyone (public endpoint)
CREATE POLICY "Anyone can insert course clicks"
  ON public.course_clicks FOR INSERT
  WITH CHECK (true);

-- 5. Consultations table
CREATE TABLE IF NOT EXISTS public.consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  selected_date DATE NOT NULL,
  selected_time TEXT NOT NULL,
  consultant TEXT DEFAULT 'Muhammad.Q.Siddiqui',
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;

-- Allow public inserts from main site
CREATE POLICY "Allow public inserts" ON public.consultations FOR INSERT WITH CHECK (true);
-- Allow service role (backend) to select/delete
CREATE POLICY "Allow service role access" ON public.consultations FOR ALL USING (true);

-- 6. Blogs table
CREATE TABLE IF NOT EXISTS public.blogs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  image_path TEXT,
  topic TEXT,
  published_date DATE,
  title2 TEXT,
  content2 TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.blogs ENABLE ROW LEVEL SECURITY;

-- Allow public read for blog cards on main site
CREATE POLICY "Anyone can read blogs"
  ON public.blogs FOR SELECT
  USING (true);

-- 7. Blog Comments table
CREATE TABLE IF NOT EXISTS public.blog_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_id UUID NOT NULL REFERENCES public.blogs(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.blog_comments(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  content TEXT NOT NULL,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.blog_comments ENABLE ROW LEVEL SECURITY;

-- Allow public to read comments
CREATE POLICY "Anyone can read comments"
  ON public.blog_comments FOR SELECT
  USING (true);

-- Allow public to insert comments
CREATE POLICY "Anyone can insert comments"
  ON public.blog_comments FOR INSERT
  WITH CHECK (true);

-- Allow anyone to delete comments (admin manages via dashboard)
CREATE POLICY "Anyone can delete comments"
  ON public.blog_comments FOR DELETE
  USING (true);

-- ============================================
-- STORAGE: Create a 'blogs' bucket (set to public)
-- This must be done via Supabase Dashboard:
--   Storage → New Bucket → Name: "blogs" → Public: ON
-- ============================================

-- ============================================
-- MULTI-ADMIN ISOLATION MIGRATION
-- Run supabase/migrations/add_admin_id_to_blogs.sql
-- after the above schema to add per-admin ownership.
--
-- This migration adds:
--   blogs.admin_id        UUID → auth.users(id)
--   blog_comments.admin_id UUID → auth.users(id)
--
-- After applying the migration, each admin only sees
-- their own blogs and comment threads in the dashboard.
-- Public data (consultations, orders, contact_messages,
-- course_clicks) remains shared across all admins since
-- those records are submitted by end-users of the public site.
-- ============================================
