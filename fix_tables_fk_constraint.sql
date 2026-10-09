-- ==============================================================================
-- Migration: Ensure orders.table_id foreign key cascades cleanly with ON DELETE SET NULL
-- ==============================================================================

DO $$
BEGIN
    -- Drop old foreign key constraint if exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'orders_table_id_fkey' 
        AND table_name = 'orders'
    ) THEN
        ALTER TABLE public.orders DROP CONSTRAINT orders_table_id_fkey;
    END IF;

    -- Add foreign key constraint with ON DELETE SET NULL
    ALTER TABLE public.orders
        ADD CONSTRAINT orders_table_id_fkey
        FOREIGN KEY (table_id)
        REFERENCES public.tables(id)
        ON DELETE SET NULL;
END $$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload config';
