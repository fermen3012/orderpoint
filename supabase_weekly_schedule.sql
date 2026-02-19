-- Create product_availability table
CREATE TABLE IF NOT EXISTS product_availability (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Constraint: One record per product per day
    UNIQUE(product_id, day_of_week)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_product_availability_lookup 
ON product_availability(product_id, day_of_week);

-- RLS Policies
ALTER TABLE product_availability ENABLE ROW LEVEL SECURITY;

-- Allow read for everyone (Kiosk needs to read)
CREATE POLICY "Public read availability" 
ON product_availability FOR SELECT 
USING (true);

-- Allow full access for admins/staff of the same restaurant
CREATE POLICY "Staff manage availability" 
ON product_availability FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.restaurant_id = product_availability.restaurant_id
        AND profiles.role IN ('admin', 'kitchen', 'owner', 'super_admin')
    )
);

-- Grant permissions
GRANT ALL ON product_availability TO authenticated;
GRANT SELECT ON product_availability TO anon;
