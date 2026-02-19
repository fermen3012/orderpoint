-- Add billing columns to restaurants table (Assuming 'restaurants' is the main org table)

ALTER TABLE restaurants 
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS plan_quantity INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active';

-- Index for fast lookups by stripe customer
CREATE INDEX IF NOT EXISTS idx_restaurants_stripe_customer 
ON restaurants(stripe_customer_id);

-- Note: We assume 'restaurants' table exists. 
-- If there is an 'organizations' table instead, replace 'restaurants' with 'organizations'.
