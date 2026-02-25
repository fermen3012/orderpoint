-- Add missing 'total_price' column to 'order_items' table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'total_price') THEN
        ALTER TABLE public.order_items ADD COLUMN total_price numeric(10,2) DEFAULT 0;
    END IF;
END $$;

-- Reload schema cache
NOTIFY pgrst, 'reload config';
