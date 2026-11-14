-- Add optional social sharing image URL to blog articles.
-- Existing cover images and blog records remain unchanged.

ALTER TABLE public.blogs
ADD COLUMN IF NOT EXISTS social_image_url TEXT;
