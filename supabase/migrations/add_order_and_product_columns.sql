-- ============================================================
-- MIGRATION: Add columns to 'ebooks' and 'orders' tables
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/cneariiepqywvjpmznqn/sql
-- ============================================================

-- 1. Ebooks table enhancement
ALTER TABLE public.ebooks
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS format TEXT DEFAULT 'PDF',
  ADD COLUMN IF NOT EXISTS file_path TEXT,
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'AED',
  ADD COLUMN IF NOT EXISTS sku TEXT,
  ADD COLUMN IF NOT EXISTS author TEXT DEFAULT 'M. Q. Siddiqui',
  ADD COLUMN IF NOT EXISTS product_type TEXT DEFAULT 'ebook',
  ADD COLUMN IF NOT EXISTS download_limit INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS download_expiry_hours INTEGER DEFAULT 72;

CREATE INDEX IF NOT EXISTS idx_ebooks_active ON public.ebooks(active);
CREATE INDEX IF NOT EXISTS idx_ebooks_sku ON public.ebooks(sku);

-- 2. Orders table enhancement
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_number TEXT,
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.ebooks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'AED',
  ADD COLUMN IF NOT EXISTS stripe_session_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS download_token TEXT,
  ADD COLUMN IF NOT EXISTS download_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS download_limit INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS download_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refund_status TEXT,
  ADD COLUMN IF NOT EXISTS refund_date TIMESTAMPTZ;

-- Drop restrictive check constraint if it only allowed ('pending', 'successful', 'failed')
-- to allow standard statuses ('pending', 'paid', 'successful', 'failed', 'refunded', 'cancelled', 'expired')
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_status_check' AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders DROP CONSTRAINT orders_status_check;
  END IF;
END $$;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'paid', 'successful', 'failed', 'refunded', 'cancelled', 'expired'));

-- Helpful indexes for lookup
CREATE INDEX IF NOT EXISTS idx_orders_stripe_session ON public.orders(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_orders_download_token ON public.orders(download_token);
CREATE INDEX IF NOT EXISTS idx_orders_product_id ON public.orders(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_email ON public.orders(email);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
