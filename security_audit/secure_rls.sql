-- =========================================================================================
-- SECURE RLS SCRIPT - TENANT ISOLATION
-- =========================================================================================

-- 1. UTILITY: Function to get current user's restaurant_id
-- We use SECURITY DEFINER to allow this function to access profiles even if we restrict profiles later.
CREATE OR REPLACE FUNCTION public.get_my_restaurant_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT restaurant_id FROM public.profiles WHERE id = auth.uid()
$$;

-- 2. SECURING RESTAURANTS
-- Only allow reading if it's YOUR restaurant (for Admin/Kitchen) 
-- OR if it's public data needed for Kiosk (we might need a separate policy for Kiosk if unauthenticated)
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Restaurants are viewable by everyone" ON public.restaurants;

-- Policy: Authenticated users can only see their own restaurant
CREATE POLICY "Tenant Isolation: View Own Restaurant"
ON public.restaurants
FOR SELECT
USING (
  id = get_my_restaurant_id() 
  -- OR... If we want Kiosk to see it, we need logic. 
  -- Assuming Kiosk is authenticated as a user with a restaurant_id.
);

-- 3. SECURING ORDERS (Critical)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Orders viewable by everyone (for demo KDS)" ON public.orders;
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;
DROP POLICY IF EXISTS "Orders updatable by everyone (for demo KDS)" ON public.orders;

-- Read: Only own restaurant
CREATE POLICY "Tenant Isolation: Select Orders"
ON public.orders
FOR SELECT
USING ( restaurant_id = get_my_restaurant_id() );

-- Insert: Must match your restaurant (Prevents inserting into other orgs)
-- Note: If Kiosk is "public" (anon), this will block it. Kiosk MUST be authenticated or use a wrapper.
CREATE POLICY "Tenant Isolation: Insert Orders"
ON public.orders
FOR INSERT
WITH CHECK ( restaurant_id = get_my_restaurant_id() );

-- Update: Only own restaurant
CREATE POLICY "Tenant Isolation: Update Orders"
ON public.orders
FOR UPDATE
USING ( restaurant_id = get_my_restaurant_id() );


-- 4. SECURING ORDER ITEMS
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Order items viewable by everyone" ON public.order_items;
DROP POLICY IF EXISTS "Anyone can create order items" ON public.order_items;

CREATE POLICY "Tenant Isolation: Select Order Items"
ON public.order_items
FOR SELECT
USING (
  EXISTS ( SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.restaurant_id = get_my_restaurant_id() )
);

CREATE POLICY "Tenant Isolation: Insert Order Items"
ON public.order_items
FOR INSERT
WITH CHECK (
  EXISTS ( SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.restaurant_id = get_my_restaurant_id() )
);

-- TEST SCRIPT (Run this to verify)
-- SELECT * FROM orders WHERE restaurant_id != get_my_restaurant_id(); 
-- Should return 0 rows.
