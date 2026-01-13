-- Run this in your Supabase SQL Editor to fix the missing column issue

-- 1. Add the column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'removed_ingredients') THEN
        ALTER TABLE public.order_items ADD COLUMN removed_ingredients text[];
    END IF;
END $$;

-- 2. Force schema cache reload by notifying (standard PostgREST trick)
NOTIFY pgrst, 'reload config';
