-- Migration: Add unit_price column to restaurants table
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10, 2) DEFAULT 49.00;
