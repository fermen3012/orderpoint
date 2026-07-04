-- Stripe integration columns and indices for public.restaurants
-- Path: security_audit/stripe_hardening.sql

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS plan_quantity INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_restaurants_stripe_customer_id 
  ON public.restaurants(stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_restaurants_stripe_subscription_id 
  ON public.restaurants(stripe_subscription_id);
