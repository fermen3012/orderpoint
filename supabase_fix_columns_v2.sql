-- Run this in your Supabase SQL Editor to fix the missing columns in orders and tables

-- 1. Add missing columns to 'tables' table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tables' AND column_name = 'waitress_id') THEN
        ALTER TABLE public.tables ADD COLUMN waitress_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 2. Add missing columns to 'orders' table
DO $$
BEGIN
    -- table_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'table_id') THEN
        ALTER TABLE public.orders ADD COLUMN table_id uuid REFERENCES public.tables(id) ON DELETE SET NULL;
    END IF;

    -- waitress_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'waitress_id') THEN
        ALTER TABLE public.orders ADD COLUMN waitress_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;

    -- items (jsonb)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'items') THEN
        ALTER TABLE public.orders ADD COLUMN items jsonb DEFAULT '[]'::jsonb;
    END IF;

    -- source
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'source') THEN
        ALTER TABLE public.orders ADD COLUMN source text;
    END IF;
END $$;

-- 3. Force schema cache reload
NOTIFY pgrst, 'reload config';
