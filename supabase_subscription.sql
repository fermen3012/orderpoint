-- Add subscription fields to restaurants table
ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS subscription_status text CHECK (subscription_status IN ('active', 'inactive', 'past_due')) DEFAULT 'inactive',
ADD COLUMN IF NOT EXISTS stripe_customer_id text,
ADD COLUMN IF NOT EXISTS current_period_end timestamptz;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_restaurants_stripe_customer_id ON restaurants(stripe_customer_id);

-- Note: You might want to update RLS policies if necessary, 
-- but owner/admin should generally have read access to their own restaurant data.
