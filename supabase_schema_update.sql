-- Add order_type column to orders table
ALTER TABLE public.orders 
ADD COLUMN order_type text CHECK (order_type IN ('dine_in', 'takeout')) DEFAULT 'dine_in';

-- Update RLS policies if necessary (usually existing policies cover new columns if they are generic)
-- The existing policy for insert is "with check (true)", so it allows any column.
