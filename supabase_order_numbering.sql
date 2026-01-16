-- Incremental Order Numbers per Restaurant
-- Implementation to avoid global numbering and use per-restaurant sequences.

-- 1. Create the counter table
CREATE TABLE IF NOT EXISTS public.restaurant_counters (
    restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE PRIMARY KEY,
    last_order_number integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Enable Row Level Security
ALTER TABLE public.restaurant_counters ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
-- Allow authenticated users to read (optional, but good for debugging)
CREATE POLICY "Counters are viewable by authenticated users" 
ON public.restaurant_counters FOR SELECT 
TO authenticated 
USING (true);

-- 4. Create the Atomic Function (RPC)
-- This function ensures that order numbers are unique and sequential per restaurant
-- even under high concurrency (Race Condition Safety).
CREATE OR REPLACE FUNCTION public.get_next_order_number(p_restaurant_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER -- Important: This allows the function to bypass RLS for its own operations
AS $$
DECLARE
    v_next_number integer;
BEGIN
    INSERT INTO public.restaurant_counters (restaurant_id, last_order_number)
    VALUES (p_restaurant_id, 1)
    ON CONFLICT (restaurant_id) DO UPDATE
    SET last_order_number = restaurant_counters.last_order_number + 1,
        updated_at = timezone('utc'::text, now())
    RETURNING last_order_number INTO v_next_number;

    RETURN v_next_number;
END;
$$;

-- 5. Migration for existing orders table
-- We change the column from SERIAL to INTEGER to take control of it manually.
DO $$ 
BEGIN
    -- Check if it's still a serial/has a sequence
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' 
        AND column_name = 'order_number' 
        AND column_default LIKE 'nextval%'
    ) THEN
        ALTER TABLE public.orders ALTER COLUMN order_number DROP DEFAULT;
        ALTER TABLE public.orders ALTER COLUMN order_number TYPE integer USING order_number::integer;
    END IF;
END $$;
