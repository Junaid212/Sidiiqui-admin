-- ============================================
-- User Activity Tracking Schema and Triggers
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Create the user_activity table
CREATE TABLE IF NOT EXISTS public.user_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  email TEXT,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('consultation', 'ebook')),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;

-- Allow read access for service role / admin
CREATE POLICY "Allow service role full access" ON public.user_activity FOR ALL USING (true);


-- 2. Trigger for Ebook purchases (from orders table)
CREATE OR REPLACE FUNCTION public.handle_new_order_activity()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log successful orders
  IF NEW.status = 'successful' AND NEW.user_id IS NOT NULL THEN
    -- Prevent duplicate triggers if updating the same row
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status != 'successful') THEN
        INSERT INTO public.user_activity (user_id, email, activity_type, created_at)
        VALUES (
          NEW.user_id,
          (SELECT email FROM auth.users WHERE id = NEW.user_id LIMIT 1),
          'ebook',
          NEW.created_at
        );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_successful_order ON public.orders;
CREATE TRIGGER on_successful_order
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_order_activity();


-- 3. Trigger for Consultation bookings
CREATE OR REPLACE FUNCTION public.handle_new_consultation_activity()
RETURNS TRIGGER AS $$
DECLARE
  matched_user_id UUID;
BEGIN
  -- Attempt to lookup the user_id from auth.users using the email
  SELECT id INTO matched_user_id FROM auth.users WHERE email = NEW.email LIMIT 1;
  
  -- Insert the activity
  INSERT INTO public.user_activity (user_id, email, activity_type, created_at)
  VALUES (matched_user_id, NEW.email, 'consultation', NEW.created_at);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_new_consultation ON public.consultations;
CREATE TRIGGER on_new_consultation
  AFTER INSERT ON public.consultations
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_consultation_activity();


-- 4. Retroactive Data Import (Optional but recommended)
-- Backfill past successful orders
INSERT INTO public.user_activity (user_id, email, activity_type, created_at)
SELECT 
    user_id, 
    (SELECT email FROM auth.users WHERE id = user_id LIMIT 1), 
    'ebook', 
    created_at
FROM public.orders 
WHERE status = 'successful' AND user_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Backfill past consultations
INSERT INTO public.user_activity (user_id, email, activity_type, created_at)
SELECT 
    (SELECT id FROM auth.users WHERE email = public.consultations.email LIMIT 1), 
    email, 
    'consultation', 
    created_at
FROM public.consultations
ON CONFLICT DO NOTHING;
