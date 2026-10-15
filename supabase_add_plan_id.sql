-- Migration: Add plan_id column to restaurants table
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS plan_id TEXT;

COMMENT ON COLUMN public.restaurants.plan_id IS 'Identificador del plan de suscripción SaaS asignado al restaurante (ej. plan_exo_salon, plan_kiosk_pro)';
